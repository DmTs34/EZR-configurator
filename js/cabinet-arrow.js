/**
 * cabinet-arrow.js
 * Manages placement arrows — one per row.
 *
 * Each arrow:
 *   - Sits on the floor, snapped to 600 mm tile intersections.
 *   - Left-click-drag → move to new tile intersection.
 *   - Right-click → context menu:
 *       • Rotate 90°   — toggles angle 0↔1
 *       • Add row      — new arrow offset 2 tiles (1200 mm) from this one
 *       • Delete row   — confirm dialog, then remove row + its cabinets
 *
 * After any change → updates Cabinet.rows[rowIdx] and calls
 * CabinetBuilder.rebuildAllForNewOrigin().
 */
window.CabinetArrow = (function () {
  'use strict';

  const COMP_ROOT    = 'components/';
  const TILE_MM      = 600;
  const OFFSET_TILES = 2;

  const COLOR_ACTIVE   = new THREE.Color(0x65b8a5); // teal   — matches active highlight mat
  const COLOR_INACTIVE = new THREE.Color(0x9c6b5f); // brown  — matches locked highlight mat

  const SNAP_MM  = 300;          // snap grid resolution
  const SNAP_M   = SNAP_MM * 0.001;
  const DOT_R    = 0.012;        // snap-dot radius (world units)
  const DOT_COLS = 13;           // dots visible in each axis (odd → centred on cursor)
  const DOT_COLOR = 0xb0b0b0;

  // Snap-dot pool — reused across frames to avoid GC pressure
  const _snapDots  = [];
  let   _snapGroup = null;       // THREE.Group added to scene during drag

  let _scene  = null;
  let _camera = null;
  let _canvas = null;

  // Invisible floor plane for raycasting
  let _floorPlane = null;

  // Label container (shared with cabinet-builder)
  let _labelContainer = null;

  // Per-arrow state: [{ mesh, labelEl, rowIdx }]
  const _arrows = [];
  const _arrowTmpVec = new THREE.Vector3(); // reused every frame — avoid per-frame alloc
  let _arrowCanvasRect = null;              // cached getBoundingClientRect

  // Drag state
  let _dragging    = false;
  let _dragArrowIdx = -1;
  let _dragStarted  = false;
  let _mouseDownX   = 0;
  let _mouseDownY   = 0;
  const DRAG_THRESHOLD = 5;

  // Context menu
  let _ctxMenu = null;

  const _raycaster = new THREE.Raycaster();

  /* ── Init ─────────────────────────────────────────── */
  function init(canvas, scene, camera) {
    _canvas = canvas;
    _scene  = scene;
    _camera = camera;

    _floorPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    _floorPlane.rotation.x = -Math.PI / 2;
    _scene.add(_floorPlane);

    // Ensure Cabinet.rows has at least 1 entry
    if (!Cabinet.rows || !Cabinet.rows.length) {
      Cabinet.rows = [{ id: 0, origin: { x: 0, z: 0 }, angle: 0 }];
    }

    // Spawn arrows for all existing rows
    for (let i = 0; i < Cabinet.rows.length; i++) {
      _spawnArrow(i);
    }

    _bindEvents();
  }

  /* ── Label container ─────────────────────────────── */
  function _ensureLabelContainer() {
    if (_labelContainer) return;
    _labelContainer = document.createElement('div');
    _labelContainer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
    const canvas = _canvas;
    if (canvas?.parentElement) {
      canvas.parentElement.style.position = 'relative';
      canvas.parentElement.appendChild(_labelContainer);
    }
    // Cache canvas rect; refresh on resize
    _arrowCanvasRect = (_canvas ?? document.body).getBoundingClientRect();
    const target = canvas?.parentElement ?? canvas;
    if (target) {
      new ResizeObserver(() => {
        _arrowCanvasRect = (_canvas ?? document.body).getBoundingClientRect();
      }).observe(target);
    }
  }

  function _makeLabelEl(rowIdx) {
    _ensureLabelContainer();
    const el = document.createElement('div');
    el.dataset.arrowRowIdx = rowIdx;
    el.style.cssText = [
      'position:absolute', 'pointer-events:none',
      'transform:translate(-50%,-200%)',
      'font:700 12px "Mont",sans-serif',
      'white-space:nowrap', 'user-select:none',
      'padding:2px 7px', 'border-radius:10px',
      'border:1.5px solid currentColor',
      'background:rgba(255,255,255,0.92)',
    ].join(';');
    _labelContainer.appendChild(el);
    return el;
  }

  function _updateLabelStyle(rowIdx) {
    const entry = _arrows[rowIdx];
    if (!entry?.labelEl) return;
    const isActive = (Cabinet.activeRowIdx ?? 0) === rowIdx;
    entry.labelEl.style.color = isActive ? '#65b8a5' : '#9c6b5f';
    entry.labelEl.textContent = `Row ${rowIdx + 1}`;
  }

  /* ── Arrow mesh colour ────────────────────────────── */
  function _updateArrowColor(rowIdx) {
    const entry = _arrows[rowIdx];
    if (!entry?.mesh) return;
    const color = (Cabinet.activeRowIdx ?? 0) === rowIdx ? COLOR_ACTIVE : COLOR_INACTIVE;
    entry.mesh.traverse(child => {
      if (!child.isMesh) return;
      // Clone material once so we don't share it between arrows
      if (!child.userData.arrowMatCloned) {
        child.material = child.material.clone();
        child.userData.arrowMatCloned = true;
      }
      child.material.color.set(color);
    });
  }

  /* ── Refresh all indicators after activeRowIdx changes ── */
  function _refreshActiveIndicators() {
    for (let i = 0; i < _arrows.length; i++) {
      _updateArrowColor(i);
      _updateLabelStyle(i);
    }
  }

  /* ── Spawn / remove arrows ────────────────────────── */
  function _spawnArrow(rowIdx) {
    const loader = new THREE.GLTFLoader();
    loader.load(COMP_ROOT + 'Arrow.glb', (gltf) => {
      const mesh = gltf.scene;
      mesh.name = 'CabinetArrow_' + rowIdx;
      mesh.traverse(child => {
        if (child.isMesh) {
          child.userData.isArrow = true;
          child.userData.rowIdx  = rowIdx;
          child.renderOrder = 2;
        }
      });

      const labelEl = _makeLabelEl(rowIdx);

      _scene.add(mesh);

      if (_arrows[rowIdx]) {
        _scene.remove(_arrows[rowIdx].mesh);
        if (_arrows[rowIdx].labelEl) _arrows[rowIdx].labelEl.remove();
      }
      _arrows[rowIdx] = { mesh, labelEl, rowIdx };
      if (_arrowsHidden) mesh.visible = false;
      _applyTransform(rowIdx);
      _updateArrowColor(rowIdx);
      _updateLabelStyle(rowIdx);
    }, undefined, (err) => {
      console.error('[CabinetArrow] Failed to load Arrow.glb', err);
    });
  }

  function _removeArrow(rowIdx) {
    const entry = _arrows[rowIdx];
    if (!entry) return;
    _scene.remove(entry.mesh);
    if (entry.labelEl) entry.labelEl.remove();
    _arrows[rowIdx] = null;
  }

  // Remove all arrows and respawn one per Cabinet.rows entry.
  // Called after loading a config to sync arrow state with row state.
  function rebuildAll() {
    // Remove all existing arrows
    for (let i = 0; i < _arrows.length; i++) _removeArrow(i);
    _arrows.length = 0;
    // Spawn fresh arrows for every row in current state
    for (let i = 0; i < Cabinet.rows.length; i++) _spawnArrow(i);
    _refreshActiveIndicators();
  }

  /* ── Transform ────────────────────────────────────── */
  function _applyTransform(rowIdx) {
    const entry = _arrows[rowIdx];
    if (!entry?.mesh) return;
    const row = Cabinet.rows[rowIdx];
    if (!row) return;
    const wx = Math.round(row.origin.x / SNAP_MM) * SNAP_M;
    const wz = Math.round(row.origin.z / SNAP_MM) * SNAP_M;
    entry.mesh.position.set(wx, 0, wz);
    entry.mesh.rotation.set(0, row.angle * (Math.PI / 2), 0);
  }

  /* ── Project label to screen each frame ─────────────
     Called from the render loop via CabinetArrow.updateLabels()
  ─────────────────────────────────────────────────── */
  function updateLabels() {
    if (!_labelContainer || !Cabinet.camera) return;
    if (!_arrowCanvasRect) return;
    const rect = _arrowCanvasRect;
    for (const entry of _arrows) {
      if (!entry?.labelEl || !entry.mesh) continue;
      _arrowTmpVec.copy(entry.mesh.position).project(Cabinet.camera);
      const x = (_arrowTmpVec.x + 1) / 2 * rect.width;
      const y = (-_arrowTmpVec.y + 1) / 2 * rect.height;
      entry.labelEl.style.display = (_arrowTmpVec.z > 1) ? 'none' : 'block';
      entry.labelEl.style.left    = x + 'px';
      entry.labelEl.style.top     = y + 'px';
    }
  }

  /* ── Hit test ─────────────────────────────────────── */
  function _hitArrowIdx(clientX, clientY) {
    const rect = _canvas.getBoundingClientRect();
    const ndc  = new THREE.Vector2(
      ((clientX - rect.left) / rect.width)  * 2 - 1,
      -((clientY - rect.top)  / rect.height) * 2 + 1
    );
    _raycaster.setFromCamera(ndc, _camera);
    for (let i = 0; i < _arrows.length; i++) {
      const entry = _arrows[i];
      if (!entry?.mesh) continue;
      const hits = _raycaster.intersectObject(entry.mesh, true);
      if (hits.length > 0) return i;
    }
    return -1;
  }

  /* ── Floor raycast ────────────────────────────────── */
  function _floorPoint(clientX, clientY) {
    const rect = _canvas.getBoundingClientRect();
    const ndc  = new THREE.Vector2(
      ((clientX - rect.left) / rect.width)  * 2 - 1,
      -((clientY - rect.top)  / rect.height) * 2 + 1
    );
    _raycaster.setFromCamera(ndc, _camera);
    const hits = _raycaster.intersectObject(_floorPlane);
    return hits.length ? hits[0].point : null;
  }

  // Snap to 300 mm grid
  function _snapToGrid(worldX, worldZ) {
    return {
      snappedX: Math.round(worldX / SNAP_M) * SNAP_M,
      snappedZ: Math.round(worldZ / SNAP_M) * SNAP_M,
    };
  }

  /* ── Snap-dot grid ────────────────────────────────── */
  function _ensureSnapGroup() {
    if (_snapGroup) return;
    _snapGroup = new THREE.Group();
    _snapGroup.name = 'ArrowSnapDots';

    const geo = new THREE.CircleGeometry(DOT_R, 10);
    const mat = new THREE.MeshBasicMaterial({
      color: DOT_COLOR, transparent: true, opacity: 0.55, depthWrite: false,
    });

    const half = Math.floor(DOT_COLS / 2);
    for (let ix = -half; ix <= half; ix++) {
      for (let iz = -half; iz <= half; iz++) {
        const dot = new THREE.Mesh(geo, mat);
        dot.rotation.x = -Math.PI / 2;
        dot.position.y = 0.004;
        dot.renderOrder = 3;
        _snapGroup.add(dot);
        _snapDots.push({ dot, ix, iz });
      }
    }
    _scene.add(_snapGroup);
  }

  function _showSnapDots(centreX, centreZ) {
    _ensureSnapGroup();
    // Centre the grid on the nearest snap point to the cursor
    const cx = Math.round(centreX / SNAP_M) * SNAP_M;
    const cz = Math.round(centreZ / SNAP_M) * SNAP_M;
    for (const { dot, ix, iz } of _snapDots) {
      dot.position.x = cx + ix * SNAP_M;
      dot.position.z = cz + iz * SNAP_M;
    }
    _snapGroup.visible = true;
  }

  function _hideSnapDots() {
    if (_snapGroup) _snapGroup.visible = false;
  }

  /* ── Events ───────────────────────────────────────── */
  function _bindEvents() {
    _canvas.addEventListener('mousedown',    _onMouseDown,   true);
    _canvas.addEventListener('contextmenu',  _onContextMenu, true);
    _canvas.addEventListener('mousemove',    _onCanvasHover);
    _canvas.addEventListener('mouseleave',   _onCanvasLeave);
    window.addEventListener('mousemove',     _onMouseMove);
    window.addEventListener('mouseup',       _onMouseUp);
    document.addEventListener('mousedown',   _hideCtxMenu);
  }

  function _onCanvasHover(e) {
    if (_dragging) return;
    const arrowIdx = _hitArrowIdx(e.clientX, e.clientY);
    _canvas.style.cursor = arrowIdx >= 0 ? 'pointer' : ''; // grab set on mousedown, grabbing while dragging
  }

  function _onCanvasLeave() {
    if (!_dragging) _canvas.style.cursor = '';
  }

  function _onMouseDown(e) {
    if (e.button !== 0) return;
    _hideCtxMenu();
    const arrowIdx = _hitArrowIdx(e.clientX, e.clientY);
    if (arrowIdx < 0) return;
    // Block drag while any cabinet in any row is being edited (not yet confirmed)
    if (Cabinet.editingIdx >= 0) return;
    _dragging     = true;
    _dragArrowIdx = arrowIdx;
    _dragStarted  = false;
    _mouseDownX   = e.clientX;
    _mouseDownY   = e.clientY;
    _canvas.style.cursor = 'grab';
    e.stopPropagation();
    e.preventDefault();
  }

  function _onMouseMove(e) {
    if (!_dragging || _dragArrowIdx < 0) return;
    const dx = e.clientX - _mouseDownX;
    const dy = e.clientY - _mouseDownY;
    if (!_dragStarted && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
      _dragStarted = true;
      _canvas.style.cursor = 'grabbing';
    }
    if (_dragStarted) {
      const pt = _floorPoint(e.clientX, e.clientY);
      if (pt) {
        _showSnapDots(pt.x, pt.z);
        const { snappedX, snappedZ } = _snapToGrid(pt.x, pt.z);
        if (_arrows[_dragArrowIdx]?.mesh) {
          _arrows[_dragArrowIdx].mesh.position.set(snappedX, 0, snappedZ);
        }
        // Live overlap tint
        const testOrigin = {
          x: Math.round(snappedX / SNAP_M) * SNAP_MM,
          z: Math.round(snappedZ / SNAP_M) * SNAP_MM,
        };
        _setArrowDragTint(_dragArrowIdx, _wouldOverlap(_dragArrowIdx, testOrigin));
      }
    }
  }

  function _onMouseUp(e) {
    if (!_dragging) return;
    const arrowIdx = _dragArrowIdx;
    _dragging     = false;
    _dragArrowIdx = -1;
    _canvas.style.cursor = '';
    if (arrowIdx >= 0) {
      if (_dragStarted) {
        _hideSnapDots();
        _setArrowDragTint(arrowIdx, false); // restore normal colour
        const pt = _floorPoint(e.clientX, e.clientY);
        if (pt) {
          const { snappedX, snappedZ } = _snapToGrid(pt.x, pt.z);
          const newOrigin = {
            x: Math.round(snappedX / SNAP_M) * SNAP_MM,
            z: Math.round(snappedZ / SNAP_M) * SNAP_MM,
          };
          if (_wouldOverlap(arrowIdx, newOrigin)) {
            // Revert arrow to its previous position
            _applyTransform(arrowIdx);
            showToast('Rows cannot overlap — move rejected', 'error');
          } else {
            Cabinet.rows[arrowIdx].origin = newOrigin;
            _applyTransform(arrowIdx);
            CabinetBuilder.rebuildAllForNewOrigin();
            // Update floor grid to fit all cabinets at new positions
            if (window.CabinetFloor) CabinetFloor.update();
          }
        }
      } else {
        // Simple click (no drag) → make this row active
        Cabinet.activeRowIdx = arrowIdx;
        Cabinet.currentCabinetXOffset = _rightEdgeForRow(arrowIdx);
        _refreshActiveIndicators();
        if (typeof switchActiveRow === 'function') switchActiveRow(arrowIdx);
      }
    }
    _dragStarted = false;
  }

  function _rightEdgeForRow(rowIdx) {
    let max = 0;
    for (const cab of Cabinet.cabinets) {
      if ((cab.rowIdx ?? 0) !== rowIdx) continue;
      const p = CabinetBuilder.parseCode(cab.code);
      if (p) max = Math.max(max, cab.xOffset + p.widthMM);
    }
    return max;
  }

  /* ── Collision detection ──────────────────────────────
     Footprint accounts for both angle and flipped.
     angle=0, flipped=false: grows +X, depth +Z
     angle=0, flipped=true:  grows +X, depth -Z  (rear faces -Z)
     angle=1, flipped=false: grows -Z, depth +X
     angle=1, flipped=true:  grows -Z, depth -X  (rear faces -X)
  ─────────────────────────────────────────────────── */
  const CABINET_DEPTH_MM = 300; // physical cabinet depth (mm)
  const MIN_ROW_LEN_MM   = 600; // minimum footprint length even with no cabinets

  function _rowFootprint(rowIdx, overrideOrigin) {
    const row    = Cabinet.rows[rowIdx];
    if (!row) return null;
    const origin  = overrideOrigin ?? row.origin;
    const len     = Math.max(_rightEdgeForRow(rowIdx), MIN_ROW_LEN_MM);
    const flipped = !!row.flipped;
    if (row.angle === 0) {
      // length along X; depth along +Z (both normal and flipped — flipped adds +300mm depthShift)
      return { x0: origin.x, x1: origin.x + len, z0: origin.z, z1: origin.z + CABINET_DEPTH_MM };
    } else {
      // length along -Z; depth along +X (both normal and flipped — flipped adds +300mm depthShift)
      return { x0: origin.x, x1: origin.x + CABINET_DEPTH_MM, z0: origin.z - len, z1: origin.z };
    }
  }

  function _aabbOverlap(a, b) {
    // Strict overlap only — touching edges (back-to-back rows) are allowed
    return a.x0 < b.x1 && a.x1 > b.x0 &&
           a.z0 < b.z1 && a.z1 > b.z0;
  }

  // Returns true if rowIdx with the given origin would overlap any other row.
  function _wouldOverlap(rowIdx, overrideOrigin) {
    const fp = _rowFootprint(rowIdx, overrideOrigin);
    if (!fp) return false;
    for (let i = 0; i < Cabinet.rows.length; i++) {
      if (i === rowIdx) continue;
      const other = _rowFootprint(i);
      if (other && _aabbOverlap(fp, other)) return true;
    }
    return false;
  }

  // Tint arrow mesh to signal collision during drag
  function _setArrowDragTint(rowIdx, collides) {
    const entry = _arrows[rowIdx];
    if (!entry?.mesh) return;
    const color = collides
      ? new THREE.Color(0xe53935)                           // red — overlap
      : ((Cabinet.activeRowIdx ?? 0) === rowIdx ? COLOR_ACTIVE : COLOR_INACTIVE);
    entry.mesh.traverse(child => {
      if (child.isMesh && child.userData.arrowMatCloned) child.material.color.set(color);
    });
  }

  function _onContextMenu(e) {
    const arrowIdx = _hitArrowIdx(e.clientX, e.clientY);
    if (arrowIdx < 0) return;
    e.preventDefault();
    e.stopPropagation();
    // Block context menu while any cabinet is being edited (not yet confirmed)
    if (Cabinet.editingIdx >= 0) {
      showToast('Confirm the current cabinet before moving or rotating any row', 'error');
      return;
    }
    _showCtxMenu(e.clientX, e.clientY, arrowIdx);
  }

  /* ── Context menu ─────────────────────────────────── */
  function _showCtxMenu(cx, cy, rowIdx) {
    _hideCtxMenu();
    const menu = document.createElement('div');
    menu.style.cssText = [
      'position:fixed', `left:${cx}px`, `top:${cy}px`,
      'background:#fff', 'border:1px solid #ddd', 'border-radius:6px',
      'box-shadow:0 4px 16px rgba(0,0,0,0.14)', 'z-index:9999',
      'min-width:180px', 'font:14px "Mont",sans-serif', 'padding:4px 0',
      'user-select:none',
    ].join(';');

    const item = (text, color, fn) => {
      const el = document.createElement('div');
      el.style.cssText = `padding:8px 14px;cursor:pointer;color:${color || '#1a1a1a'};`;
      el.textContent = text;
      el.onmouseenter = () => el.style.background = color ? '#fff5f5' : '#f5f5f5';
      el.onmouseleave = () => el.style.background = '';
      el.onmousedown  = (e) => { e.stopPropagation(); _hideCtxMenu(); fn(); };
      return el;
    };

    const sep = () => {
      const d = document.createElement('div');
      d.style.cssText = 'height:1px;background:#e8e8e8;margin:2px 0;';
      return d;
    };

    menu.appendChild(item('Rotate 90°',          null,      () => _rotateRow(rowIdx)));
    menu.appendChild(item('Flip cabinets 180°',  null,      () => _flipRow(rowIdx)));
    menu.appendChild(sep());
    menu.appendChild(item('Add row',             null,      () => _addRow(rowIdx)));
    menu.appendChild(item('Duplicate row',       null,      () => _duplicateRow(rowIdx)));
    menu.appendChild(sep());
    menu.appendChild(item('Delete row',          '#c0392b', () => _confirmDeleteRow(rowIdx)));

    document.body.appendChild(menu);
    _ctxMenu = menu;

    // Clamp to viewport
    const rect = menu.getBoundingClientRect();
    if (rect.right  > window.innerWidth)  menu.style.left = (cx - rect.width)  + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top  = (cy - rect.height) + 'px';
  }

  function _hideCtxMenu() {
    if (_ctxMenu) { _ctxMenu.remove(); _ctxMenu = null; }
  }

  /* ── Row actions ──────────────────────────────────── */
  function _flipRow(rowIdx) {
    Cabinet.rows[rowIdx].flipped = !Cabinet.rows[rowIdx].flipped;
    CabinetBuilder.rebuildAllForNewOrigin();
  }

  function _rotateRow(rowIdx) {
    const prevAngle = Cabinet.rows[rowIdx].angle;
    Cabinet.rows[rowIdx].angle = prevAngle === 0 ? 1 : 0;
    if (_wouldOverlap(rowIdx)) {
      // Revert rotation
      Cabinet.rows[rowIdx].angle = prevAngle;
      showToast('Rows cannot overlap — rotation rejected', 'error');
      return;
    }
    _applyTransform(rowIdx);
    _updateArrowColor(rowIdx);
    CabinetBuilder.rebuildAllForNewOrigin();
  }

  function _addRow(fromRowIdx) {
    const fromRow  = Cabinet.rows[fromRowIdx];
    const newRowIdx = Cabinet.rows.length;

    // Offset new arrow 2 tiles perpendicular to the current row's direction
    // angle=0 (row along +X): offset new arrow along +Z (2 tiles)
    // angle=1 (row along -Z): offset new arrow along +X (2 tiles)
    const offX = fromRow.angle === 1 ? OFFSET_TILES * TILE_MM : 0;
    const offZ = fromRow.angle === 0 ? OFFSET_TILES * TILE_MM : 0;

    Cabinet.rows.push({
      id:      newRowIdx,
      origin:  { x: fromRow.origin.x + offX, z: fromRow.origin.z + offZ },
      angle:   fromRow.angle,
      flipped: false,
    });

    // Switch active row to the new one
    Cabinet.activeRowIdx = newRowIdx;
    Cabinet.currentCabinetXOffset = 0;
    _refreshActiveIndicators();

    _spawnArrow(newRowIdx);
    // Update floor grid to fit all cabinets
    if (window.CabinetFloor) CabinetFloor.update();
    showToast(`Row ${newRowIdx + 1} added — now editing row ${newRowIdx + 1}`, 'success');
  }

  async function _duplicateRow(fromRowIdx) {
    const fromRow   = Cabinet.rows[fromRowIdx];
    const newRowIdx = Cabinet.rows.length;

    // Find first non-overlapping offset perpendicular to the row direction.
    // Start at 2 tiles; if occupied, step by 2.5 tiles until free.
    let tiles = OFFSET_TILES;
    let candidateOrigin;
    for (let attempt = 0; attempt < 20; attempt++) {
      const off = tiles * TILE_MM;
      candidateOrigin = {
        x: fromRow.origin.x + (fromRow.angle === 1 ? off : 0),
        z: fromRow.origin.z + (fromRow.angle === 0 ? off : 0),
      };
      // Temporarily register the row to use _wouldOverlap
      Cabinet.rows.push({ id: newRowIdx, origin: candidateOrigin, angle: fromRow.angle, flipped: fromRow.flipped });
      const overlaps = _wouldOverlap(newRowIdx, candidateOrigin);
      Cabinet.rows.pop();
      if (!overlaps) break;
      tiles += 2.5;
    }

    Cabinet.rows.push({
      id:      newRowIdx,
      origin:  candidateOrigin,
      angle:   fromRow.angle,
      flipped: fromRow.flipped,
    });

    // Find highest ODF number across all existing cabinets
    let maxODF = 0;
    for (const cab of Cabinet.cabinets) {
      const m = cab.label?.match(/^ODF #(\d+)$/);
      if (m) maxODF = Math.max(maxODF, parseInt(m[1]));
    }

    // Deep-copy all cabinets from source row, assigned to new row with fresh labels
    const sourceCabs = Cabinet.cabinets.filter(c => (c.rowIdx ?? 0) === fromRowIdx);
    for (const cab of sourceCabs) {
      Cabinet.cabinets.push({
        ...cab,
        rowIdx:            newRowIdx,
        label:             `ODF #${++maxODF}`,
        placedAccessories: (cab.placedAccessories || []).map(a => ({ ...a })),
        placedChassis:     (cab.placedChassis     || []).map(c => ({ ...c })),
      });
    }

    // Rebuild 3D scene (includes accessories and chassis via rebuildFromState)
    await CabinetBuilder.rebuildAllCabinetsFromState();

    // Switch active row to the new one, position next cabinet at its right edge
    Cabinet.activeRowIdx = newRowIdx;
    let maxX = 0;
    for (const cab of Cabinet.cabinets) {
      if ((cab.rowIdx ?? 0) !== newRowIdx) continue;
      const p = CabinetBuilder.parseCode(cab.code);
      if (p) maxX = Math.max(maxX, cab.xOffset + p.widthMM);
    }
    Cabinet.currentCabinetXOffset = maxX;

    _refreshActiveIndicators();
    _spawnArrow(newRowIdx);
    if (window.CabinetFloor) CabinetFloor.update();
    if (window.CabinetArrow) CabinetArrow.updateLabels?.();
    if (typeof _rebuildBOM === 'function') _rebuildBOM();
    showToast(`Row ${newRowIdx + 1} duplicated from row ${fromRowIdx + 1}`, 'success');
  }

  function _confirmDeleteRow(rowIdx) {
    const rowNum = rowIdx + 1;
    const cabCount = Cabinet.cabinets.filter(c => (c.rowIdx ?? 0) === rowIdx).length;
    const msg = cabCount > 0
      ? `Delete row ${rowNum}? This will remove ${cabCount} cabinet(s). This cannot be undone.`
      : `Delete row ${rowNum}?`;

    if (!window.confirm(msg)) return;

    // If only 1 row — just clear cabinets, keep the arrow
    if (Cabinet.rows.length <= 1) {
      Cabinet.cabinets = [];
      Cabinet.currentCabinetXOffset = 0;
      Cabinet.editingIdx = -1;
      Cabinet.descriptionCode = '';
      Cabinet.isCodeValid = false;
      Cabinet.placedAccessories = [];
      CabinetBuilder.clearAll({ noFade: true });
      if (window.CabinetDrag) CabinetDrag.clearAll?.();
      Cabinet.rows[0] = { id: 0, origin: Cabinet.rows[0].origin, angle: Cabinet.rows[0].angle, flipped: false };
      Cabinet.activeRowIdx = 0;
      if (typeof _resetForNextCabinet === 'function') _resetForNextCabinet();
      if (typeof _rebuildBOM === 'function') _rebuildBOM();
      if (window.CabinetFloor) CabinetFloor.update();
      showToast('Row cleared', 'info');
      return;
    }

    // Remove the arrow mesh
    _removeArrow(rowIdx);
    _arrows.splice(rowIdx, 1);

    // Delegate the rest to cabinet-ui.js
    if (typeof deleteRow === 'function') {
      deleteRow(rowIdx).then(() => {
        // Re-index remaining arrow rowIdx references
        for (let i = rowIdx; i < _arrows.length; i++) {
          if (!_arrows[i]) continue;
          _arrows[i].rowIdx = i;
          _arrows[i].mesh.traverse(c => { if (c.isMesh) c.userData.rowIdx = i; });
          _arrows[i].mesh.name = 'CabinetArrow_' + i;
          if (_arrows[i].labelEl) _arrows[i].labelEl.dataset.arrowRowIdx = i;
        }
        _refreshActiveIndicators();
      });
    }
  }

  /* ── Visibility (for clean image renders) ────────── */
  var _arrowsHidden = false;

  function setVisible(v) {
    _arrowsHidden = !v;
    for (const entry of _arrows) {
      if (entry?.mesh) entry.mesh.visible = v;
    }
    if (!v && _snapGroup) _snapGroup.visible = false;
    if (_labelContainer) _labelContainer.style.display = v ? '' : 'none';
  }

  /* ── Public ───────────────────────────────────────── */
  return { init, updateLabels, rebuildAll, refreshActiveIndicators: _refreshActiveIndicators, setVisible };

})();
