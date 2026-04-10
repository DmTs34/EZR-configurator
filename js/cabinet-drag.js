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
  let _ctrlHeld      = false;

  // ── Pending mousedown state ───────────────────────
  let _mouseDownIdx  = -1;   // accessory hit on mousedown (pending click vs drag)
  let _mouseDownX    = 0;
  let _mouseDownY    = 0;
  let _mouseDownCtrl = false; // was Ctrl held at mousedown
  const DRAG_THRESHOLD = 5;  // px — movement to distinguish click from drag

  const MM = 0.001; // mm → Three.js world units (same as cabinet-builder)

  // ── Hover state ───────────────────────────────────
  let _hoveredIdx = -1;
  let _hoveredMat = false; // true when cursor is over a locked-cabinet highlight mat

  // ── Placed accessories ────────────────────────────
  let _placed       = []; // { accCode, snapId, mesh } — current cabinet
  let _lockedPlaced = []; // finalized (previous cabinets) — not interactive

  // ── GLB cache ─────────────────────────────────────
  const _glbCache = {};
  function _loadGLB(code) {
    const path = `${COMP_ROOT}${code}.glb`;
    if (_glbCache[path]) return Promise.resolve(_glbCache[path].clone(true));
    const LC = THREE.GLTFLoader || window.GLTFLoader;
    return new Promise((resolve, reject) =>
      new LC().load(path, gltf => {
        const g = gltf.scene;
        g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.set(1, 1, 1);
        _glbCache[path] = g;
        resolve(g.clone(true));
      }, undefined, reject)
    );
  }

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

    // Label overlay contextmenu — fired via custom event from builder
    window.addEventListener('cabinetLabelContextMenu', (e) => {
      _showRenameDlg(e.detail.cabinetIdx);
    });

    const grid = document.getElementById('accGrid');
    if (grid) grid.addEventListener('mousedown', _onCardDown);

    document.addEventListener('mousemove', _onMove);
    document.addEventListener('mouseup',   _onUp);
    document.addEventListener('mousedown', _hideCtxMenu); // click outside → close
    // Prevent browser native drag from interfering with Ctrl+drag copy
    canvas.addEventListener('dragstart', e => e.preventDefault());
    document.addEventListener('keydown', e => {
      if (e.key === 'Control') {
        _ctrlHeld = true;
        if (_hoveredIdx >= 0 && !_dragging)
          _canvas.style.cursor = 'copy';
      }
      if (e.key === 'Escape') {
        if (_dragging) _endDrag();
      }
    });
    document.addEventListener('keyup', e => {
      if (e.key === 'Control') {
        _ctrlHeld = false;
        if (_hoveredIdx >= 0 && !_dragging)
          _canvas.style.cursor = 'grab';
      }
    });
  }

  // Finalize current cabinet accessories — make fully opaque, lock them
  function finalizeCurrent() {
    if (window.CabinetBuilder) CabinetBuilder.clearHighlight();
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
    // Check if clicking on a cabinet
    const cabinetIdx = _hitHighlightMat(e.clientX, e.clientY);
    if (cabinetIdx >= 0) {
      e.preventDefault();
      e.stopPropagation();
      _showCabinetCtxMenu(cabinetIdx, e.clientX, e.clientY);
      return;
    }

    // Check if clicking on an accessory
    const accIdx = _hitPlaced(e.clientX, e.clientY);
    if (accIdx < 0) return;
    e.preventDefault();
    e.stopPropagation();
    _showCtxMenu(accIdx, e.clientX, e.clientY);
  }

  function _onLabelContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    const cabinetIdx = parseInt(e.currentTarget.dataset.cabinetIdx ?? '-1');
    if (cabinetIdx < 0) return;
    _showRenameDlg(cabinetIdx);
  }

  function _showRenameDlg(cabinetIdx) {
    const current = Cabinet.cabinets[cabinetIdx]?.label || `ODF #${cabinetIdx + 1}`;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.25);';

    const dlg = document.createElement('div');
    dlg.style.cssText = 'background:#fff;border-radius:10px;padding:24px 28px;box-shadow:0 8px 32px rgba(0,0,0,.18);min-width:300px;font-family:Mont,sans-serif;';

    const title = document.createElement('div');
    title.textContent = 'Rename cabinet';
    title.style.cssText = 'font-size:15px;font-weight:600;margin-bottom:16px;color:#1a1a1a;';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.style.cssText = 'width:100%;box-sizing:border-box;padding:8px 10px;font-size:14px;border:1px solid #d0d0d0;border-radius:6px;outline:none;font-family:inherit;';

    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:16px;';

    const btnCancel = document.createElement('button');
    btnCancel.textContent = 'Cancel';
    btnCancel.style.cssText = 'padding:7px 16px;border:1px solid #d0d0d0;border-radius:6px;background:#fff;cursor:pointer;font-size:13px;';

    const btnOk = document.createElement('button');
    btnOk.textContent = 'Rename';
    btnOk.style.cssText = 'padding:7px 16px;border:none;border-radius:6px;background:#2a7ae4;color:#fff;cursor:pointer;font-size:13px;font-weight:600;';

    const confirm = () => {
      const val = input.value.trim();
      if (val) {
        Cabinet.cabinets[cabinetIdx].label = val;
        CabinetBuilder.updateLabel(cabinetIdx, val);
      }
      overlay.remove();
    };

    btnOk.onclick     = confirm;
    btnCancel.onclick = () => overlay.remove();
    input.onkeydown   = (e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') overlay.remove(); };
    overlay.onclick   = (e) => { if (e.target === overlay) overlay.remove(); };

    btns.appendChild(btnCancel);
    btns.appendChild(btnOk);
    dlg.appendChild(title);
    dlg.appendChild(input);
    dlg.appendChild(btns);
    overlay.appendChild(dlg);
    document.body.appendChild(overlay);
    setTimeout(() => { input.focus(); input.select(); }, 0);
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

  function _showCabinetCtxMenu(cabinetIdx, cx, cy) {
    _hideCtxMenu();

    const menu = document.createElement('div');
    menu.style.cssText = [
      'position:fixed', `left:${cx}px`, `top:${cy}px`, 'z-index:10000',
      'background:#fff', 'border:1px solid #e0e0e0', 'border-radius:6px',
      'box-shadow:0 4px 16px rgba(0,0,0,.15)', 'overflow:hidden',
      'font-size:13px', 'min-width:140px',
    ].join(';');

    const itemDuplicate = document.createElement('div');
    itemDuplicate.style.cssText = 'padding:8px 14px;cursor:pointer;color:#1a1a1a;';
    itemDuplicate.textContent = 'Duplicate cabinet';
    itemDuplicate.onmouseenter = () => itemDuplicate.style.background = '#f5f5f5';
    itemDuplicate.onmouseleave = () => itemDuplicate.style.background = '';
    itemDuplicate.onmousedown  = (e) => { e.stopPropagation(); _duplicateCabinet(cabinetIdx); _hideCtxMenu(); };

    const itemClone = document.createElement('div');
    itemClone.style.cssText = 'padding:8px 14px;cursor:pointer;color:#1a1a1a;';
    itemClone.textContent = 'Clone cabinet';
    itemClone.onmouseenter = () => itemClone.style.background = '#f5f5f5';
    itemClone.onmouseleave = () => itemClone.style.background = '';
    itemClone.onmousedown  = (e) => { e.stopPropagation(); _cloneCabinet(cabinetIdx); _hideCtxMenu(); };

    const sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:#e8e8e8;margin:2px 0;';

    const itemDelete = document.createElement('div');
    itemDelete.style.cssText = 'padding:8px 14px;cursor:pointer;color:#c0392b;font-weight:500;';
    itemDelete.textContent = 'Delete cabinet';
    itemDelete.onmouseenter = () => itemDelete.style.background = '#fff5f5';
    itemDelete.onmouseleave = () => itemDelete.style.background = '';
    itemDelete.onmousedown  = (e) => { e.stopPropagation(); _showDeleteConfirmation(cabinetIdx); _hideCtxMenu(); };

    menu.appendChild(itemDuplicate);
    menu.appendChild(itemClone);
    menu.appendChild(sep);
    menu.appendChild(itemDelete);
    document.body.appendChild(menu);
    _ctxMenu = menu;
  }

  function _duplicateCabinet(cabinetIdx) {
    const cabinet = Cabinet.cabinets[cabinetIdx];
    if (!cabinet) return;

    // Always place duplicate in the active row
    const targetRowIdx = Cabinet.activeRowIdx ?? 0;

    // Find all cabinets in the active row and calculate total width
    const rowCabinets = Cabinet.cabinets.filter(c => c.rowIdx === targetRowIdx);
    let maxXEnd = 0;
    for (const cab of rowCabinets) {
      const widthMM = parseInt(cab.code.split('-')[2].slice(0, 2)) * 100;
      const xEnd = cab.xOffset + widthMM;
      if (xEnd > maxXEnd) maxXEnd = xEnd;
    }

    // Copy manually placed accessories from the original cabinet
    // If the cabinet is currently being edited, use the global placedAccessories
    // Otherwise use the accessories stored in the cabinet object
    let accessoriesToCopy = [];
    if (Cabinet.editingIdx === cabinetIdx && Cabinet.placedAccessories) {
      accessoriesToCopy = [...Cabinet.placedAccessories];
    } else if (cabinet.placedAccessories) {
      accessoriesToCopy = [...cabinet.placedAccessories];
    }

    let chassisToCopy = [];
    if (Cabinet.editingIdx === cabinetIdx && Cabinet.placedChassis) {
      chassisToCopy = [...Cabinet.placedChassis];
    } else if (cabinet.placedChassis) {
      chassisToCopy = [...cabinet.placedChassis];
    }

    // Create a new cabinet with the same code, positioned at the end of the active row
    const newCabinet = {
      code: cabinet.code,
      xOffset: maxXEnd,
      rowIdx: targetRowIdx,
      placedAccessories: accessoriesToCopy,
      placedChassis: chassisToCopy,
      label: `ODF #${Cabinet.cabinets.length + 1}`,
    };

    Cabinet.cabinets.push(newCabinet);

    // Rebuild the scene to include the new cabinet
    if (window.CabinetBuilder && window.CabinetBuilder.rebuildAllCabinetsFromState) {
      CabinetBuilder.rebuildAllCabinetsFromState();
    }

    if (window.CabinetUI && window.CabinetUI.updateCabinetList) {
      CabinetUI.updateCabinetList();
    }

    // Update floor to fit all cabinets
    if (window.CabinetFloor && window.CabinetFloor.update) {
      CabinetFloor.update();
    }
  }

  function _cloneCabinet(cabinetIdx) {
    const cabinet = Cabinet.cabinets[cabinetIdx];
    if (!cabinet) return;

    // Ensure source has a cloneGroupId
    if (!cabinet.cloneGroupId) {
      cabinet.cloneGroupId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    const targetRowIdx = Cabinet.activeRowIdx ?? 0;
    const rowCabinets  = Cabinet.cabinets.filter(c => c.rowIdx === targetRowIdx);
    let maxXEnd = 0;
    for (const cab of rowCabinets) {
      const widthMM = parseInt(cab.code.split('-')[2].slice(0, 2)) * 100;
      const xEnd = cab.xOffset + widthMM;
      if (xEnd > maxXEnd) maxXEnd = xEnd;
    }

    let accessoriesToCopy = [];
    if (Cabinet.editingIdx === cabinetIdx && Cabinet.placedAccessories) {
      accessoriesToCopy = [...Cabinet.placedAccessories];
    } else if (cabinet.placedAccessories) {
      accessoriesToCopy = [...cabinet.placedAccessories];
    }

    let chassisToCopy = [];
    if (Cabinet.editingIdx === cabinetIdx && Cabinet.placedChassis) {
      chassisToCopy = [...Cabinet.placedChassis];
    } else if (cabinet.placedChassis) {
      chassisToCopy = [...cabinet.placedChassis];
    }

    const newCabinet = {
      code: cabinet.code,
      xOffset: maxXEnd,
      rowIdx: targetRowIdx,
      placedAccessories: accessoriesToCopy,
      placedChassis: chassisToCopy,
      label: `ODF #${Cabinet.cabinets.length + 1}`,
      cloneGroupId: cabinet.cloneGroupId,
    };

    Cabinet.cabinets.push(newCabinet);

    if (window.CabinetBuilder?.rebuildAllCabinetsFromState) CabinetBuilder.rebuildAllCabinetsFromState();
    if (window.CabinetUI?.updateCabinetList)               CabinetUI.updateCabinetList();
    if (window.CabinetFloor?.update)                       CabinetFloor.update();
  }

  function _showDeleteConfirmation(cabinetIdx) {
    const cabinet = Cabinet.cabinets[cabinetIdx];
    if (!cabinet) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.25);';

    const dlg = document.createElement('div');
    dlg.style.cssText = 'background:#fff;border-radius:10px;padding:24px 28px;box-shadow:0 8px 32px rgba(0,0,0,.18);min-width:320px;font-family:Mont,sans-serif;';

    const title = document.createElement('div');
    title.textContent = 'Delete cabinet';
    title.style.cssText = 'font-size:15px;font-weight:600;margin-bottom:12px;color:#1a1a1a;';

    const msg = document.createElement('div');
    msg.textContent = `Are you sure you want to delete this cabinet? This action cannot be undone.`;
    msg.style.cssText = 'font-size:13px;color:#666;margin-bottom:20px;line-height:1.4;';

    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';

    const btnCancel = document.createElement('button');
    btnCancel.textContent = 'Cancel';
    btnCancel.style.cssText = 'padding:7px 16px;border:1px solid #d0d0d0;border-radius:6px;background:#fff;cursor:pointer;font-size:13px;';
    btnCancel.onclick = () => overlay.remove();

    const btnDelete = document.createElement('button');
    btnDelete.textContent = 'Delete';
    btnDelete.style.cssText = 'padding:7px 16px;border:none;border-radius:6px;background:#c0392b;color:#fff;cursor:pointer;font-size:13px;font-weight:600;';
    btnDelete.onclick = () => {
      _deleteCabinet(cabinetIdx);
      overlay.remove();
    };

    btns.appendChild(btnCancel);
    btns.appendChild(btnDelete);
    dlg.appendChild(title);
    dlg.appendChild(msg);
    dlg.appendChild(btns);
    overlay.appendChild(dlg);
    document.body.appendChild(overlay);
  }

  function _deleteCabinet(cabinetIdx) {
    if (cabinetIdx < 0 || cabinetIdx >= Cabinet.cabinets.length) return;

    const deletedCabinet = Cabinet.cabinets[cabinetIdx];
    const deletedRowIdx = deletedCabinet.rowIdx;
    const deletedXOffset = deletedCabinet.xOffset;
    const deletedWidthMM = parseInt(deletedCabinet.code.split('-')[2].slice(0, 2)) * 100;

    // Remove the cabinet
    Cabinet.cabinets.splice(cabinetIdx, 1);

    // Shift remaining cabinets in the same row to the left
    for (const cab of Cabinet.cabinets) {
      if (cab.rowIdx === deletedRowIdx && cab.xOffset > deletedXOffset) {
        cab.xOffset -= deletedWidthMM;
      }
    }

    // Clear accessories and chassis meshes — rebuildAllCabinetsFromState will recreate them
    if (window.CabinetDrag)    CabinetDrag.clearAll();
    if (window.CabinetChassis) CabinetChassis.clearAll();

    // Rebuild the scene
    if (window.CabinetBuilder && window.CabinetBuilder.rebuildAllCabinetsFromState) {
      CabinetBuilder.rebuildAllCabinetsFromState();
    }

    if (window.CabinetUI && window.CabinetUI.updateCabinetList) {
      CabinetUI.updateCabinetList();
    }
  }

  function _rotateAccessory(idx) {
    _placed[idx].rotated = !_placed[idx].rotated;
    _placed[idx].mesh.rotation.z = _placed[idx].rotated ? Math.PI : 0;
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

    // Check click on confirmed-cabinet highlight mat
    const matIdx = _hitHighlightMat(e.clientX, e.clientY);
    if (matIdx >= 0) {
      e.stopPropagation(); e.preventDefault();
      if (window.switchToCabinetEdit) switchToCabinetEdit(matIdx);
      return;
    }

    const idx = _hitPlaced(e.clientX, e.clientY);

    // Click on empty canvas → deselect
    if (idx < 0) {
      _deselect();
      return;
    }

    e.stopPropagation();
    e.preventDefault();

    // Record mousedown position — will decide click vs drag in _onMove/_onUp
    _mouseDownIdx  = idx;
    _mouseDownX    = e.clientX;
    _mouseDownY    = e.clientY;
    _mouseDownCtrl = e.ctrlKey || _ctrlHeld;
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

    _snapPts = CabinetBuilder.getSnapPoints(Cabinet.descriptionCode, _dragAcc, Cabinet.currentCabinetXOffset, Cabinet.activeRowIdx ?? 0);
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
    _startNewDrag(code, e.clientX, e.clientY);
  }

  function _startNewDrag(accCode, cx, cy) {
    _dragging   = true;
    _movingIdx  = -1;
    _dragAcc    = accCode;

    _ghostEl = _makeGhostLabel(accCode, cx, cy);
    _snapPts = CabinetBuilder.getSnapPoints(Cabinet.descriptionCode, accCode, Cabinet.currentCabinetXOffset, Cabinet.activeRowIdx ?? 0);
    _showMarkers();
    _loadGhost(accCode);
  }

  /* ══════════════════════════════════════════════════
     Mouse move
  ══════════════════════════════════════════════════ */
  function _onMove(e) {
    // Pending mousedown: check if movement exceeds threshold → start drag
    if (_mouseDownIdx >= 0 && !_dragging) {
      const dx = e.clientX - _mouseDownX;
      const dy = e.clientY - _mouseDownY;
      // Show cursor hint before drag threshold is reached
      _canvas.style.cursor = _mouseDownCtrl ? 'copy' : 'grabbing';
      if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) {
        const idx = _mouseDownIdx;
        const isCtrl = _mouseDownCtrl;
        _mouseDownIdx  = -1;
        _mouseDownCtrl = false;
        _deselect();
        if (isCtrl) {
          _startNewDrag(_placed[idx].accCode, e.clientX, e.clientY);
          _canvas.style.cursor = 'copy';
        } else {
          _startMoveDrag(idx, e.clientX, e.clientY);
        }
      }
      return;
    }
    if (_dragging) {
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
     Selection
  ══════════════════════════════════════════════════ */
  function _deselect() { /* no-op: kept for call sites, no visual state */ }

  /* ══════════════════════════════════════════════════
     Hover highlight (when not dragging)
  ══════════════════════════════════════════════════ */
  function _updateHover(cx, cy) {
    const rect = _canvas.getBoundingClientRect();
    const inCanvas = cx >= rect.left && cx <= rect.right
                  && cy >= rect.top  && cy <= rect.bottom;

    const matIdx = inCanvas ? _hitHighlightMat(cx, cy) : -1;
    if (matIdx >= 0) {
      if (!_hoveredMat) {
        _hoveredMat = true;
        _canvas.style.cursor = 'pointer';
        if (_hoveredIdx >= 0 && _hoveredIdx < _placed.length) {
          _setPlacedOpacity(_placed[_hoveredIdx].mesh, OPACITY_PLACED);
          _hoveredIdx = -1;
        }
      }
      return;
    }
    if (_hoveredMat) {
      _hoveredMat = false;
      _canvas.style.cursor = '';
    }
    const idx = inCanvas ? _hitPlaced(cx, cy) : -1;
    if (idx === _hoveredIdx) return;

    // Restore previous
    if (_hoveredIdx >= 0 && _hoveredIdx < _placed.length) {
      _setPlacedOpacity(_placed[_hoveredIdx].mesh, OPACITY_PLACED);
    }
    // Highlight new
    if (idx >= 0) {
      _setPlacedOpacity(_placed[idx].mesh, OPACITY_HOVER);
      _canvas.style.cursor = _ctrlHeld ? 'copy' : 'grab';
    } else {
      _canvas.style.cursor = '';
    }
    _hoveredIdx = idx;
  }

  /* ══════════════════════════════════════════════════
     Mouse up / drop
  ══════════════════════════════════════════════════ */
  function _onUp() {
    // Pending mousedown released without moving → click, nothing to do
    if (_mouseDownIdx >= 0) {
      _mouseDownIdx  = -1;
      _mouseDownCtrl = false;
      return;
    }
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
  // Row Y-rotation for a given rowIdx (mirrors _rowRotY in cabinet-builder.js)
  function _rowRotY(rowIdx) {
    const row = Cabinet.rows?.[rowIdx ?? 0] ?? { angle: 0, flipped: false };
    return row.angle * (Math.PI / 2) + (row.flipped ? Math.PI : 0);
  }

  async function _placeAccessory(accCode, snap) {
    try {
      const mesh = await _loadGLB(accCode);
      mesh.traverse(c => {
        if (!c.isMesh) return;
        c.userData.origMat = c.material;
        c.material = new THREE.MeshStandardMaterial(
          { color: COLOR_PLACED, transparent: true, opacity: OPACITY_PLACED });
      });
      mesh.position.copy(snap.position);
      mesh.rotation.y = _rowRotY(Cabinet.activeRowIdx ?? 0);
      mesh.userData.isPlaced = true;
      _scene.add(mesh);
      _placed.push({ accCode, snapId: snap.id, mesh, rotated: false });
      Cabinet.placedAccessories.push({ code: accCode, snapId: snap.id });
      if (window.CabinetUI) CabinetUI.rebuildBOM();
    } catch (e) {
      console.warn('[CabinetDrag] Could not place accessory:', e.message);
    }
  }

  /* ══════════════════════════════════════════════════
     End drag cleanup
  ══════════════════════════════════════════════════ */
  function _endDrag() {
    _dragging     = false;
    _dragAcc      = null;
    _nearIdx      = -1;
    _canDrop      = false;
    _hoveredIdx   = -1;
    _mouseDownIdx = -1;
    _canvas.style.cursor = '';

    if (_ghostEl)   { _ghostEl.remove();          _ghostEl   = null; }
    if (_ghostMesh) { _scene.remove(_ghostMesh);  _ghostMesh = null; }
    _hideMarkers();
    _snapPts = [];
  }

  /* ══════════════════════════════════════════════════
     Collision detection
  ══════════════════════════════════════════════════ */
  function _checkCollision(idx) {
    const activeMesh = _movingIdx >= 0 ? _placed[_movingIdx].mesh : _ghostMesh;
    if (!activeMesh) return true;

    activeMesh.position.copy(_snapPts[idx].position);
    activeMesh.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(activeMesh);
    // Deflate by 2 mm to avoid false collisions from merely touching faces
    box.expandByScalar(-0.002);

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
    try {
      _ghostMesh = await _loadGLB(accCode);
      _ghostMesh.traverse(c => {
        if (c.isMesh) c.material = new THREE.MeshStandardMaterial(
          { color: COLOR_GHOST, transparent: true, opacity: OPACITY_MOVING });
      });
      _ghostMesh.rotation.y = _rowRotY(Cabinet.activeRowIdx ?? 0);
      _ghostMesh.visible = false;
      _scene.add(_ghostMesh);
    } catch { /* ghost is optional */ }
  }

  /* ══════════════════════════════════════════════════
     Raycast helpers
  ══════════════════════════════════════════════════ */
  function _hitHighlightMat(cx, cy) {
    const rect = _canvas.getBoundingClientRect();
    _raycaster.setFromCamera({
      x:  ((cx - rect.left) / rect.width)  * 2 - 1,
      y: -((cy - rect.top)  / rect.height) * 2 + 1,
    }, _camera);
    const mats = [];
    _scene.traverse(obj => { if (obj.userData.isHighlightMat) mats.push(obj); });
    const hits = _raycaster.intersectObjects(mats, false);
    if (!hits.length) return -1;
    return hits[0].object.userData.cabinetIdx ?? -1;
  }

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

  // Restore accessories of a previously confirmed cabinet back to editable state.
  // Call from cabinet-ui.js after auto-finalizing the current cabinet.
  // Compute start index in _lockedPlaced for a given cabinet index.
  // Skips editingIdx because its accessories live in _placed, not _lockedPlaced.
  function _lockedStart(cabinetIdx) {
    const editingIdx = Cabinet.editingIdx ?? -1;
    let start = 0;
    for (let i = 0; i < cabinetIdx; i++) {
      if (i === editingIdx) continue;
      start += Cabinet.cabinets[i]?.placedAccessories?.length || 0;
    }
    return start;
  }

  // Save current _placed back into _lockedPlaced at the correct position for editingIdx.
  // Makes accessories opaque (locked appearance).
  function saveEditBack(editingIdx) {
    if (window.CabinetBuilder) CabinetBuilder.clearHighlight();
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
    }
    if (Cabinet.cabinets[editingIdx]) {
      Cabinet.cabinets[editingIdx].placedAccessories = _placed.map(p => ({ code: p.accCode, snapId: p.snapId }));
    }
    const start = _lockedStart(editingIdx);
    _lockedPlaced.splice(start, 0, ..._placed);
    _placed = [];
    Cabinet.placedAccessories = [];
  }

  // Pull accessories for cabinet idx from _lockedPlaced into _placed,
  // restoring green (editable) material.
  function loadForEdit(idx) {
    const start = _lockedStart(idx);
    const count = Cabinet.cabinets[idx]?.placedAccessories?.length || 0;
    const entries = _lockedPlaced.splice(start, count);
    for (const p of entries) {
      p.mesh.traverse(c => {
        if (!c.isMesh) return;
        if (!c.userData.origMat) c.userData.origMat = c.material;
        c.material = new THREE.MeshStandardMaterial(
          { color: COLOR_PLACED, transparent: true, opacity: OPACITY_PLACED });
      });
      _placed.push(p);
    }
    Cabinet.placedAccessories = _placed.map(p => ({
      code: p.accCode, snapId: p.snapId,
    }));
  }

  // Shift locked accessories for a single cabinet index by deltaMM along X.
  // If singleIdx=true, only shifts cabinet at fromIdx (not a range).
  function shiftLockedPlaced(fromIdx, deltaMM, singleIdx = false) {
    const dx = deltaMM * MM;
    const editingIdx = Cabinet.editingIdx ?? -1;
    let start = 0;
    for (let i = 0; i < Cabinet.cabinets.length; i++) {
      if (i === editingIdx) continue; // its accessories are in _placed, not _lockedPlaced
      const count = Cabinet.cabinets[i]?.placedAccessories?.length || 0;
      const matches = singleIdx ? (i === fromIdx) : (i >= fromIdx);
      if (matches) {
        for (let j = start; j < start + count; j++) {
          if (_lockedPlaced[j]) _lockedPlaced[j].mesh.position.x += dx;
        }
      }
      start += count;
    }
  }

  // Recompute world positions of all placed accessory meshes after a row
  // origin/angle/flip change. Iterates locked + active-editing accessories.
  function rebuildAllAccessories() {
    const editingIdx = Cabinet.editingIdx ?? -1;

    // Helper: reposition + reorient one entry using its cabinet's snap points
    function _repositionEntry(entry, cabinetIdx) {
      const cab = Cabinet.cabinets[cabinetIdx];
      if (!cab) return;
      const rowIdx = cab.rowIdx ?? 0;
      const snaps  = CabinetBuilder.getSnapPoints(cab.code, entry.accCode, cab.xOffset, rowIdx);
      const snap   = snaps.find(s => s.id === entry.snapId);
      if (!snap) return;

      // Update position
      entry.mesh.position.copy(snap.position);

      // Update rotation: row Y-rotation + preserve Z-flip (rotated flag)
      entry.mesh.rotation.y = _rowRotY(rowIdx);
      entry.mesh.rotation.z = entry.rotated ? Math.PI : 0;
    }

    // Locked accessories (all confirmed cabinets except the one being edited)
    let lockedCursor = 0;
    for (let i = 0; i < Cabinet.cabinets.length; i++) {
      if (i === editingIdx) continue;
      const count = Cabinet.cabinets[i]?.placedAccessories?.length || 0;
      for (let j = 0; j < count; j++) {
        _repositionEntry(_lockedPlaced[lockedCursor + j], i);
      }
      lockedCursor += count;
    }

    // Active (editing) accessories
    for (const entry of _placed) {
      if (editingIdx >= 0) _repositionEntry(entry, editingIdx);
    }
  }

  // Creates meshes for accessory entries that are in state but not yet in _lockedPlaced.
  // Called after rebuildAllCabinetsFromState (e.g. after cabinet duplication).
  async function rebuildFromState() {
    const editingIdx = Cabinet.editingIdx ?? -1;

    const existingCount = _lockedPlaced.length;
    let expectedCount = 0;
    for (let i = 0; i < Cabinet.cabinets.length; i++) {
      if (i === editingIdx) continue;
      expectedCount += Cabinet.cabinets[i]?.placedAccessories?.length || 0;
    }

    if (expectedCount === existingCount) {
      rebuildAllAccessories();
      return;
    }

    let coveredCount = 0;
    const tasks = [];

    for (let i = 0; i < Cabinet.cabinets.length; i++) {
      if (i === editingIdx) continue;
      const cab = Cabinet.cabinets[i];
      const count = cab.placedAccessories?.length || 0;

      if (coveredCount + count <= existingCount) {
        coveredCount += count;
        continue;
      }

      const rowIdx = cab.rowIdx ?? 0;
      const startEntry = existingCount - coveredCount;

      for (let j = Math.max(0, startEntry); j < count; j++) {
        const entry = cab.placedAccessories[j];
        const snaps = CabinetBuilder.getSnapPoints(cab.code, entry.code, cab.xOffset, rowIdx);
        const snap  = snaps.find(s => s.id === entry.snapId);
        tasks.push(
          _loadGLB(entry.code)
            .then(mesh => ({ mesh, entry, snap, rowIdx }))
            .catch(e => { console.warn('[CabinetDrag] rebuildFromState failed:', entry.code, e.message); return null; })
        );
      }
      coveredCount += count;
    }

    const results = await Promise.all(tasks);
    for (const r of results) {
      if (!r || !r.snap) continue;
      const { mesh, entry, snap, rowIdx } = r;
      mesh.traverse(c => { if (c.isMesh) c.userData.origMat = c.material; });
      mesh.position.copy(snap.position);
      mesh.rotation.y = _rowRotY(rowIdx);
      mesh.rotation.z = (entry.rotated ?? false) ? Math.PI : 0;
      mesh.userData.isPlaced = true;
      _scene.add(mesh);
      _lockedPlaced.push({ accCode: entry.code, snapId: entry.snapId, mesh, rotated: entry.rotated ?? false });
    }
  }

  return { init, clear, clearAll, finalizeCurrent, saveEditBack, loadForEdit, shiftLockedPlaced, rebuildAllAccessories, rebuildFromState, _isDragging: () => _dragging };
})();
