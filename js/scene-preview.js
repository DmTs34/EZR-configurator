/**
 * scene-preview.js
 * "Scene Preview" mode — clean, non-interactive view of the 3D scene.
 *
 * enable()  — block canvas interaction, hide UI overlays
 * disable() — restore everything
 * toggle()  — used by the header eye button
 * isActive()
 *
 * Used for:
 *   1. Header eye button (toggle clean view of current configuration)
 *   2. Ready configuration preview from the welcome gallery (welcome.js)
 */

window.ScenePreview = (function () {
  'use strict';

  var _active = false;

  /* Elements to hide during preview mode */
  function _uiElements() {
    return [
      document.querySelector('.gizmo-hint'),
      document.getElementById('doorControls'),
      document.getElementById('canvasStatus'),
      document.getElementById('cameraStatusbar'),
    ];
  }

  function enable() {
    if (_active) return;
    _active = true;

    /* Hide 3D scene UI elements */
    if (window.CabinetBuilder) {
      CabinetBuilder.setLabelsVisible(false);
      CabinetBuilder.setHighlightsVisible(false);
    }
    if (window.CabinetArrow) CabinetArrow.setVisible(false);
    if (window.CabinetFloor) CabinetFloor.setOriginSphereVisible(false);

    _uiElements().forEach(function (el) {
      if (el) el.style.visibility = 'hidden';
    });

    /* Hide sidebar */
    var sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = 'none';

    /* Mark header button as active */
    var btn = document.getElementById('previewModeBtn');
    if (btn) btn.classList.add('active');
  }

  function disable() {
    if (!_active) return;
    _active = false;

    /* Restore 3D scene UI */
    if (window.CabinetBuilder) {
      CabinetBuilder.setLabelsVisible(true);
      CabinetBuilder.setHighlightsVisible(true);
    }
    if (window.CabinetArrow) CabinetArrow.setVisible(true);
    if (window.CabinetFloor) CabinetFloor.setOriginSphereVisible(true);

    _uiElements().forEach(function (el) {
      if (el) el.style.visibility = '';
    });

    /* Restore sidebar */
    var sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = '';

    /* Restore header button */
    var btn = document.getElementById('previewModeBtn');
    if (btn) btn.classList.remove('active');
  }

  function toggle() {
    _active ? disable() : enable();
  }

  function isActive() { return _active; }

  return { enable: enable, disable: disable, toggle: toggle, isActive: isActive };
})();
