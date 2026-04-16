/**
 * scene-edges.js
 * "Hidden line" display mode — flat white faces + dark structural edges,
 * similar to SketchUp's hidden line rendering mode.
 */

window.SceneEdges = (function () {
  'use strict';

  var _active     = false;
  var _EDGE_COLOR = 0x1a2a3a;
  var _ANGLE      = 25; // degrees — threshold for EdgesGeometry

  var _WHITE_MAT  = null; // shared flat-white material (lazy init)

  function _getWhiteMat() {
    if (!_WHITE_MAT) {
      _WHITE_MAT = new THREE.MeshBasicMaterial({ color: 0xf4f4f4, side: THREE.FrontSide });
    }
    return _WHITE_MAT;
  }

  function _skip(obj) {
    return obj.userData.isSlotMesh
        || obj.userData.isOriginMarker
        || obj.userData.isEdgeOverlay
        || (obj.name && obj.name.startsWith('LockedHighlight'));
  }

  function _addHiddenLine(obj) {
    if (!obj.isMesh || _skip(obj) || obj.__hlActive) return;

    // Save original material(s)
    obj.__hlOrigMat = obj.material;

    // Replace with flat white
    var whiteMat = _getWhiteMat();
    obj.material = Array.isArray(obj.__hlOrigMat)
      ? obj.__hlOrigMat.map(function () { return whiteMat; })
      : whiteMat;

    // Add edges
    try {
      var geo   = new THREE.EdgesGeometry(obj.geometry, _ANGLE);
      var mat   = new THREE.LineBasicMaterial({ color: _EDGE_COLOR, depthTest: true });
      var lines = new THREE.LineSegments(geo, mat);
      lines.userData.isEdgeOverlay = true;
      lines.raycast = function () {};

      // Offset white faces back slightly so edges win
      obj.material = Array.isArray(obj.material) ? obj.material : obj.material;
      var faceMats = Array.isArray(obj.material) ? obj.material : [obj.material];
      faceMats.forEach(function (m) {
        m.polygonOffset       = true;
        m.polygonOffsetFactor = 1;
        m.polygonOffsetUnits  = 1;
      });

      obj.add(lines);
      obj.__hlLines  = lines;
    } catch (e) { /* skip broken geometries */ }

    obj.__hlActive = true;
  }

  function _removeHiddenLine(obj) {
    if (!obj.__hlActive) return;

    // Restore original material
    obj.material = obj.__hlOrigMat;
    obj.__hlOrigMat = null;

    // Remove edge lines
    if (obj.__hlLines) {
      obj.remove(obj.__hlLines);
      obj.__hlLines.geometry.dispose();
      obj.__hlLines.material.dispose();
      obj.__hlLines = null;
    }

    obj.__hlActive = false;
  }

  function enable() {
    if (_active) return;
    _active = true;
    if (window.Cabinet && Cabinet.scene) Cabinet.scene.traverse(_addHiddenLine);
    var btn = document.getElementById('edgesBtn');
    if (btn) btn.classList.add('active');
  }

  function disable() {
    if (!_active) return;
    _active = false;
    if (window.Cabinet && Cabinet.scene) Cabinet.scene.traverse(_removeHiddenLine);
    var btn = document.getElementById('edgesBtn');
    if (btn) btn.classList.remove('active');
  }

  function toggle() { _active ? disable() : enable(); }
  function isActive() { return _active; }

  function refresh() {
    if (_active && window.Cabinet && Cabinet.scene) Cabinet.scene.traverse(_addHiddenLine);
  }

  window.addEventListener('cabinetBuilt', refresh);

  return { enable: enable, disable: disable, toggle: toggle, isActive: isActive, refresh: refresh };
})();
