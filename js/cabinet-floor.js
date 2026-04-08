/**
 * cabinet-floor.js
 * Manages dynamic floor grid - calculates cabinet bounds and adjusts floor tiles.
 *
 * The floor grid automatically expands/contracts to fit all cabinets with
 * 1 free tile margin on all sides. Minimum size: 4 tiles wide × 5 tiles deep.
 */
window.CabinetFloor = (function () {
  'use strict';

  /* ── Constants ────────────────────────────────────────────────────────── */
  const GRID_CELL       = 0.6;   // 600 mm per cell
  const GRID_MIN_COLS   = 4;     // Minimum 4 columns (2.4m)
  const GRID_MIN_ROWS   = 3;     // Minimum 3 rows (1.8m)
  const CABINET_DEPTH_MM = 300;  // Cabinet depth in mm (300-340mm range)

  /* ── Module state ─────────────────────────────────────────────────────── */
  let _floorGrid        = null;
  let _floorGridLeftCol = -2;    // Current left column (dynamically updated)
  let _floorGridRightCol = 1;    // Current right column (dynamically updated) - 4 cols
  let _floorGridMinRow  = -1;    // Current front row (dynamically updated)
  let _floorGridMaxRow  = 1;     // Current back row (dynamically updated) - 3 rows
  let _tileGeos         = null;  // Shared geometry/materials for tiles
  let _updating         = false; // Guard against recursive updates

  /* ── Tile geometry & materials ────────────────────────────────────────── */
  function _getTileGeos() {
    if (!_tileGeos) {
      if (!window.THREE) return null;
      try {
        const INNER = GRID_CELL * 0.984;
        _tileGeos = {
          fill: new THREE.PlaneGeometry(INNER, INNER),
          edge: new THREE.EdgesGeometry(new THREE.PlaneGeometry(GRID_CELL, GRID_CELL)),
          fillMat: new THREE.MeshBasicMaterial({ color: 0xf2f4f5, side: THREE.DoubleSide }),
          edgeMat: new THREE.LineBasicMaterial({ color: 0xcccccc }),
        };
      } catch (err) {
        console.error('[CabinetFloor] Error creating tile geometries:', err);
        return null;
      }
    }
    return _tileGeos;
  }


  /* ── Initialization ───────────────────────────────────────────────────── */
  function init() {
    if (!Cabinet.scene) {
      return;
    }
    _floorGrid = new THREE.Group();
    _floorGrid.name = 'floorGrid';

    // Create initial tiles
    const geos = _getTileGeos();
    if (geos) {
      const { fill, edge, fillMat, edgeMat } = geos;
      for (let col = _floorGridLeftCol; col <= _floorGridRightCol; col++) {
        for (let row = _floorGridMinRow; row <= _floorGridMaxRow; row++) {
          const cx = (col + 0.5) * GRID_CELL;
          const cz = (row + 0.5) * GRID_CELL;

          const f = new THREE.Mesh(fill, fillMat);
          f.rotation.x = -Math.PI / 2;
          f.position.set(cx, -0.001, cz);
          f.userData.tileCol = col;
          f.userData.tileRow = row;
          _floorGrid.add(f);

          const b = new THREE.LineSegments(edge, edgeMat);
          b.rotation.x = -Math.PI / 2;
          b.position.set(cx, -0.001, cz);
          b.userData.tileCol = col;
          b.userData.tileRow = row;
          _floorGrid.add(b);
        }
      }
    }

    Cabinet.scene.add(_floorGrid);
  }

  /* ── Visibility control ───────────────────────────────────────────────── */
  function setVisible(v) {
    if (_floorGrid) _floorGrid.visible = v;
  }

  /* ── Bounds calculation ───────────────────────────────────────────────── */
  /**
   * Calculate bounding box of all cabinets across all rows.
   * @returns {object} { minX, maxX, minZ, maxZ } in meters
   */
  function _calcFloorBounds() {
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    // Safety checks
    if (!window.Cabinet || !Cabinet.cabinets || !Cabinet.rows || !window.CabinetBuilder) {
      return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
    }

    // If no cabinets, use origin (0, 0)
    if (Cabinet.cabinets.length === 0) {
      return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
    }

    for (const cab of Cabinet.cabinets) {
      if (!cab || !cab.code) continue;
      const rowIdx = cab.rowIdx ?? 0;
      if (rowIdx < 0 || rowIdx >= Cabinet.rows.length) continue;
      const row = Cabinet.rows[rowIdx];
      if (!row || typeof row.origin !== 'object') continue;

      const p = CabinetBuilder.parseCode(cab.code);
      if (!p || typeof p.widthMM !== 'number') continue;

      const MM = 0.001; // Convert mm to meters

      // Get world position of cabinet (left/front edge)
      const ox = row.origin.x * MM;
      const oz = row.origin.z * MM;
      const d = cab.xOffset * MM;

      const flipShift = (row.flipped && p.widthMM) ? p.widthMM * MM : 0;
      const depthShift = row.flipped ? (300 * MM) : 0;  // 300mm offset when flipped

      let cabX0, cabX1, cabZ0, cabZ1;

      if (row.angle === 0) {
        // Horizontal row: cabinets extend along X axis
        cabX0 = ox + d + flipShift;
        cabX1 = cabX0 + (p.widthMM * MM);
        cabZ0 = oz + depthShift;
        cabZ1 = cabZ0 + (CABINET_DEPTH_MM * MM);
      } else {
        // Rotated row: cabinets extend along Z axis
        cabX0 = ox + depthShift;
        cabX1 = cabX0 + (CABINET_DEPTH_MM * MM);
        cabZ0 = oz - d - flipShift - (p.widthMM * MM);
        cabZ1 = cabZ0 + (p.widthMM * MM);
      }

      minX = Math.min(minX, cabX0, cabX1);
      maxX = Math.max(maxX, cabX0, cabX1);
      minZ = Math.min(minZ, cabZ0, cabZ1);
      maxZ = Math.max(maxZ, cabZ0, cabZ1);
    }

    return {
      minX: minX === Infinity ? 0 : minX,
      maxX: maxX === -Infinity ? 0 : maxX,
      minZ: minZ === Infinity ? 0 : minZ,
      maxZ: maxZ === -Infinity ? 0 : maxZ,
    };
  }

  /* ── Grid update ──────────────────────────────────────────────────────── */
  /**
   * Dynamically update floor grid to fit all cabinets with 1 free tile margin.
   * Expands/contracts on all sides (X and Z axes).
   * Enforces minimum size of 4×5 tiles (2.4m × 3.0m).
   */
  function update() {
    if (!_floorGrid || _updating) {
      return;
    }
    _updating = true;

    try {
      const bounds = _calcFloorBounds();

      // Add 1 tile (600mm) margin on all sides, convert to tile coordinates
      const margin = GRID_CELL; // 0.6m
      const leftCol = Math.floor((bounds.minX - margin) / GRID_CELL);
      const rightCol = Math.ceil((bounds.maxX + margin) / GRID_CELL) - 1;
      const minRow = Math.floor((bounds.minZ - margin) / GRID_CELL);
      const maxRow = Math.ceil((bounds.maxZ + margin) / GRID_CELL) - 1;

      // Enforce minimum size (4×3 tiles = 2.4m × 1.8m)
      const colSpan = rightCol - leftCol + 1;
      const rowSpan = maxRow - minRow + 1;

      let neededLeftCol = leftCol;
      let neededRightCol = rightCol;
      if (colSpan < GRID_MIN_COLS) {
        const minColHalf = Math.floor((GRID_MIN_COLS - 1) / 2);
        neededLeftCol = Math.min(leftCol, -minColHalf);
        neededRightCol = Math.max(rightCol, minColHalf);
      }

      let neededMinRow = minRow;
      let neededMaxRow = maxRow;
      if (rowSpan < GRID_MIN_ROWS) {
        const minRowHalf = Math.floor((GRID_MIN_ROWS - 1) / 2);
        neededMinRow = Math.min(minRow, -minRowHalf);
        neededMaxRow = Math.max(maxRow, minRowHalf);
      }

      // If dimensions haven't changed, nothing to do
      if (_floorGridLeftCol === neededLeftCol && _floorGridRightCol === neededRightCol &&
          _floorGridMinRow === neededMinRow && _floorGridMaxRow === neededMaxRow) {
        return;
      }

      // Remove all existing tiles
      const toRemove = [];
      _floorGrid.traverse(o => {
        if (o.userData.tileCol !== undefined && o.userData.tileRow !== undefined) {
          toRemove.push(o);
        }
      });
      for (const o of toRemove) _floorGrid.remove(o);

      // Add all new tiles
      const geos = _getTileGeos();
      if (geos) {
        const { fill, edge, fillMat, edgeMat } = geos;
        for (let col = neededLeftCol; col <= neededRightCol; col++) {
          for (let row = neededMinRow; row <= neededMaxRow; row++) {
            const cx = (col + 0.5) * GRID_CELL;
            const cz = (row + 0.5) * GRID_CELL;

            const f = new THREE.Mesh(fill, fillMat);
            f.rotation.x = -Math.PI / 2;
            f.position.set(cx, -0.001, cz);
            f.userData.tileCol = col;
            f.userData.tileRow = row;
            _floorGrid.add(f);

            const b = new THREE.LineSegments(edge, edgeMat);
            b.rotation.x = -Math.PI / 2;
            b.position.set(cx, -0.001, cz);
            b.userData.tileCol = col;
            b.userData.tileRow = row;
            _floorGrid.add(b);
          }
        }
      }

      // Update state
      _floorGridLeftCol = neededLeftCol;
      _floorGridRightCol = neededRightCol;
      _floorGridMinRow = neededMinRow;
      _floorGridMaxRow = neededMaxRow;
    } finally {
      _updating = false;
    }
  }

  /* ── Public API ──────────────────────────────────────────────────────── */
  return {
    init,
    update,
    setVisible,
  };
})();

// Auto-initialize when scene is ready
window.addEventListener('cabinetSceneReady', () => CabinetFloor.init());
