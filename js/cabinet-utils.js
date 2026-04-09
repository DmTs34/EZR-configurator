/**
 * cabinet-utils.js
 * Shared utility functions used across cabinet modules.
 * Depends on: cabinet-state.js (window.Cabinet)
 */
window.CabinetUtils = (function () {
  'use strict';

  const MM = 0.001;

  /**
   * Returns the row object for the given row index.
   * @param {number|null} rowIdx
   * @returns {{ origin: {x,z}, angle: number, flipped: boolean }}
   */
  function getRow(rowIdx) {
    const idx = rowIdx ?? Cabinet.activeRowIdx ?? 0;
    return Cabinet.rows?.[idx] ?? { origin: { x: 0, z: 0 }, angle: 0, flipped: false };
  }

  /**
   * Calculates Y rotation (radians) for a row accounting for angle and flip.
   * angle=0 → cabinet grows along +X
   * angle=1 → cabinet grows along -Z
   * flipped → cabinet faces opposite direction (+π)
   * @param {number|null} rowIdx
   * @returns {number} Rotation in radians
   */
  function rowRotY(rowIdx) {
    const row = getRow(rowIdx);
    const base = row.angle * (Math.PI / 2);
    return row.flipped ? base + Math.PI : base;
  }

  /**
   * Converts local cabinet X offset to world position accounting for row
   * origin, angle, flip, and cabinet width.
   * @param {number} xOffsetMM - X position within row (mm)
   * @param {number|null} rowIdx
   * @param {number} widthMM - Cabinet width for flip compensation (mm)
   * @returns {{ x: number, z: number }} World position in THREE.js units
   */
  function rowWorldPos(xOffsetMM, rowIdx, widthMM) {
    const row = getRow(rowIdx);
    const ox = row.origin.x * MM;
    const oz = row.origin.z * MM;
    const d = xOffsetMM * MM;
    const DEPTH_MM = 300;
    const flipShift = (row.flipped && widthMM) ? widthMM * MM : 0;
    const depthShift = row.flipped ? DEPTH_MM * MM : 0;
    if (row.angle === 0) return { x: ox + d + flipShift, z: oz + depthShift };
    return { x: ox + depthShift, z: oz - d - flipShift };
  }

  /**
   * Converts local cabinet-space coordinates (mm) to world THREE.Vector3,
   * accounting for row position, angle, and flip.
   * @param {number} lxMM - Local X in mm
   * @param {number} lyMM - Local Y in mm
   * @param {number} lzMM - Local Z in mm
   * @param {number} xOffsetMM - Cabinet X offset within row (mm)
   * @param {number|null} rowIdx
   * @param {number} widthMM - Cabinet width for flip compensation (mm)
   * @returns {THREE.Vector3}
   */
  function localToWorld(lxMM, lyMM, lzMM, xOffsetMM, rowIdx, widthMM) {
    const rotY = rowRotY(rowIdx);
    const cosR = Math.cos(rotY);
    const sinR = Math.sin(rotY);
    const { x: pivotX, z: pivotZ } = rowWorldPos(xOffsetMM, rowIdx, widthMM);
    const dlx = lxMM * MM;
    const dlz = lzMM * MM;
    return new THREE.Vector3(
      pivotX + dlx * cosR + dlz * sinR,
      lyMM * MM,
      pivotZ - dlx * sinR + dlz * cosR,
    );
  }

  return { getRow, rowRotY, rowWorldPos, localToWorld };
})();
