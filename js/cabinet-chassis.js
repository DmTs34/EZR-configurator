/**
 * cabinet-chassis.js
 * Chassis drag-and-drop placement system with snap to U-slot grid.
 *
 * Chassis snap to mounting rails inside cabinets. This module handles:
 * - Drag-drop from gallery cards
 * - Ghost model + slot grid visualization
 * - Snap detection by bottom edge
 * - Occupancy checking
 * - Finalize/lock/edit lifecycle
 */

window.CabinetChassis = (function () {
  'use strict';

  /* ══════════════════════════════════════════════════
     CONFIGURATION & CONSTANTS
  ════════════════════════════════════════════════════ */

  const COMP_ROOT   = 'components/';
  const MM          = 0.001;
  const SNAP_PX     = 40;                // screen-space snap activation radius
  const SLOT_H_MM   = 44.45;                // 1U height in mm
  const SLOT_W_MM   = 486.2;             // 1U width in mm
  const RAIL_Y_BASE = 40;                // rail Y offset (from builder)
  const SLOT_OFF_X  = 10;                // mm right of rail X
  const SLOT_OFF_Y  = 20;                // mm above rail Y base
  const SLOT_OFF_Z  = 17;               // mm depth offset (into cabinet)

  const COLOR_PLACED  = 0x52a394;  // greenish teal - same as accessories
  const COLOR_GHOST   = 0x4c8cf5;
  const COLOR_OK      = 0x22cc55;
  const COLOR_BLOCK   = 0xff4444;
  const OPACITY_SLOT  = 0.8;

  const OPACITY_PLACED  = 0.6;     // placed chassis normal opacity
  const OPACITY_HOVER   = 0.9;     // hovered chassis opacity
  const OPACITY_MOVING  = 0.8;     // chassis being moved/copied opacity (more visible)

  /** Mounting rail X offset per design code (from cabinet-builder.js) */
  const RAIL_X_OFFSET = {
    '03000': null,
    '03TLT': null,
    '03TRT': null,
    '06000': null,
    '06LR0': 40,
    '09L00': 80,
    '090R0': 300,
    '09STL': 80,
    '09STR': 300,
    '09DAR': 300,
    '12LR0': 340,
    '12IFA': 340,
    '12STM': 340,
  };

  /** Chassis catalog */
  const CHASSIS_CATALOG = [
    { code: 'Chassis-LISA-2U-L',      label: 'LISA 2U-L',    desc: 'LISA chassis, 2U Left',  heightU: 2, section: 'L' },
    { code: 'Chassis-LISA-2U-R',      label: 'LISA 2U-R',    desc: 'LISA chassis, 2U Right', heightU: 2, section: 'R' },
    { code: 'Chassis-LISA-6U-L',      label: 'LISA 6U-L',    desc: 'LISA chassis, 6U Left',  heightU: 6, section: 'L' },
    { code: 'Chassis-LISA-6U-R',      label: 'LISA 6U-R',    desc: 'LISA chassis, 6U Right', heightU: 6, section: 'R' },
    { code: 'Chassis-LISA-7U-L',      label: 'LISA 7U-L',    desc: 'LISA chassis, 7U Left',  heightU: 7, section: 'L' },
    { code: 'Chassis-LISA-7U-R',      label: 'LISA 7U-R',    desc: 'LISA chassis, 7U Right', heightU: 7, section: 'R' },
    { code: 'Chassis-EZR_ROUT-BRKT',  label: 'ROUT-BRKT 2U',   desc: 'EZR routing bracket, 2U',    heightU: 2 },
    { code: 'Chassis-BOUT-PLT-LG-2U-bottom',    label: 'BOUT-PLT-LG 2U Bottom',      desc: 'Breakout plate large, 2U, bottom',            heightU: 2 },
    { code: 'Chassis-BOUT-PLT-LG-2U-top',       label: 'BOUT-PLT-LG 2U Top',         desc: 'Breakout plate large, 2U, top',               heightU: 2 },
    { code: 'Chassis-BOUT-PLT-LG-2U-with-trough', label: 'BOUT-PLT-LG 4U Top with Trough', desc: 'Breakout plate large, 2U, with cable trough', heightU: 4 },
  ];

  /* ══════════════════════════════════════════════════
     MODULE STATE
  ════════════════════════════════════════════════════ */

  let _scene      = null;
  let _canvas     = null;
  let _camera     = null;

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

  let _dragging   = false;
  let _dragCode   = null;
  let _ghostMesh  = null;
  let _ghostEl    = null;

  let _slots      = [];         // [{ idx, position: THREE.Vector3 (world), occupied }]
  let _slotMeshes = [];         // visual slot rectangles
  let _nearSlot   = -1;         // current nearest slot index
  let _canDrop    = false;


  let _placed        = [];       // active placements: [{ code, slotIdx, heightU, mesh }]
  let _lockedPlaced  = [];       // finalized: [{ code, slotIdx, heightU, mesh }]

  let _ctrlHeld      = false;    // is Ctrl key held
  let _movingIdx     = -1;       // index of chassis being moved (-1 for new)
  let _moveOriginPos = null;     // original slot position for move cancel
  let _hoveredIdx    = -1;       // which placed chassis is hovered

  /* ══════════════════════════════════════════════════
     UTILITIES
  ════════════════════════════════════════════════════ */

  function _getHeightU(code) {
    const entry = CHASSIS_CATALOG.find(c => c.code === code);
    return entry ? entry.heightU : 1;
  }

  function _safeThumbId(code) {
    return 'chaThumb_' + code.replace(/[^a-zA-Z0-9]/g, '_');
  }

  function _worldToScreen(pos, rect) {
    if (!_camera) return { x: 0, y: 0 };
    const v = pos.clone().project(_camera);
    return {
      x: rect.left + (v.x + 1) / 2 * rect.width,
      y: rect.top + (-v.y + 1) / 2 * rect.height,
    };
  }

  /* ══════════════════════════════════════════════════
     SLOT GRID GENERATION & VISUALIZATION
  ════════════════════════════════════════════════════ */

  const ASSEMBLY_LIFT = 14; // mm — same as cabinet-builder.js

  function _getCatalogEntry(code) {
    return CHASSIS_CATALOG.find(c => c.code === code) ?? null;
  }

  function _buildSlots(descCode, xOffset, rowIdx, chassisCode = null) {
    const p = CabinetBuilder.parseCode(descCode);
    if (!p) return [];

    const heightU = parseInt(p.he);
    const slots = [];

    let sectionOffsetMM, sectionRailX;

    if (p.de === '15DAS') {
      const cat = _getCatalogEntry(chassisCode);
      const section = cat?.section ?? 'L';
      if (section === 'R') {
        sectionOffsetMM = 600;
        sectionRailX = RAIL_X_OFFSET['09DAR']; // 300
      } else {
        sectionOffsetMM = 0;
        sectionRailX = RAIL_X_OFFSET['06LR0']; // 40
      }
    } else {
      sectionOffsetMM = 0;
      sectionRailX = RAIL_X_OFFSET[p.de];
      if (sectionRailX === null || sectionRailX === undefined) return [];
    }

    for (let i = 0; i < heightU; i++) {
      const lxMM = sectionOffsetMM + sectionRailX + SLOT_OFF_X;
      const lyMM = ASSEMBLY_LIFT + RAIL_Y_BASE + SLOT_OFF_Y + i * SLOT_H_MM;
      const worldPos = CabinetUtils.localToWorld(lxMM, lyMM, SLOT_OFF_Z, xOffset, rowIdx, p.widthMM);
      slots.push({ idx: i, position: worldPos, occupied: false });
    }

    return slots;
  }

  function _markOccupied() {
    for (const s of _slots) s.occupied = false;
    // For 15DAS (composite cabinet): L and R slots are independent — only count
    // chassis from the same section. For all other cabinets: count everything.
    const p = CabinetBuilder.parseCode(Cabinet.descriptionCode);
    const dragSection = (p?.de === '15DAS')
      ? (_getCatalogEntry(_dragCode)?.section ?? null)
      : null;
    for (const ch of _placed) {
      if (dragSection !== null && (_getCatalogEntry(ch.code)?.section ?? null) !== dragSection) continue;
      for (let i = ch.slotIdx; i < ch.slotIdx + ch.heightU; i++) {
        if (_slots[i]) _slots[i].occupied = true;
      }
    }
  }

  function _showSlotMeshes() {
    _hideSlotMeshes();

    const geo = new THREE.EdgesGeometry(
      new THREE.PlaneGeometry(SLOT_W_MM * MM, SLOT_H_MM * MM)
    );

    const rowIdx = Cabinet.activeRowIdx ?? 0;
    const rotY = CabinetUtils.rowRotY(rowIdx);

    for (const s of _slots) {
      const color = s.occupied ? COLOR_BLOCK : COLOR_GHOST;
      const mat = new THREE.LineBasicMaterial({
        color,
        depthTest: false,
        transparent: true,
        opacity: OPACITY_SLOT,
      });
      const mesh = new THREE.LineSegments(geo, mat);

      // Center position: slot position is bottom-left corner in local space,
      // offset to center using rotated local axes
      const cosR = Math.cos(rotY);
      const sinR = Math.sin(rotY);
      const halfW = SLOT_W_MM * MM / 2;
      const halfH = SLOT_H_MM * MM / 2;
      mesh.position.set(
        s.position.x + halfW * cosR,
        s.position.y + halfH,
        s.position.z - halfW * sinR + 0.001
      );
      mesh.rotation.y = rotY;
      mesh.renderOrder = 10;

      _scene.add(mesh);
      _slotMeshes.push(mesh);
    }
  }

  function _hideSlotMeshes() {
    for (const m of _slotMeshes) {
      _scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    _slotMeshes = [];
  }

  function _updateSlotColors() {
    _markOccupied();
    for (let i = 0; i < _slotMeshes.length && i < _slots.length; i++) {
      const color = _slots[i].occupied ? COLOR_BLOCK : COLOR_GHOST;
      if (_slotMeshes[i].material) {
        _slotMeshes[i].material.color.setHex(color);
      }
    }
  }

  function _setPlacedOpacity(mesh, opacity) {
    let meshCount = 0;
    mesh.traverse(child => {
      if (child.isMesh && child.material) {
        meshCount++;
        if (Array.isArray(child.material)) {
          child.material.forEach(m => { m.opacity = opacity; m.transparent = true; });
        } else {
          child.material.opacity = opacity;
          child.material.transparent = true;
        }
      }
    });
  }

  /* ══════════════════════════════════════════════════
     GHOST MESH
  ════════════════════════════════════════════════════ */

  async function _loadGhost(code) {
    try {
      _ghostMesh = await _loadGLB(code);

      // Apply transparent material
      _ghostMesh.traverse(c => {
        if (c.isMesh) {
          c.material = new THREE.MeshStandardMaterial({
            color: COLOR_GHOST,
            transparent: true,
            opacity: 0.5,
          });
        }
      });

      _ghostMesh.visible = false;
      _scene.add(_ghostMesh);
    } catch (e) {
      console.warn('[CabinetChassis] Failed to load ghost:', e.message);
    }
  }

  function _makeGhostLabel(code, cx, cy) {
    document.querySelectorAll('.drag-ghost-label').forEach(el => el.remove());
    const el = document.createElement('div');
    el.className = 'drag-ghost-label';
    el.style.cssText = [
      'position:fixed', 'pointer-events:none', 'z-index:9999',
      `left:${cx}px`, `top:${cy}px`,
      'background:#fff', 'border:2px solid #4c8cf5', 'border-radius:6px',
      'padding:4px 10px', 'font-size:11px', 'font-weight:600', 'color:#2563eb',
      'box-shadow:0 4px 16px rgba(0,0,0,.2)', 'white-space:nowrap',
    ].join(';');
    el.textContent = code;
    document.body.appendChild(el);
    return el;
  }

  /* ══════════════════════════════════════════════════
     SNAP & COLLISION
  ════════════════════════════════════════════════════ */

  function _checkCollision(slotIdx, heightU) {
    if (slotIdx < 0 || slotIdx + heightU > _slots.length) return false;

    for (let i = slotIdx; i < slotIdx + heightU; i++) {
      if (_slots[i].occupied) return false;
    }
    return true;
  }

  function _updateSnap(cx, cy) {
    if (!_ghostMesh || _slots.length === 0) return;

    const rect = _canvas.getBoundingClientRect();
    let bestDist = Infinity;
    let bestIdx = -1;

    const heightU = _getHeightU(_dragCode);

    // Find nearest slot (project from slot center with rotation applied)
    const rotY = CabinetUtils.rowRotY(Cabinet.activeRowIdx ?? 0);
    const cosR = Math.cos(rotY);
    const sinR = Math.sin(rotY);
    const halfW = SLOT_W_MM * MM / 2;
    const halfH = SLOT_H_MM * MM / 2;
    for (const s of _slots) {
      const slotCenter = new THREE.Vector3(
        s.position.x + halfW * cosR,
        s.position.y + halfH,
        s.position.z - halfW * sinR
      );
      const screenPos = _worldToScreen(slotCenter, rect);
      const dx = screenPos.x - cx;
      const dy = screenPos.y - cy;
      const d2 = dx * dx + dy * dy;

      if (d2 < bestDist) {
        bestDist = d2;
        bestIdx = s.idx;
      }
    }

    const snapRange = SNAP_PX * SNAP_PX;
    const inRange = bestDist < snapRange;

    // Snap if in range and valid
    if (inRange && bestIdx >= 0) {
      _canDrop = _checkCollision(bestIdx, heightU);
      _setNearSlot(_canDrop ? bestIdx : -1, heightU);
    } else {
      _canDrop = false;
      _setNearSlot(-1, heightU);
    }
  }

  function _setNearSlot(idx, heightU) {
    if (idx === _nearSlot) return;

    _nearSlot = idx;

    if (idx >= 0 && _ghostMesh) {
      // Position ghost at slot
      const bottomSlot = _slots[idx];
      _ghostMesh.position.copy(bottomSlot.position);
      _ghostMesh.rotation.y = CabinetUtils.rowRotY(Cabinet.activeRowIdx ?? 0);
      _ghostMesh.visible = true;

      // Update ghost color - only if this is a NEW placement from card
      if (_movingIdx < 0) {
        _ghostMesh.traverse(c => {
          if (c.isMesh) {
            c.material.color.setHex(_canDrop ? COLOR_OK : COLOR_BLOCK);
          }
        });
      }

      // Highlight the affected slots
      for (let i = 0; i < _slotMeshes.length; i++) {
        const isAffected = i >= idx && i < idx + heightU;
        _slotMeshes[i].material.color.setHex(
          isAffected ? (_canDrop ? COLOR_OK : COLOR_BLOCK) : COLOR_GHOST
        );
      }
    } else {
      if (_ghostMesh) _ghostMesh.visible = false;

      // Reset slot colors
      for (let i = 0; i < _slotMeshes.length; i++) {
        _slotMeshes[i].material.color.setHex(
          _slots[i].occupied ? COLOR_BLOCK : COLOR_GHOST
        );
      }
    }
  }

  /* ══════════════════════════════════════════════════
     DRAG LIFECYCLE
  ════════════════════════════════════════════════════ */

  function _onCanvasDown(e) {
    // Only allow interactions when editing (Cabinet.editingIdx >= 0)
    if (Cabinet.editingIdx < 0) {
      return;
    }

    // Right click = context menu
    if (e.button === 2) {
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      const rect = _canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, _camera);

      const placedMeshes = _placed.map(p => p.mesh);
      const intersects = raycaster.intersectObjects(placedMeshes, true);

      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object;
        let idx = -1;
        for (let i = 0; i < _placed.length; i++) {
          // Walk up parent chain to find the placed mesh
          let current = clickedMesh;
          while (current) {
            if (current === _placed[i].mesh) {
              idx = i;
              break;
            }
            current = current.parent;
          }
          if (idx >= 0) break;
        }

        if (idx >= 0) {
          e.preventDefault();
          e.stopPropagation();
          _showCtxMenu(idx, e.clientX, e.clientY);
        }
      }
      return;
    }

    if (e.button !== 0) return;

    // Left click = drag to move/copy
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const rect = _canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, _camera);

    const placedMeshes = _placed.map(p => p.mesh);
    const intersects = raycaster.intersectObjects(placedMeshes, true);

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      let idx = -1;
      for (let i = 0; i < _placed.length; i++) {
        // Walk up parent chain to find the placed mesh
        let current = clickedMesh;
        while (current) {
          if (current === _placed[i].mesh) {
            idx = i;
            break;
          }
          current = current.parent;
        }
        if (idx >= 0) break;
      }

      if (idx >= 0) {
        e.preventDefault();
        e.stopPropagation();
        if (_ctrlHeld) {
          // Ctrl+click = copy
          _startMoveDrag(_placed[idx].code, idx, e.clientX, e.clientY, true);
        } else {
          // Regular click = move
          _startMoveDrag(_placed[idx].code, idx, e.clientX, e.clientY, false);
        }
      }
    }
  }

  function _onCardDown(e) {
    if (e.button !== 0) return;
    const card = e.target.closest('.cha-card');
    const code = card?.dataset.chaCode;
    if (!code || !Cabinet.descriptionCode) return;

    // Only allow drag when editing (Cabinet.editingIdx >= 0)
    if (Cabinet.editingIdx < 0) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    _startDrag(code, e.clientX, e.clientY);
  }

  function _startMoveDrag(code, idx, cx, cy, isCopy) {
    _dragging = true;
    _dragCode = code;

    _nearSlot = -1;
    _canDrop = false;

    if (isCopy) {
      _movingIdx = -1;
      _moveOriginPos = null;
    } else {
      _movingIdx = idx;
      _moveOriginPos = _placed[idx].slotIdx;
    }

    _ghostEl = _makeGhostLabel(code, cx, cy);

    // Build slots
    _slots = _buildSlots(
      Cabinet.descriptionCode,
      Cabinet.currentCabinetXOffset,
      Cabinet.activeRowIdx ?? 0,
      code
    );
    _markOccupied();

    if (isCopy) {
      // For copy: mark original as occupied, load new ghost mesh
      const orig = _placed[idx];
      for (let i = orig.slotIdx; i < orig.slotIdx + orig.heightU; i++) {
        if (_slots[i]) _slots[i].occupied = true;
      }
      _showSlotMeshes();
      _loadGhost(code); // Load new ghost, don't modify original
    } else {
      // For move: unmark the moving chassis, reuse its mesh as ghost
      const p = _placed[idx];
      for (let i = p.slotIdx; i < p.slotIdx + p.heightU; i++) {
        if (_slots[i]) _slots[i].occupied = false;
      }
      _showSlotMeshes();
      _ghostMesh = _placed[idx].mesh;
      // Set moving opacity
      _setPlacedOpacity(_ghostMesh, OPACITY_MOVING);
    }
  }

  function _startDrag(code, cx, cy) {
    _dragging = true;
    _dragCode = code;

    _nearSlot = -1;
    _canDrop = false;
    _movingIdx = -1;

    _ghostEl = _makeGhostLabel(code, cx, cy);

    // Build slots for active cabinet
    _slots = _buildSlots(
      Cabinet.descriptionCode,
      Cabinet.currentCabinetXOffset,
      Cabinet.activeRowIdx ?? 0,
      code
    );

    _markOccupied();
    _showSlotMeshes();
    _loadGhost(code);
  }

  let _moveCounter = 0;
  function _onMove(e) {
    const cx = e.clientX;
    const cy = e.clientY;

    // Dragging mode takes priority - prevent scene rotation
    if (_dragging) {
      e.preventDefault();
      e.stopPropagation();

      if (_moveCounter++ % 60 === 0) {
      }

      // Update ghost label position
      if (_ghostEl) {
        _ghostEl.style.left = cx + 'px';
        _ghostEl.style.top = cy + 'px';
      }

      // Update snap detection
      _updateSnap(cx, cy);
      return;
    }

    // Hover detection on placed chassis (even when not dragging)
    if (!_dragging) {
      // Only allow hover when editing (Cabinet.editingIdx >= 0)
      if (Cabinet.editingIdx < 0) {
        return;
      }

      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      const rect = _canvas.getBoundingClientRect();
      mouse.x = ((cx - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((cy - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, _camera);

      const placedMeshes = _placed.map(p => p.mesh);
      const intersects = raycaster.intersectObjects(placedMeshes, true);

      let newHoveredIdx = -1;
      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object;
        for (let i = 0; i < _placed.length; i++) {
          // Check if clickedMesh is the placed mesh or a descendant of it
          let current = clickedMesh;
          while (current) {
            if (current === _placed[i].mesh) {
              newHoveredIdx = i;
              break;
            }
            current = current.parent;
          }
          if (newHoveredIdx >= 0) break;
        }
      }

      if (newHoveredIdx !== _hoveredIdx) {

        // Restore opacity of previously hovered chassis
        if (_hoveredIdx >= 0 && _placed[_hoveredIdx]) {
          _setPlacedOpacity(_placed[_hoveredIdx].mesh, OPACITY_PLACED);
        }

        _hoveredIdx = newHoveredIdx;

        // Apply hover opacity to new hovered chassis
        if (_hoveredIdx >= 0) {
          _setPlacedOpacity(_placed[_hoveredIdx].mesh, OPACITY_HOVER);
          _canvas.style.cursor = _ctrlHeld ? 'copy' : 'grab';
        } else {
          _canvas.style.cursor = '';
        }
      }
      return;
    }
  }

  async function _onUp(e) {
    if (!_dragging) return;

    // Prevent scene rotation when finishing drag, but allow event to bubble
    // so CabinetControls can reset its drag flag
    e.preventDefault();

    if (_nearSlot >= 0 && _canDrop) {
      const heightU = _getHeightU(_dragCode);

      if (_movingIdx >= 0) {
        // Moving existing chassis
        const ch = _placed[_movingIdx];
        const oldSlotIdx = _moveOriginPos;
        ch.slotIdx = _nearSlot;
        ch.mesh.position.copy(_slots[_nearSlot].position);
        ch.mesh.rotation.y = CabinetUtils.rowRotY(Cabinet.activeRowIdx ?? 0);
        Cabinet.placedChassis[_movingIdx].slotIdx = _nearSlot;

        // Restore opacity after move
        _setPlacedOpacity(ch.mesh, OPACITY_PLACED);

        // Reposition accessories attached to this chassis
        ch.mesh.updateWorldMatrix(true, true);
        if (window.CabinetDrag?._repositionChildrenOfChassis) {
          CabinetDrag._repositionChildrenOfChassis(ch.code, oldSlotIdx, _nearSlot, ch.cabinetIdx ?? Cabinet.editingIdx ?? 0);
        }
      } else {
        // New placement (from card or copy)
        await _placeChassis(_dragCode, _nearSlot, heightU);
      }
    } else if (_movingIdx >= 0 && _moveOriginPos !== null) {
      // Move cancelled - restore original position, visibility and opacity
      _placed[_movingIdx].slotIdx = _moveOriginPos;
      _placed[_movingIdx].mesh.position.copy(_slots[_moveOriginPos].position);
      _placed[_movingIdx].mesh.visible = true;
      Cabinet.placedChassis[_movingIdx].slotIdx = _moveOriginPos;

      // Restore opacity
      _setPlacedOpacity(_placed[_movingIdx].mesh, OPACITY_PLACED);
    } else {
    }

    _endDrag();
  }

  let _ctxMenu = null;

  function _showCtxMenu(idx, cx, cy) {
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
    itemDuplicate.textContent = 'Duplicate';
    itemDuplicate.onmouseenter = () => itemDuplicate.style.background = '#f5f5f5';
    itemDuplicate.onmouseleave = () => itemDuplicate.style.background = '';
    itemDuplicate.onmousedown = (e) => {
      e.stopPropagation();
      _duplicateChassis(idx);
      _hideCtxMenu();
    };

    const sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:#e8e8e8;margin:2px 0;';

    const itemRemove = document.createElement('div');
    itemRemove.style.cssText = 'padding:8px 14px;cursor:pointer;color:#c0392b;font-weight:500;';
    itemRemove.textContent = 'Remove';
    itemRemove.onmouseenter = () => itemRemove.style.background = '#fff5f5';
    itemRemove.onmouseleave = () => itemRemove.style.background = '';
    itemRemove.onmousedown = (e) => {
      e.stopPropagation();
      _removeChassis(idx);
      _hideCtxMenu();
    };

    menu.appendChild(itemDuplicate);
    menu.appendChild(sep);
    menu.appendChild(itemRemove);
    document.body.appendChild(menu);
    _ctxMenu = menu;
  }

  function _hideCtxMenu() {
    if (_ctxMenu) {
      _ctxMenu.remove();
      _ctxMenu = null;
    }
  }

  function _duplicateChassis(idx) {
    if (idx < 0 || idx >= _placed.length) return;
    const chassis = _placed[idx];

    // Rebuild slots to get current occupancy
    _dragCode = chassis.code;
    _slots = _buildSlots(
      Cabinet.descriptionCode,
      Cabinet.currentCabinetXOffset,
      Cabinet.activeRowIdx ?? 0,
      chassis.code
    );
    _markOccupied();

    const heightU = chassis.heightU;

    // Find first free slot above the original (then below)
    let targetSlot = -1;
    // Search upward from current slot
    for (let i = chassis.slotIdx + heightU; i + heightU <= _slots.length; i++) {
      if (_checkCollision(i, heightU)) { targetSlot = i; break; }
    }
    // If no slot found above, search downward
    if (targetSlot < 0) {
      for (let i = chassis.slotIdx - heightU; i >= 0; i--) {
        if (_checkCollision(i, heightU)) { targetSlot = i; break; }
      }
    }

    if (targetSlot < 0) {
      console.warn('[CabinetChassis] _duplicateChassis: no free slot found');
      return;
    }

    _placeChassis(chassis.code, targetSlot, heightU);
  }

  function _removeChassis(idx) {
    if (idx < 0 || idx >= _placed.length) return;

    const p = _placed[idx];
    _scene.remove(p.mesh);
    p.mesh.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) {
          c.material.forEach(m => m.dispose());
        } else {
          c.material.dispose();
        }
      }
    });

    _placed.splice(idx, 1);
    Cabinet.placedChassis.splice(idx, 1);

    if (window.CabinetUI && window.CabinetUI.rebuildBOM) {
      CabinetUI.rebuildBOM();
    }

    if (_hoveredIdx === idx) _hoveredIdx = -1;
  }

  function _endDrag() {
    _dragging = false;
    _dragCode = null;
    _nearSlot = -1;
    _canDrop = false;

    document.querySelectorAll('.drag-ghost-label').forEach(el => el.remove());
    _ghostEl = null;

    // Only remove ghost mesh if it was loaded from card (not a moved/copied placed mesh)
    // For moves/copies, the ghost mesh IS a placed mesh that should stay in scene
    if (_ghostMesh && _movingIdx < 0) {
      _scene.remove(_ghostMesh);
    }

    _ghostMesh = null;
    _movingIdx = -1;

    _hideSlotMeshes();
  }

  /* ══════════════════════════════════════════════════
     PLACEMENT
  ════════════════════════════════════════════════════ */

  async function _placeChassis(code, slotIdx, heightU) {
    try {
      const mesh = await _loadGLB(code);

      // Apply color material to all mesh components (like accessories)
      let materialCount = 0;
      mesh.traverse(c => {
        if (!c.isMesh) return;
        materialCount++;
        c.userData.origMat = c.material;
        c.material = new THREE.MeshStandardMaterial({
          color: COLOR_PLACED,
          transparent: true,
          opacity: OPACITY_PLACED
        });
      });

      // Position and orient at slot
      const bottomSlot = _slots[slotIdx];
      mesh.position.copy(bottomSlot.position);
      mesh.rotation.y = CabinetUtils.rowRotY(Cabinet.activeRowIdx ?? 0);
      mesh.userData.isPlacedChassis = true;
      // Store DE code so child snap points can apply DE-dependent X offset
      const _parsedForDE = CabinetBuilder.parseCode(Cabinet.descriptionCode);
      if (_parsedForDE) mesh.userData.deCode = _parsedForDE.de;

      _scene.add(mesh);

      // Add to state
      _placed.push({ code, slotIdx, heightU, mesh, cabinetIdx: Cabinet.editingIdx ?? 0 });
      Cabinet.placedChassis.push({ code, slotIdx, heightU });

      // Update visuals
      _markOccupied();
      _updateSlotColors();

      if (window.CabinetUI && window.CabinetUI.rebuildBOM) {
        CabinetUI.rebuildBOM();
      }
    } catch (e) {
      console.warn('[CabinetChassis] Failed to place chassis:', e.message);
    }
  }

  /* ══════════════════════════════════════════════════
     LIFECYCLE: FINALIZE, CLEAR, EDIT
  ════════════════════════════════════════════════════ */

  function _lockedStart(cabinetIdx) {
    const editingIdx = Cabinet.editingIdx ?? -1;
    let start = 0;
    for (let i = 0; i < cabinetIdx; i++) {
      if (i === editingIdx) continue;
      start += Cabinet.cabinets[i]?.placedChassis?.length || 0;
    }
    return start;
  }

  function saveEditBack(editingIdx) {
    for (const p of _placed) {
      p.mesh.traverse(c => {
        if (!c.isMesh) return;
        if (c.userData.origMat) {
          c.material = c.userData.origMat;
          delete c.userData.origMat;
        }
        c.material.transparent = false;
        c.material.opacity = 1.0;
        c.material.needsUpdate = true;
      });
    }
    const start = _lockedStart(editingIdx);
    _lockedPlaced.splice(start, 0, ..._placed);
    _placed = [];
    Cabinet.placedChassis = [];
  }

  function loadForEdit(idx) {
    const start = _lockedStart(idx);
    const count = Cabinet.cabinets[idx]?.placedChassis?.length || 0;
    const entries = _lockedPlaced.splice(start, count);
    for (const p of entries) {
      p.mesh.traverse(c => {
        if (!c.isMesh) return;
        if (!c.userData.origMat) c.userData.origMat = c.material;
        c.material = new THREE.MeshStandardMaterial({
          color: COLOR_PLACED, transparent: true, opacity: OPACITY_PLACED,
        });
      });
      _placed.push(p);
    }
    Cabinet.placedChassis = _placed.map(p => ({
      code: p.code, slotIdx: p.slotIdx, heightU: p.heightU,
    }));
  }

  function finalizeCurrent() {
    // Restore original materials and move active placements to locked
    for (const p of _placed) {
      p.mesh.traverse(c => {
        if (c.isMesh && c.userData.origMat) {
          c.material = c.userData.origMat;
          delete c.userData.origMat;
        }
      });
      _lockedPlaced.push(p);
    }
    _placed = [];

    // Save to cabinet state
    const idx = Cabinet.editingIdx;
    if (idx >= 0 && Cabinet.cabinets[idx]) {
      Cabinet.cabinets[idx].placedChassis = Cabinet.placedChassis.slice();
    }
  }

  function clear() {
    // Remove active placement meshes
    for (const p of _placed) {
      _scene.remove(p.mesh);
      p.mesh.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) {
            c.material.forEach(m => m.dispose());
          } else {
            c.material.dispose();
          }
        }
      });
    }
    _placed = [];
    Cabinet.placedChassis = [];
  }

  function clearAll() {
    clear();
    for (const p of _lockedPlaced) {
      _scene.remove(p.mesh);
      p.mesh.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) {
            c.material.forEach(m => m.dispose());
          } else {
            c.material.dispose();
          }
        }
      });
    }
    _lockedPlaced = [];
  }

  /* ══════════════════════════════════════════════════
     GALLERY & THUMBNAILS
  ════════════════════════════════════════════════════ */

  function renderCards() {
    const grid = document.getElementById('chaGrid');
    if (!grid) return;

    grid.innerHTML = CHASSIS_CATALOG.map(c => `
      <div class="preset-card cha-card" data-cha-code="${c.code}">
        <div class="preset-card-thumb" id="${_safeThumbId(c.code)}">
          <div class="preset-thumb-spinner"></div>
        </div>
        <div class="preset-card-info">
          <div class="preset-card-code">${c.code}</div>
          <div class="preset-card-order">${c.desc}</div>
        </div>
      </div>
    `).join('');
  }

  async function renderThumbs() {
    for (const c of CHASSIS_CATALOG) {
      const thumbId = _safeThumbId(c.code);
      const el = document.getElementById(thumbId);
      if (!el) continue;

      // Try static first
      const staticSrc = `thumbnails/chassis/${c.code.replace(/[^\w\-]/g, '_')}.jpg`;
      let loaded = false;
      try {
        const resp = await fetch(staticSrc, { method: 'HEAD' });
        if (resp.ok) {
          const img = document.createElement('img');
          // Wait for image to load with timeout
          const loadPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('timeout')), 5000);
            img.onload = () => { clearTimeout(timeout); resolve(); };
            img.onerror = () => { clearTimeout(timeout); reject(new Error('load error')); };
            img.src = staticSrc;
          });
          try {
            await loadPromise;
            const spinner = el.querySelector('.preset-thumb-spinner');
            if (spinner) spinner.replaceWith(img);
            else el.insertBefore(img, el.firstChild);
            loaded = true;
          } catch (imgErr) {
          }
        }
      } catch (err) {
      }

      // Fallback: render live
      if (!loaded) {
        try {
          const dataURL = await captureThumb(c.code);
          const img = document.createElement('img');
          img.src = dataURL;
          const spinner = el.querySelector('.preset-thumb-spinner');
          if (spinner) spinner.replaceWith(img);
          else el.insertBefore(img, el.firstChild);
        } catch (e) {
          console.error('[CabinetChassis] Failed to capture thumb:', c.code, e.message, e);
        }
      }
    }
  }

  async function captureThumb(code, cam = {}) {
    const rdr = Cabinet.renderer;
    const scene = Cabinet.scene;
    const camera = Cabinet.camera;
    if (!rdr || !scene || !camera) throw new Error('Scene not ready');

    const theta      = cam.theta         ?? 0.291;
    const phi        = cam.phi           ?? 1.409;
    const radiusMult = cam.accRadiusMult ?? 2.2;

    // Load the chassis GLB
    const obj = await _loadGLB(code);

    // Centre at origin
    const bbox = new THREE.Box3().setFromObject(obj);
    const centre = bbox.getCenter(new THREE.Vector3());
    obj.position.sub(centre);
    obj.name = '__chaThumb';
    scene.add(obj);

    // Fit camera
    const size   = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (window.CabinetControls) {
      CabinetControls.setTarget(new THREE.Vector3(0, 0, 0));
      CabinetControls.setView(theta, phi, maxDim * radiusMult);
      CabinetControls.update();
    }

    // Render at thumbnail resolution
    const W = 512, H = 352;
    const prevAspect = camera.aspect;
    const cssW = rdr.domElement.clientWidth  || 800;
    const cssH = rdr.domElement.clientHeight || 600;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    rdr.setSize(W, H, false);
    if (window.CabinetFloor) CabinetFloor.setVisible(false);
    if (window.CabinetArrow) CabinetArrow.setVisible(false);
    if (window.CabinetBuilder) CabinetBuilder.setHighlightsVisible(false);
    rdr.render(scene, camera);
    if (window.CabinetFloor) CabinetFloor.setVisible(true);
    if (window.CabinetArrow) CabinetArrow.setVisible(true);
    if (window.CabinetBuilder) CabinetBuilder.setHighlightsVisible(true);
    const dataURL = rdr.domElement.toDataURL('image/jpeg', 0.88);

    // Restore renderer size
    rdr.setSize(cssW, cssH, false);
    camera.aspect = prevAspect;
    camera.updateProjectionMatrix();

    scene.remove(obj);
    return dataURL;
  }

  /* ══════════════════════════════════════════════════
     INITIALIZATION
  ════════════════════════════════════════════════════ */

  function init(canvas, scene, camera) {
    _canvas = canvas;
    _scene = scene;
    _camera = camera;

    const grid = document.getElementById('chaGrid');
    if (grid) {
      grid.addEventListener('mousedown', _onCardDown);
    } else {
      console.warn('[CabinetChassis] init: chaGrid not found!');
    }

    // Canvas click for moving/copying placed chassis
    canvas.addEventListener('mousedown', _onCanvasDown);
    canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
    });

    // Close context menu when clicking elsewhere (but not on the menu itself)
    document.addEventListener('mousedown', (e) => {
      if (_ctxMenu && !_ctxMenu.contains(e.target)) {
        _hideCtxMenu();
      }
    });

    // Register move with capture phase to intercept before CabinetControls
    canvas.addEventListener('mousemove', _onMove, true);
    // Register mouseup on canvas with capture phase, but DON'T stop propagation
    // so CabinetControls can reset its drag flag
    canvas.addEventListener('mouseup', _onUp, true);

    // Ctrl tracking
    document.addEventListener('keydown', e => {
      if (e.key === 'Control') {
        _ctrlHeld = true;
        if (_hoveredIdx >= 0) _canvas.style.cursor = 'copy';
      }
      if (e.key === 'Escape') _endDrag();
      if (e.key === 'Delete' && _hoveredIdx >= 0) {
        e.preventDefault();
        _removeChassis(_hoveredIdx);
        _hoveredIdx = -1;
        _canvas.style.cursor = '';
      }
    });
    document.addEventListener('keyup', e => {
      if (e.key === 'Control') {
        _ctrlHeld = false;
        if (_hoveredIdx >= 0) _canvas.style.cursor = 'grab';
      }
    });
  }

  /* ══════════════════════════════════════════════════
     REBUILD (called when rows move/rotate)
  ════════════════════════════════════════════════════ */

  function rebuildAllChassis() {
    const editingIdx = Cabinet.editingIdx ?? -1;

    function _repositionEntry(entry, cab) {
      if (!cab) return;
      const rowIdx = cab.rowIdx ?? 0;
      const slots = _buildSlots(cab.code, cab.xOffset, rowIdx, entry.code);
      if (!slots.length) return;
      const slot = slots[entry.slotIdx];
      if (!slot) return;
      entry.mesh.position.copy(slot.position);
      entry.mesh.rotation.y = CabinetUtils.rowRotY(rowIdx);
    }

    // Locked chassis (finalized cabinets)
    let lockedCursor = 0;
    for (let i = 0; i < Cabinet.cabinets.length; i++) {
      const cab = Cabinet.cabinets[i];
      if (i === editingIdx) continue;
      const count = cab?.placedChassis?.length || 0;
      for (let j = 0; j < count; j++) {
        _repositionEntry(_lockedPlaced[lockedCursor + j], cab);
      }
      lockedCursor += count;
    }

    // Active chassis (cabinet being configured or edited)
    if (_placed.length > 0) {
      let cab;
      if (editingIdx >= 0) {
        cab = Cabinet.cabinets[editingIdx];
      } else {
        // New cabinet not yet confirmed — use current Cabinet state
        cab = {
          code:    Cabinet.descriptionCode,
          xOffset: Cabinet.currentCabinetXOffset,
          rowIdx:  Cabinet.activeRowIdx ?? 0,
        };
      }
      for (const entry of _placed) {
        _repositionEntry(entry, cab);
      }
    }
  }

  /* ══════════════════════════════════════════════════
     REBUILD FROM STATE (creates missing meshes)
  ════════════════════════════════════════════════════ */

  // Called after rebuildAllCabinetsFromState — recreates chassis meshes for
  // all locked cabinets from saved state, replacing any stale _lockedPlaced entries.
  async function rebuildFromState() {
    const editingIdx = Cabinet.editingIdx ?? -1;

    // Count how many locked chassis entries already exist
    const existingCount = _lockedPlaced.length;

    // Count expected total from state
    let expectedCount = 0;
    for (let i = 0; i < Cabinet.cabinets.length; i++) {
      if (i === editingIdx) continue;
      expectedCount += Cabinet.cabinets[i]?.placedChassis?.length || 0;
    }

    // Nothing changed — just reposition
    if (expectedCount === existingCount) {
      rebuildAllChassis();
      return;
    }

    // Find cabinets whose chassis are NOT yet in _lockedPlaced (new cabinets added at end)
    // Walk cabinets in order, skip entries already covered by existing _lockedPlaced
    function _load(code) { return _loadGLB(code); }

    let coveredCount = 0;
    const tasks = [];

    for (let i = 0; i < Cabinet.cabinets.length; i++) {
      if (i === editingIdx) continue;
      const cab = Cabinet.cabinets[i];
      const count = cab.placedChassis?.length || 0;

      if (coveredCount + count <= existingCount) {
        // All entries for this cabinet already loaded — skip
        coveredCount += count;
        continue;
      }

      // This cabinet has new entries (partially or fully missing)
      const rowIdx = cab.rowIdx ?? 0;

      const startEntry = existingCount - coveredCount; // entries already loaded for this cabinet
      const deCode = CabinetBuilder.parseCode(cab.code)?.de ?? null;
      for (let j = Math.max(0, startEntry); j < count; j++) {
        const entry = cab.placedChassis[j];
        const slots = _buildSlots(cab.code, cab.xOffset, rowIdx, entry.code);
        tasks.push(
          _load(entry.code)
            .then(mesh => ({ mesh, entry, slots, rowIdx, cabinetIdx: i, deCode }))
            .catch(e => { console.warn('[CabinetChassis] rebuildFromState: failed', entry.code, e.message); return null; })
        );
      }
      coveredCount += count;
    }

    const results = await Promise.all(tasks);
    for (const r of results) {
      if (!r) continue;
      const { mesh, entry, slots, rowIdx, cabinetIdx, deCode } = r;
      mesh.userData.isPlacedChassis = true;
      if (deCode) mesh.userData.deCode = deCode;
      const slot = slots[entry.slotIdx];
      if (slot) {
        mesh.position.copy(slot.position);
        mesh.rotation.y = CabinetUtils.rowRotY(rowIdx);
      }
      _scene.add(mesh);
      mesh.updateWorldMatrix(true, true);
      _lockedPlaced.push({ code: entry.code, slotIdx: entry.slotIdx, heightU: entry.heightU, mesh, cabinetIdx });
    }
  }

  /**
   * Reposition all active (_placed) chassis meshes to match new slot positions.
   * Called when the cabinet code changes and DE stays the same but geometry shifts
   * (e.g. width change), or as a safety net whenever the active cabinet is rebuilt.
   */
  function repositionPlaced(descCode, xOffset, rowIdx) {
    for (const ch of _placed) {
      const slots = _buildSlots(descCode, xOffset, rowIdx, ch.code);
      const slot = slots[ch.slotIdx];
      if (slot) {
        ch.mesh.position.copy(slot.position);
        ch.mesh.rotation.y = CabinetUtils.rowRotY(rowIdx);
        const p = CabinetBuilder.parseCode(descCode);
        if (p) ch.mesh.userData.deCode = p.de;
      }
    }
  }

  /* ══════════════════════════════════════════════════
     PUBLIC API
  ════════════════════════════════════════════════════ */

  function setScene(s) { _scene = s; }

  return {
    init,
    setScene,
    clear,
    clearAll,
    repositionPlaced,
    finalizeCurrent,
    saveEditBack,
    loadForEdit,
    rebuildAllChassis,
    rebuildFromState,
    renderCards,
    renderThumbs,
    captureThumb,
    CHASSIS_CATALOG,
    _isDragging: () => _dragging,
    getPlaced: () => [..._lockedPlaced, ..._placed],
    hitTest(clientX, clientY) {
      if (!_camera || !_canvas || _placed.length === 0) return false;
      const raycaster = new THREE.Raycaster();
      const rect = _canvas.getBoundingClientRect();
      raycaster.setFromCamera({
        x:  ((clientX - rect.left) / rect.width)  * 2 - 1,
        y: -((clientY - rect.top)  / rect.height) * 2 + 1,
      }, _camera);
      return raycaster.intersectObjects(_placed.map(p => p.mesh), true).length > 0;
    },
  };
})();
