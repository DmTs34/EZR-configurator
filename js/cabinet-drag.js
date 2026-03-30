/**
 * cabinet-drag.js
 * Drag-and-drop accessory placement + move for the EZR Cabinet Configurator.
 *
 * New placement: drag from #accGrid card → snap to attachment points.
 * Move:          hover placed accessory → click-drag → snap to new point.
 *
 * Marker / ghost colours:
 *   blue  — idle valid snap point
 *   green — nearest point, no collision  → can drop
 *   red   — nearest point, has collision → cannot drop
 *
 * Placed accessory colours:
 *   #52a394, opacity 0.6  — normal
 *   #52a394, opacity 0.9  — hovered (not dragging)
 *   blue / green / red    — while being moved
 */
window.CabinetDrag = (function () {
  'use strict';

  const COMP_ROOT      = 'components/';
  const SNAP_PX        = 80;     // screen-space snap radius (px)
  const MARKER_R       = 0.008;  // snap-sphere radius (world units)
  const COLOR_PLACED   = 0x52a394;
  const COLOR_GHOST    = 0x4c8cf5;
  const COLOR_OK       = 0x22cc55;
  const COLOR_BLOCK    = 0xff4444;
  const OPACITY_PLACED = 0.6;
  const OPACITY_HOVER  = 0.9;
  const OPACITY_MOVING = 0.4;

  let _canvas, _scene, _camera;
  const _raycaster = new THREE.Raycaster();

  // ── New-placement drag state ──────────────────────
  let _dragging    = false;
  let _dragAcc     = null;
  let _ghostEl     = null;   // HTML label
  let _ghostMesh   = null;   // transparent GLB preview (new placement only)
  let _markers     = [];
  let _snapPts     = [];
  let _nearIdx     = -1;
  let _canDrop     = false;

  // ── Move drag state ───────────────────────────────
  let _movingIdx     = -1;   // index in _placed being moved
  let _moveOriginPos = null; // THREE.Vector3, restored on cancel

  // ── Slide state (EZR_SEP_PLT-4U-horiz only) ──────
  const SEP_HORIZ_CODE = 'EZR_SEP_PLT-4U-horiz';
  const SLIDE_MAX_MM   = 53;   // allowed slide range (mm)
  const SLIDE_DETACH   = 68;   // mm from anchor → detach & re-snap
  const MM             = 0.001; // mm → Three.js world units (same as cabinet-builder)

  let _slidingIdx   = -1;    // index in _placed being slid
  let _slideOriginX = 0;     // world X of B6 anchor (m)
  let _slideNowMM   = 0;     // current offset in mm (accumulated)
  let _slideLastCX  = 0;     // screen X at last mousemove (incremental delta)
  let _slidePxPerMM = 1;     // screen pixels per 1 mm at snap depth
  let _slideMarkers = [];    // two limit-marker spheres (±SLIDE_MAX_MM)
  let _slideCanDrop = true;  // false when current slide position has a collision

  // ── Hover state ───────────────────────────────────
  let _hoveredIdx = -1;

  // ── Placed accessories ────────────────────────────
  let _placed       = []; // { accCode, snapId, mesh } — current cabinet
  let _lockedPlaced = []; // finalized (previous cabinets) — not interactive

  const _mkGeo = () => new THREE.SphereGeometry(MARKER_R, 10, 7);

  /* ══════════════════════════════════════════════════
     Public API
  ══════════════════════════════════════════════════ */
  // ── Context menu ─────────────────────────────────
  let _ctxMenu = null;  // HTML context menu element

  function init(canvas, scene, camera) {
    _canvas = canvas;
    _scene  = scene;
    _camera = camera;

    // Capture phase → fires before orbit controls
    canvas.addEventListener('mousedown',  _onCanvasDown, true);
    canvas.addEventListener('contextmenu', _onContextMenu, true);

    const grid = document.getElementById('accGrid');
    if (grid) grid.addEventListener('mousedown', _onCardDown);

    document.addEventListener('mousemove', _onMove);
    document.addEventListener('mouseup',   _onUp);
    document.addEventListener('mousedown', _hideCtxMenu); // click outside → close
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (_slidingIdx >= 0) _cancelSlide();
        else if (_dragging)   _endDrag();
      }
    });
  }

  // Finalize current cabinet accessories — make fully opaque, lock them
  // (also ends any active slide so offset is persisted before locking)
  function finalizeCurrent() {
    if (_slidingIdx >= 0) _finishSlide();
    for (const p of _placed) {
      p.mesh.traverse(c => {
        if (!c.isMesh) return;
        if (c.userData.origMat) {
          c.material = c.userData.origMat;
          c.material.transparent = false;
          c.material.opacity = 1.0;
          c.material.needsUpdate = true;
        } else {
          c.material.transparent = false;
          c.material.opacity = 1.0;
          c.material.needsUpdate = true;
        }
      });
      _lockedPlaced.push(p);
    }
    _placed = [];
  }

  // Remove current cabinet's placed accessories (called on cabinet rebuild/change)
  function clear() {
    if (_slidingIdx >= 0) { _hideSlideMarkers(); _slidingIdx = -1; }
    for (const p of _placed) _scene.remove(p.mesh);
    _placed = [];
    Cabinet.placedAccessories = [];
    if (window.CabinetUI) CabinetUI.rebuildBOM();
  }

  // Remove everything — locked + current (full project reset)
  function clearAll() {
    clear();
    for (const p of _lockedPlaced) _scene.remove(p.mesh);
    _lockedPlaced = [];
  }

  /* ══════════════════════════════════════════════════
     Context menu
  ══════════════════════════════════════════════════ */
  function _onContextMenu(e) {
    const idx = _hitPlaced(e.clientX, e.clientY);
    if (idx < 0) return;
    e.preventDefault();
    e.stopPropagation();
    _showCtxMenu(idx, e.clientX, e.clientY);
  }

  function _showCtxMenu(idx, cx, cy) {
    _hideCtxMenu();

    const menu = document.createElement('div');
    menu.style.cssText = [
      'position:fixed', `left:${cx}px`, `top:${cy}px`, 'z-index:10000',
      'background:#fff', 'border:1px solid #e0e0e0', 'border-radius:6px',
      'box-shadow:0 4px 16px rgba(0,0,0,.15)', 'overflow:hidden',
      'font-size:13px', 'min-width:140px',
    ].join(';');

    const itemRotate = document.createElement('div');
    itemRotate.style.cssText = 'padding:8px 14px;cursor:pointer;color:#1a1a1a;';
    itemRotate.textContent = 'Rotate 180°';
    itemRotate.onmouseenter = () => itemRotate.style.background = '#f5f5f5';
    itemRotate.onmouseleave = () => itemRotate.style.background = '';
    itemRotate.onmousedown  = (e) => { e.stopPropagation(); _rotateAccessory(idx); _hideCtxMenu(); };

    const sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:#e8e8e8;margin:2px 0;';

    const itemRemove = document.createElement('div');
    itemRemove.style.cssText = 'padding:8px 14px;cursor:pointer;color:#c0392b;font-weight:500;';
    itemRemove.textContent = 'Remove accessory';
    itemRemove.onmouseenter = () => itemRemove.style.background = '#fff5f5';
    itemRemove.onmouseleave = () => itemRemove.style.background = '';
    itemRemove.onmousedown  = (e) => { e.stopPropagation(); _removeAccessory(idx); _hideCtxMenu(); };

    menu.appendChild(itemRotate);
    menu.appendChild(sep);
    menu.appendChild(itemRemove);
    document.body.appendChild(menu);
    _ctxMenu = menu;
  }

  function _hideCtxMenu() {
    if (_ctxMenu) { _ctxMenu.remove(); _ctxMenu = null; }
  }

  function _rotateAccessory(idx) {
    _placed[idx].mesh.rotation.z += Math.PI;
  }

  function _removeAccessory(idx) {
    const p = _placed[idx];
    _scene.remove(p.mesh);
    _placed.splice(idx, 1);
    Cabinet.placedAccessories.splice(idx, 1);
    if (window.CabinetUI) CabinetUI.rebuildBOM();
    if (_hoveredIdx === idx) { _hoveredIdx = -1; _canvas.style.cursor = ''; }
  }

  /* ══════════════════════════════════════════════════
     Canvas mousedown — start MOVE drag
  ══════════════════════════════════════════════════ */
  function _onCanvasDown(e) {
    if (e.button !== 0 || _dragging) return;

    // In slide mode: any click finalizes the current slide
    if (_slidingIdx >= 0) {
      e.stopPropagation();
      e.preventDefault();
      _finishSlide();
      return;
    }

    const idx = _hitPlaced(e.clientX, e.clientY);
    if (idx < 0) return;
    // Prevent orbit controls from starting
    e.stopPropagation();
    e.preventDefault();
    if (_placed[idx].accCode === SEP_HORIZ_CODE) {
      _startSlide(idx, e.clientX, e.clientY);
    } else {
      _startMoveDrag(idx, e.clientX, e.clientY);
    }
  }

  function _startMoveDrag(idx, cx, cy) {
    _dragging   = true;
    _movingIdx  = idx;
    _dragAcc    = _placed[idx].accCode;
    _moveOriginPos = _placed[idx].mesh.position.clone();

    // Style moving mesh as ghost
    _placed[idx].mesh.traverse(c => {
      if (c.isMesh) { c.material.color.setHex(COLOR_GHOST); c.material.opacity = OPACITY_MOVING; }
    });

    _ghostEl = _makeGhostLabel(_dragAcc, cx, cy);

    _snapPts = CabinetBuilder.getSnapPoints(Cabinet.descriptionCode, _dragAcc, Cabinet.currentCabinetXOffset);
    _showMarkers();
  }

  /* ══════════════════════════════════════════════════
     AccGrid mousedown — start NEW PLACEMENT drag
  ══════════════════════════════════════════════════ */
  function _onCardDown(e) {
    if (e.button !== 0) return;
    const card = e.target.closest('.acc-card');
    const code = card?.dataset.accCode;
    if (!code || !Cabinet.descriptionCode) return;
    if (!CabinetBuilder.getSnapPoints) return;
    e.preventDefault();
    if (_slidingIdx >= 0) _cancelSlide(); // exit slide mode before starting a new drag
    _startNewDrag(code, e.clientX, e.clientY);
  }

  function _startNewDrag(accCode, cx, cy) {
    _dragging   = true;
    _movingIdx  = -1;
    _dragAcc    = accCode;

    _ghostEl = _makeGhostLabel(accCode, cx, cy);
    _snapPts = CabinetBuilder.getSnapPoints(Cabinet.descriptionCode, accCode, Cabinet.currentCabinetXOffset);
    _showMarkers();
    _loadGhost(accCode);
  }

  /* ══════════════════════════════════════════════════
     Mouse move
  ══════════════════════════════════════════════════ */
  function _onMove(e) {
    if (_slidingIdx >= 0) {
      _updateSlide(e.clientX, e.clientY);
    } else if (_dragging) {
      _moveGhostLabel(e.clientX, e.clientY);
      _updateSnap(e.clientX, e.clientY);
    } else {
      _updateHover(e.clientX, e.clientY);
    }
  }

  function _updateSnap(cx, cy) {
    const rect = _canvas.getBoundingClientRect();
    const inCanvas = cx >= rect.left && cx <= rect.right
                  && cy >= rect.top  && cy <= rect.bottom;

    if (!inCanvas || !_snapPts.length) { _setNearest(-1); return; }

    const mx = cx - rect.left, my = cy - rect.top;
    let best = -1, bestD2 = Infinity;
    for (let i = 0; i < _snapPts.length; i++) {
      const s  = _worldToScreen(_snapPts[i].position, rect);
      const d2 = (s.x - mx) ** 2 + (s.y - my) ** 2;
      if (d2 < bestD2) { bestD2 = d2; best = i; }
    }
    _setNearest(bestD2 < SNAP_PX ** 2 ? best : -1);
  }

  function _setNearest(idx) {
    _nearIdx = idx;
    _canDrop = false;

    const activeMesh = _movingIdx >= 0 ? _placed[_movingIdx].mesh : _ghostMesh;

    if (idx >= 0) {
      _canDrop = _checkCollision(idx);
      if (activeMesh) {
        activeMesh.position.copy(_snapPts[idx].position);
        activeMesh.visible = true;
        const col = _canDrop ? COLOR_OK : COLOR_BLOCK;
        activeMesh.traverse(c => { if (c.isMesh) c.material.color.setHex(col); });
      }
    } else {
      if (activeMesh) {
        if (_movingIdx >= 0) {
          // While moving, park at origin so it's out of the way visually
          activeMesh.position.copy(_moveOriginPos);
          activeMesh.traverse(c => { if (c.isMesh) c.material.color.setHex(COLOR_GHOST); });
        } else {
          activeMesh.visible = false;
        }
      }
    }

    _markers.forEach((m, i) => {
      if (i === idx) {
        m.material.color.setHex(_canDrop ? COLOR_OK : COLOR_BLOCK);
        m.material.opacity = 1.0;
      } else {
        m.material.color.setHex(COLOR_GHOST);
        m.material.opacity = 0.8;
      }
    });
  }

  /* ══════════════════════════════════════════════════
     Hover highlight (when not dragging)
  ══════════════════════════════════════════════════ */
  function _updateHover(cx, cy) {
    const rect = _canvas.getBoundingClientRect();
    const inCanvas = cx >= rect.left && cx <= rect.right
                  && cy >= rect.top  && cy <= rect.bottom;

    const idx = inCanvas ? _hitPlaced(cx, cy) : -1;
    if (idx === _hoveredIdx) return;

    // Restore previous
    if (_hoveredIdx >= 0 && _hoveredIdx < _placed.length) {
      _setPlacedOpacity(_placed[_hoveredIdx].mesh, OPACITY_PLACED);
    }
    // Highlight new
    if (idx >= 0) {
      _setPlacedOpacity(_placed[idx].mesh, OPACITY_HOVER);
      _canvas.style.cursor = _placed[idx].accCode === SEP_HORIZ_CODE ? 'ew-resize' : 'grab';
    } else {
      _canvas.style.cursor = '';
    }
    _hoveredIdx = idx;
  }

  /* ══════════════════════════════════════════════════
     Mouse up / drop
  ══════════════════════════════════════════════════ */
  function _onUp() {
    if (_slidingIdx >= 0) return; // slide is click-to-enter / click-to-exit, not hold-and-drag
    if (!_dragging) return;

    if (_movingIdx >= 0) {
      _finishMove();
    } else {
      if (_nearIdx >= 0 && _canDrop) _placeAccessory(_dragAcc, _snapPts[_nearIdx]);
    }
    _endDrag();
  }

  function _finishMove() {
    const p = _placed[_movingIdx];

    if (_nearIdx >= 0 && _canDrop) {
      const snap = _snapPts[_nearIdx];
      p.mesh.position.copy(snap.position);
      p.snapId = snap.id;
      Cabinet.placedAccessories[_movingIdx].snapId = snap.id;
      // Reset slide offset — new snap point is the new anchor at offset 0
      if (p.accCode === SEP_HORIZ_CODE) {
        p.slideOffset = 0;
        if (Cabinet.placedAccessories[_movingIdx])
          Cabinet.placedAccessories[_movingIdx].slideOffset = 0;
      }
    } else {
      // Cancelled — restore original position
      p.mesh.position.copy(_moveOriginPos);
    }

    // Restore placed appearance
    p.mesh.visible = true;
    p.mesh.traverse(c => {
      if (c.isMesh) { c.material.color.setHex(COLOR_PLACED); c.material.opacity = OPACITY_PLACED; }
    });

    _movingIdx     = -1;
    _moveOriginPos = null;
  }

  /* ══════════════════════════════════════════════════
     New placement
  ══════════════════════════════════════════════════ */
  async function _placeAccessory(accCode, snap) {
    const Loader = THREE.GLTFLoader || window.GLTFLoader;
    if (!Loader) return;
    try {
      const gltf = await new Promise((res, rej) =>
        new Loader().load(`${COMP_ROOT}${accCode}.glb`, res, undefined, rej));
      const mesh = gltf.scene;
      mesh.traverse(c => {
        if (!c.isMesh) return;
        c.userData.origMat = c.material;
        c.material = new THREE.MeshStandardMaterial(
          { color: COLOR_PLACED, transparent: true, opacity: OPACITY_PLACED });
      });
      mesh.position.copy(snap.position);
      mesh.userData.isPlaced = true;
      _scene.add(mesh);
      const slideOffset = accCode === SEP_HORIZ_CODE ? 0 : undefined;
      _placed.push({ accCode, snapId: snap.id, mesh, slideOffset, rotated: false });
      Cabinet.placedAccessories.push({ code: accCode, snapId: snap.id, slideOffset });
      if (window.CabinetUI) CabinetUI.rebuildBOM();
    } catch (e) {
      console.warn('[CabinetDrag] Could not place accessory:', e.message);
    }
  }

  /* ══════════════════════════════════════════════════
     Slide mode (EZR_SEP_PLT-4U-horiz)
  ══════════════════════════════════════════════════ */
  function _startSlide(idx, cx, cy) {
    const mesh = _placed[idx].mesh;

    _slidingIdx   = idx;
    _slideNowMM   = _placed[idx].slideOffset || 0;
    _slideLastCX  = cx;
    // Anchor X = mesh X minus the currently stored offset
    _slideOriginX = mesh.position.x - _slideNowMM * MM;

    // Compute signed screen pixels per 1 mm (preserves direction relative to camera).
    // Using 100 mm span for better precision at any zoom level.
    const rect = _canvas.getBoundingClientRect();
    const p1 = new THREE.Vector3(_slideOriginX - 50 * MM, mesh.position.y, mesh.position.z);
    const p2 = new THREE.Vector3(_slideOriginX + 50 * MM, mesh.position.y, mesh.position.z);
    const s1 = _worldToScreen(p1, rect);
    const s2 = _worldToScreen(p2, rect);
    // Signed: positive → world +X projects to screen right; negative → flipped
    _slidePxPerMM = (s2.x - s1.x) / 100;
    // Guard against degenerate camera angles (|ratio| < 0.1 px/mm)
    if (Math.abs(_slidePxPerMM) < 0.1) _slidePxPerMM = 0.5;

    _slideCanDrop = true;
    _setPlacedOpacity(mesh, 0.35);
    _placed[idx].mesh.traverse(c => { if (c.isMesh) c.material.color.setHex(COLOR_PLACED); });
    _canvas.style.cursor = 'ew-resize';
    _showSlideMarkers(mesh.position.y, mesh.position.z);
  }

  function _updateSlide(cx, cy) {
    // Incremental delta — works correctly whether button is held or not
    const deltaMM = (cx - _slideLastCX) / _slidePxPerMM;
    _slideLastCX  = cx;
    _slideNowMM  += deltaMM;

    // Exceeded detach threshold → break free, enter regular move drag
    if (Math.abs(_slideNowMM) > SLIDE_DETACH) {
      const idx = _slidingIdx;
      // Park mesh at the limit, clear offset — _finishMove will set a fresh anchor
      _placed[idx].mesh.position.x = _slideOriginX + ((_slideNowMM > 0 ? 1 : -1) * SLIDE_MAX_MM) * MM;
      _placed[idx].slideOffset = 0;
      if (Cabinet.placedAccessories[idx])
        Cabinet.placedAccessories[idx].slideOffset = 0;
      _hideSlideMarkers();
      _slidingIdx = -1;
      _canvas.style.cursor = '';
      _setPlacedOpacity(_placed[idx].mesh, OPACITY_PLACED);
      _startMoveDrag(idx, cx, cy);
      return;
    }

    const clampedMM = Math.max(-SLIDE_MAX_MM, Math.min(SLIDE_MAX_MM, _slideNowMM));
    _placed[_slidingIdx].mesh.position.x = _slideOriginX + clampedMM * MM;

    // Collision check
    _slideCanDrop = _checkSlideCollision(_slidingIdx);
    _placed[_slidingIdx].mesh.traverse(c => {
      if (c.isMesh) c.material.color.setHex(_slideCanDrop ? COLOR_PLACED : COLOR_BLOCK);
    });

    // Limit markers: red near edge or when collision
    const nearLimit = Math.abs(clampedMM) > SLIDE_MAX_MM * 0.8;
    _slideMarkers.forEach(m => m.material.color.setHex(
      (!_slideCanDrop || nearLimit) ? 0xef4444 : 0xf59e0b));
  }

  function _finishSlide() {
    if (_slidingIdx < 0) return;
    // Block placement when in collision — cancel instead
    if (!_slideCanDrop) { _cancelSlide(); return; }
    const idx = _slidingIdx;
    const clampedMM = Math.max(-SLIDE_MAX_MM, Math.min(SLIDE_MAX_MM, _slideNowMM));
    _placed[idx].mesh.position.x = _slideOriginX + clampedMM * MM;
    _placed[idx].slideOffset = clampedMM;
    if (Cabinet.placedAccessories[idx])
      Cabinet.placedAccessories[idx].slideOffset = clampedMM;
    _setPlacedOpacity(_placed[idx].mesh, OPACITY_PLACED);
    _placed[idx].mesh.traverse(c => { if (c.isMesh) c.material.color.setHex(COLOR_PLACED); });
    _hideSlideMarkers();
    _slideCanDrop = true;
    _slidingIdx = -1;
    _canvas.style.cursor = '';
  }

  function _cancelSlide() {
    if (_slidingIdx < 0) return;
    const idx = _slidingIdx;
    // Restore to the offset that was stored before entering slide mode
    const storedMM = _placed[idx].slideOffset || 0;
    _placed[idx].mesh.position.x = _slideOriginX + storedMM * MM;
    _placed[idx].mesh.traverse(c => { if (c.isMesh) c.material.color.setHex(COLOR_PLACED); });
    _setPlacedOpacity(_placed[idx].mesh, OPACITY_PLACED);
    _hideSlideMarkers();
    _slideCanDrop = true;
    _slidingIdx = -1;
    _canvas.style.cursor = '';
  }

  function _showSlideMarkers(worldY, worldZ) {
    const geo = _mkGeo();
    for (const sign of [-1, 1]) {
      const mat = new THREE.MeshBasicMaterial(
        { color: 0xf59e0b, transparent: true, opacity: 0.75, depthTest: false });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(_slideOriginX + sign * SLIDE_MAX_MM * MM, worldY, worldZ);
      m.renderOrder = 5;
      _scene.add(m);
      _slideMarkers.push(m);
    }
  }

  function _hideSlideMarkers() {
    for (const m of _slideMarkers) { m.material.dispose(); _scene.remove(m); }
    _slideMarkers = [];
  }

  /* ══════════════════════════════════════════════════
     End drag cleanup
  ══════════════════════════════════════════════════ */
  function _endDrag() {
    _dragging  = false;
    _dragAcc   = null;
    _nearIdx   = -1;
    _canDrop   = false;
    _hoveredIdx = -1;
    _canvas.style.cursor = '';

    if (_ghostEl)   { _ghostEl.remove();          _ghostEl   = null; }
    if (_ghostMesh) { _scene.remove(_ghostMesh);  _ghostMesh = null; }
    _hideMarkers();
    _snapPts = [];
  }

  /* ══════════════════════════════════════════════════
     Collision detection
  ══════════════════════════════════════════════════ */
  // Collision check for slide mode — tests current mesh position against everything else
  function _checkSlideCollision(slidingIdx) {
    const mesh = _placed[slidingIdx].mesh;
    mesh.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(mesh);

    const boxes = [];
    _scene.traverse(obj => {
      if (obj.userData.isAccessory) boxes.push(new THREE.Box3().setFromObject(obj));
    });
    for (const p of _lockedPlaced) {
      boxes.push(new THREE.Box3().setFromObject(p.mesh));
    }
    for (let i = 0; i < _placed.length; i++) {
      if (i === slidingIdx) continue; // skip self
      boxes.push(new THREE.Box3().setFromObject(_placed[i].mesh));
    }
    return !boxes.some(b => b.intersectsBox(box));
  }

  function _checkCollision(idx) {
    const activeMesh = _movingIdx >= 0 ? _placed[_movingIdx].mesh : _ghostMesh;
    if (!activeMesh) return true;

    activeMesh.position.copy(_snapPts[idx].position);
    activeMesh.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(activeMesh);

    return !_occupiedBoxes().some(b => b.intersectsBox(box));
  }

  function _occupiedBoxes() {
    const boxes = [];
    _scene.traverse(obj => {
      if (obj.userData.isAccessory) boxes.push(new THREE.Box3().setFromObject(obj));
    });
    for (const p of _lockedPlaced) {
      boxes.push(new THREE.Box3().setFromObject(p.mesh));
    }
    for (let i = 0; i < _placed.length; i++) {
      if (i === _movingIdx) continue;
      boxes.push(new THREE.Box3().setFromObject(_placed[i].mesh));
    }
    return boxes;
  }

  /* ══════════════════════════════════════════════════
     Markers
  ══════════════════════════════════════════════════ */
  function _showMarkers() {
    const geo = _mkGeo();
    for (const sp of _snapPts) {
      const mat = new THREE.MeshBasicMaterial(
        { color: COLOR_GHOST, transparent: true, opacity: 0.8, depthTest: false });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(sp.position);
      m.renderOrder = 5;
      _scene.add(m);
      _markers.push(m);
    }
  }

  function _hideMarkers() {
    for (const m of _markers) { m.material.dispose(); _scene.remove(m); }
    _markers = [];
  }

  /* ══════════════════════════════════════════════════
     3D ghost mesh (new placement only)
  ══════════════════════════════════════════════════ */
  async function _loadGhost(accCode) {
    const Loader = THREE.GLTFLoader || window.GLTFLoader;
    if (!Loader) return;
    try {
      const gltf = await new Promise((res, rej) =>
        new Loader().load(`${COMP_ROOT}${accCode}.glb`, res, undefined, rej));
      _ghostMesh = gltf.scene;
      _ghostMesh.traverse(c => {
        if (c.isMesh) c.material = new THREE.MeshStandardMaterial(
          { color: COLOR_GHOST, transparent: true, opacity: OPACITY_MOVING });
      });
      _ghostMesh.visible = false;
      _scene.add(_ghostMesh);
    } catch { /* ghost is optional */ }
  }

  /* ══════════════════════════════════════════════════
     Raycast helpers
  ══════════════════════════════════════════════════ */
  function _hitPlaced(cx, cy) {
    if (!_placed.length) return -1;
    const rect = _canvas.getBoundingClientRect();
    _raycaster.setFromCamera({
      x:  ((cx - rect.left) / rect.width)  * 2 - 1,
      y: -((cy - rect.top)  / rect.height) * 2 + 1,
    }, _camera);

    const meshes = [];
    for (const p of _placed) p.mesh.traverse(c => { if (c.isMesh) meshes.push(c); });
    const hits = _raycaster.intersectObjects(meshes, false);
    if (!hits.length) return -1;

    const hitObj = hits[0].object;
    for (let i = 0; i < _placed.length; i++) {
      let found = false;
      _placed[i].mesh.traverse(c => { if (c === hitObj) found = true; });
      if (found) return i;
    }
    return -1;
  }

  /* ══════════════════════════════════════════════════
     Misc helpers
  ══════════════════════════════════════════════════ */
  function _makeGhostLabel(text, cx, cy) {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed', 'pointer-events:none', 'z-index:9999',
      'background:#fff', 'border:2px solid #4c8cf5', 'border-radius:6px',
      'padding:4px 10px', 'font-size:11px', 'font-weight:600', 'color:#2563eb',
      'box-shadow:0 4px 16px rgba(0,0,0,.2)', 'white-space:nowrap',
    ].join(';');
    el.textContent = text;
    document.body.appendChild(el);
    _moveGhostLabel(cx, cy, el);
    return el;
  }

  function _moveGhostLabel(cx, cy, el) {
    const e = el || _ghostEl;
    if (e) { e.style.left = (cx + 14) + 'px'; e.style.top = (cy + 14) + 'px'; }
  }

  function _worldToScreen(pos, rect) {
    const v = pos.clone().project(_camera);
    return { x: (v.x + 1) / 2 * rect.width, y: (-v.y + 1) / 2 * rect.height };
  }

  function _setPlacedOpacity(mesh, opacity) {
    mesh.traverse(c => { if (c.isMesh) c.material.opacity = opacity; });
  }

  return { init, clear, clearAll, finalizeCurrent };
})();
