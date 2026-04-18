/**
 * welcome.js
 * Welcome screen, configuration gallery, and configuration preview modal.
 *
 * Flow:
 *   1. Page loads → #welcomeScreen shown immediately (loading phase)
 *   2. Main Three.js scene fires 'cabinetSceneReady' → show mode cards
 *   3a. "Configure yourself" → dismiss welcome screen, use main app as-is
 *   3b. "Ready configurations" → dismiss welcome screen, show gallery overlay
 *   4. Gallery: click eye icon → open preview modal with isolated Three.js scene
 *   5. Preview: "Open for editing" → load config into main scene, close everything
 */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────
     Loading progress
  ────────────────────────────────────────────────────── */

  let _sceneReady  = false;
  let _progressTimer = null;

  function _setProgress(pct, status) {
    const bar = document.getElementById('welcomeProgressBar');
    const st  = document.getElementById('welcomeStatus');
    if (bar) bar.style.width = pct + '%';
    if (st && status) st.textContent = status;
  }

  function _startProgressSim() {
    // Ramp quickly to ~85 %, stall until cabinetSceneReady, then jump to 100 %
    const steps = [
      { delay:  150, pct: 18, text: 'Initializing scene…' },
      { delay:  500, pct: 42, text: 'Loading 3D models…'  },
      { delay: 1100, pct: 68, text: 'Loading 3D models…'  },
      { delay: 1800, pct: 85, text: 'Preparing scene…'    },
    ];

    function runStep(i) {
      if (i >= steps.length) return;
      const s = steps[i];
      _progressTimer = setTimeout(() => {
        _setProgress(s.pct, s.text);
        if (_sceneReady) { _onSceneReadyInternal(); } else { runStep(i + 1); }
      }, s.delay);
    }
    runStep(0);
  }

  function _onSceneReadyInternal() {
    if (_progressTimer) { clearTimeout(_progressTimer); _progressTimer = null; }
    _sceneReady = true;
    _setProgress(100, 'Ready!');
    setTimeout(_showWelcomeCards, 350);
  }

  function _showWelcomeCards() {
    const loading = document.getElementById('welcomeLoading');
    const cards   = document.getElementById('welcomeCards');
    if (loading) loading.classList.add('hidden');
    if (cards)   setTimeout(() => cards.classList.add('visible'), 200);
  }

  /* ──────────────────────────────────────────────────────
     Mode selection (called from onclick in HTML)
  ────────────────────────────────────────────────────── */

  function selectWelcomeMode(mode) {
    _hideWelcomeScreen(function () {
      if (mode === 'presets') _showGallery();
    });
  }
  window.selectWelcomeMode = selectWelcomeMode;

  function _hideWelcomeScreen(callback) {
    const el = document.getElementById('welcomeScreen');
    if (!el) { if (callback) callback(); return; }
    el.classList.add('hidden');
    setTimeout(function () {
      el.style.display = 'none';
      if (callback) callback();
    }, 550);
  }

  /* ──────────────────────────────────────────────────────
     Configuration gallery
  ────────────────────────────────────────────────────── */

  var _galleryOpenedFromApp = false;

  function backToWelcome() {
    var overlay = document.getElementById('configGalleryOverlay');
    if (overlay) overlay.classList.remove('visible');
    if (_galleryOpenedFromApp) {
      // Came from main app — just close the overlay, no welcome screen
      _galleryOpenedFromApp = false;
      return;
    }
    var screen = document.getElementById('welcomeScreen');
    if (screen) {
      screen.style.display = '';
      requestAnimationFrame(function () { screen.classList.remove('hidden'); });
    }
  }
  window.backToWelcome = backToWelcome;

  function _showGallery() {
    var overlay = document.getElementById('configGalleryOverlay');
    if (!overlay) return;
    _renderGallery();
    overlay.classList.add('visible');
  }

  var _galleryListenerAdded = false;

  function _renderGallery() {
    var grid = document.getElementById('configGalleryGrid');
    if (!grid) return;

    var catalog = window.CONFIGURATIONS_CATALOG;
    if (!catalog || !catalog.length) {
      grid.innerHTML = '<div class="config-gallery-empty">No configurations available yet.</div>';
      return;
    }

    grid.innerHTML = catalog.map(function (cfg, i) {
      var imgHtml = cfg.image
        ? '<img class="config-card-img" src="' + cfg.image + '" alt="' + _esc(cfg.name) + '"'
          + ' onerror="this.outerHTML=\'<div class=\\\'config-card-img-placeholder\\\'>No image</div>\'">'
        : '<div class="config-card-img-placeholder">No image</div>';

      return '<div class="config-card" data-idx="' + i + '">'
        + imgHtml
        + '<div class="config-card-body">'
        +   '<div class="config-card-name">' + _esc(cfg.name) + '</div>'
        +   '<div class="config-card-desc">'  + _esc(cfg.shortDesc) + '</div>'
        + '</div>'
        + '<button class="config-card-eye" data-eye="' + i + '" title="Preview 3D">'
        +   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
        +     ' stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'
        +     '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>'
        +     '<circle cx="12" cy="12" r="3"/>'
        +   '</svg>'
        + '</button>'
        + '</div>';
    }).join('');

    // Attach click delegation only once — grid.innerHTML replaces DOM nodes
    // but the listener stays on the grid element itself; guard against duplicates
    if (!_galleryListenerAdded) {
      _galleryListenerAdded = true;
      grid.addEventListener('click', function (e) {
        var eye = e.target.closest('[data-eye]');
        if (eye) { e.stopPropagation(); openConfigPreview(+eye.dataset.eye); return; }
        var card = e.target.closest('[data-idx]');
        if (card) openConfigPreview(+card.dataset.idx);
      });
    }
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ──────────────────────────────────────────────────────
     Config preview modal
     Isolated Three.js scene — scene swap technique.
     Cabinet.scene is temporarily pointed at a fresh scene
     while loadExample() builds the config into it.
     The preview renders on #configPreviewCanvas with its
     own camera and orbit controls.
     Main scene is never touched.
  ────────────────────────────────────────────────────── */

  function _buildSpecsTable(cfg) {
    var specs = cfg.specs;
    if (!specs || !Object.keys(specs).length) {
      return '<span class="specs-empty">' + _esc(cfg.fullDesc || cfg.shortDesc || '') + '</span>';
    }
    var rows = Object.keys(specs).map(function (key) {
      var val = specs[key];
      var display = (val === null || val === undefined) ? '—' : _esc(String(val)).replace(/&lt;br&gt;/g, '<br>');
      return '<tr><td class="specs-key">' + _esc(key) + '</td><td class="specs-val">' + display + '</td></tr>';
    }).join('');
    return '<table class="specs-table"><thead><tr><th>Characteristic</th><th>Data</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  var _ConfigPreview = (function () {

    var _renderer   = null;
    var _scene      = null;   // isolated preview scene
    var _mainScene  = null;   // saved Cabinet.scene
    var _camera     = null;
    var _raf        = null;
    var _canvas     = null;
    var _configFile = null;

    /* ── Cabinet state snapshot ──────────────────────── */
    var _savedCabinetState = null;
    var _savedBuilderState = null;

    function _saveCabinetState() {
      _savedCabinetState = {
        projectName:            Cabinet.projectName,
        inputMode:              Cabinet.inputMode,
        descriptionCode:        Cabinet.descriptionCode,
        wizardSelections:       JSON.parse(JSON.stringify(Cabinet.wizardSelections  || {})),
        isCodeValid:            Cabinet.isCodeValid,
        selectedFrameId:        Cabinet.selectedFrameId,
        mountingPlates:         JSON.parse(JSON.stringify(Cabinet.mountingPlates    || [])),
        rows:                   JSON.parse(JSON.stringify(Cabinet.rows              || [])),
        activeRowIdx:           Cabinet.activeRowIdx,
        cabinets:               JSON.parse(JSON.stringify(Cabinet.cabinets          || [])),
        currentCabinetXOffset:  Cabinet.currentCabinetXOffset,
        editingIdx:             Cabinet.editingIdx,
        bom:                    JSON.parse(JSON.stringify(Cabinet.bom               || [])),
        placedAccessories:      JSON.parse(JSON.stringify(Cabinet.placedAccessories || [])),
        placedChassis:          JSON.parse(JSON.stringify(Cabinet.placedChassis     || [])),
        activeStep:             Cabinet.activeStep,
        noFadeNext:             Cabinet.noFadeNext,
      };
    }

    function _restoreCabinetState() {
      if (!_savedCabinetState) return;
      var s = _savedCabinetState;
      Cabinet.projectName           = s.projectName;
      Cabinet.inputMode             = s.inputMode;
      Cabinet.descriptionCode       = s.descriptionCode;
      Cabinet.wizardSelections      = s.wizardSelections;
      Cabinet.isCodeValid           = s.isCodeValid;
      Cabinet.selectedFrameId       = s.selectedFrameId;
      Cabinet.mountingPlates        = s.mountingPlates;
      Cabinet.rows                  = s.rows;
      Cabinet.activeRowIdx          = s.activeRowIdx;
      Cabinet.cabinets              = s.cabinets;
      Cabinet.currentCabinetXOffset = s.currentCabinetXOffset;
      Cabinet.editingIdx            = s.editingIdx;
      Cabinet.bom                   = s.bom;
      Cabinet.placedAccessories     = s.placedAccessories;
      Cabinet.placedChassis         = s.placedChassis;
      Cabinet.activeStep            = s.activeStep;
      Cabinet.noFadeNext            = s.noFadeNext;
      _savedCabinetState = null;
    }

    var _theta  = 0.5;
    var _phi    = 1.1;
    var _radius = 5;
    var _target = null;  // THREE.Vector3, created in open()
    var _drag   = null;

    /* ── Cable animation state ────────────────────────── */
    var _cableGroup     = null;
    var _cableAnimState = [];
    var _cableAnimMode  = 'sequential';
    var _lineMaterials  = [];   // LineMaterial instances — need resolution updated on resize

    /* ── Render loop ──────────────────────────────────── */
    function _loop() {
      _raf = requestAnimationFrame(_loop);
      var W = _canvas.clientWidth;
      var H = _canvas.clientHeight;
      if (W > 0 && H > 0) {
        var pr   = _renderer.getPixelRatio();
        var bufW = Math.floor(W * pr);
        var bufH = Math.floor(H * pr);
        if (_renderer.domElement.width !== bufW || _renderer.domElement.height !== bufH) {
          _renderer.setSize(W, H, false);
          _camera.aspect = W / H;
          _camera.updateProjectionMatrix();
          _lineMaterials.forEach(function (m) { m.resolution.set(W, H); });
        }
      }
      _camera.position.set(
        _target.x + _radius * Math.sin(_phi) * Math.sin(_theta),
        _target.y + _radius * Math.cos(_phi),
        _target.z + _radius * Math.sin(_phi) * Math.cos(_theta)
      );
      _camera.lookAt(_target);
      _tickCableAnim();
      _renderer.render(_scene, _camera);
    }

    function _tickCableAnim() {
      for (var i = 0; i < _cableAnimState.length; i++) {
        var s = _cableAnimState[i];
        if (s.done || !s.active) continue;
        s.current = Math.min(s.current + s.speed, s.total);
        s.mesh.geometry.instanceCount = Math.floor(s.current);
        if (s.current >= s.total) {
          s.done = true;
          if (_cableAnimMode === 'sequential' && i + 1 < _cableAnimState.length)
            _cableAnimState[i + 1].active = true;
        }
      }
    }

    /* ── Cable API (same contract as _PreviewScene) ──────── */
    var _sphereMat = null;

    function buildCables(cables, anim, waypoints) {
      if (!_cableGroup) return;
      while (_cableGroup.children.length) {
        var m = _cableGroup.children[0];
        _cableGroup.remove(m);
        if (m.geometry) m.geometry.dispose();
        if (m.material && m.material !== _sphereMat) {
          if (m.material.map) m.material.map.dispose();
          m.material.dispose();
        }
      }
      _cableAnimState = [];
      _lineMaterials  = [];
      _cableAnimMode  = (anim && anim.mode) || 'sequential';
      var animated = !anim || anim.enabled !== false;
      var duration = (anim && anim.duration) || 0.6;
      var MM = 0.001;
      var W = _canvas ? _canvas.clientWidth  : 800;
      var H = _canvas ? _canvas.clientHeight : 600;

      // Build per-group wpMap
      var wpGroupMap   = {};
      var allWaypoints = [];
      var waypointGroups = waypoints || [];
      if (waypointGroups.length > 0) {
        if (waypointGroups[0].waypoints !== undefined) {
          waypointGroups.forEach(function (g) {
            var m = {};
            (g.waypoints || []).forEach(function (wp) { m[wp.id] = wp; });
            wpGroupMap[g.id] = m;
            allWaypoints = allWaypoints.concat(g.waypoints || []);
          });
        } else {
          var m = {};
          waypointGroups.forEach(function (wp) { m[wp.id] = wp; });
          wpGroupMap['default'] = m;
          allWaypoints = waypointGroups;
        }
      }

      cables.forEach(function (cable, ci) {
        var groupId = cable.group || 'default';
        var wpMap   = wpGroupMap[groupId] || wpGroupMap[Object.keys(wpGroupMap)[0]] || {};
        var rawPts;
        if (cable.path && cable.path.length >= 2) {
          rawPts = cable.path.map(function (id) { return wpMap[id]; }).filter(Boolean);
        } else if (cable.points && cable.points.length >= 2) {
          rawPts = cable.points;
        } else { return; }
        if (rawPts.length < 2) return;

        var pts      = rawPts.map(function (p) { return new THREE.Vector3(p.x * MM, p.y * MM, p.z * MM); });
        var curve    = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', cable.tension !== undefined ? cable.tension : 0.5);
        var segments = cable.tubularSegments || 48;
        var sampled  = curve.getPoints(segments);
        var flat     = [];
        sampled.forEach(function (p) { flat.push(p.x, p.y, p.z); });

        var resolvedColor = (cable.type && window.CableTypes && window.CableTypes[cable.type])
          ? window.CableTypes[cable.type].color
          : (cable.color || '#222222');
        var lineWidth = Math.max(1.5, (cable.radius || 4) * 0.4);

        var geom = new THREE.LineGeometry();
        geom.setPositions(flat);
        var mat = new THREE.LineMaterial({
          color:      resolvedColor,
          linewidth:  lineWidth,
          resolution: new THREE.Vector2(W, H),
        });
        _lineMaterials.push(mat);
        var line = new THREE.Line2(geom, mat);
        line.computeLineDistances();
        _cableGroup.add(line);

        var total = segments;
        var speed = total / (duration * 60);
        if (animated) geom.instanceCount = 0;
        _cableAnimState.push({ mesh: line, total: total, current: animated ? 0 : total, speed: speed, active: false, done: !animated });
      });

      // Edit mode markers
      if (window.PreviewPointsEditVisible !== false) {
        if (!_sphereMat) _sphereMat = new THREE.MeshStandardMaterial({ color: 0xff2222, depthTest: false });
        var SR = 6 * MM;
        if (allWaypoints.length > 0) {
          allWaypoints.forEach(function (wp) {
            var pt = new THREE.Vector3(wp.x * MM, wp.y * MM, wp.z * MM);
            var sg = new THREE.SphereGeometry(SR, 8, 6);
            var sm = new THREE.Mesh(sg, _sphereMat);
            sm.position.copy(pt); sm.renderOrder = 1;
            _cableGroup.add(sm);
            if (window._makeLabelSprite) {
              var sprite = window._makeLabelSprite(String(wp.id), SR * 5);
              sprite.position.set(pt.x + SR * 2.5, pt.y + SR * 2.5, pt.z);
              _cableGroup.add(sprite);
            }
          });
        } else {
          cables.forEach(function (cable, ci) {
            if (!cable.points) return;
            var sr = (cable.radius || 4) * 1.6 * MM;
            cable.points.forEach(function (p, pi) {
              var pt = new THREE.Vector3(p.x * MM, p.y * MM, p.z * MM);
              var sg = new THREE.SphereGeometry(sr, 8, 6);
              var sm = new THREE.Mesh(sg, _sphereMat);
              sm.position.copy(pt); sm.renderOrder = 1;
              _cableGroup.add(sm);
              if (window._makeLabelSprite) {
                var sprite = window._makeLabelSprite((ci + 1) + '-' + (pi + 1), sr * 5);
                sprite.position.set(pt.x + sr * 2.5, pt.y + sr * 2.5, pt.z);
                _cableGroup.add(sprite);
              }
            });
          });
        }
      }

      if (animated && _cableAnimState.length > 0) {
        if (_cableAnimMode === 'sequential') { _cableAnimState[0].active = true; }
        else { _cableAnimState.forEach(function (s) { s.active = true; }); }
      }
    }

    function replayAnimation() {
      _cableAnimState.forEach(function (s, i) {
        s.current = 0; s.done = false;
        s.active = _cableAnimMode !== 'sequential' || i === 0;
        s.mesh.geometry.instanceCount = 0;
      });
    }

    function applyCamera(cam) {
      var DEG = Math.PI / 180;
      if (cam.theta  !== undefined) _theta  = cam.theta  * DEG;
      if (cam.phi    !== undefined) _phi    = cam.phi    * DEG;
      if (cam.radius !== undefined) _radius = cam.radius;
      if (cam.target) _target.set(cam.target.x, cam.target.y, cam.target.z);
    }

    function getCamera() {
      var RAD = 180 / Math.PI;
      return {
        theta:  +(_theta  * RAD).toFixed(2),
        phi:    +(_phi    * RAD).toFixed(2),
        radius: +_radius.toFixed(4),
        target: { x: +_target.x.toFixed(4), y: +_target.y.toFixed(4), z: +_target.z.toFixed(4) },
      };
    }

    /* ── Auto-fit camera to scene contents ───────────── */
    function _autoFit() {
      var box = new THREE.Box3();
      _scene.traverse(function (obj) {
        if (obj.isMesh) box.expandByObject(obj);
      });
      if (box.isEmpty()) return;
      var center = new THREE.Vector3();
      box.getCenter(center);
      _target.copy(center);
      var size = box.getSize(new THREE.Vector3());
      _radius = Math.max(size.x, size.y, size.z) * 2.2;
      _theta  = 0.5;
      _phi    = 1.1;
    }

    /* ── Orbit controls ───────────────────────────────── */
    function _onDown(e) {
      if (e.button === 2) {
        _drag = { type: 'pan', x: e.clientX, y: e.clientY };
      } else {
        _drag = { type: 'orbit', x: e.clientX, y: e.clientY, theta: _theta, phi: _phi };
      }
      _canvas.setPointerCapture(e.pointerId);
    }
    function _onMove(e) {
      if (!_drag) return;
      var dx = e.clientX - _drag.x;
      var dy = e.clientY - _drag.y;
      if (_drag.type === 'orbit') {
        _theta = _drag.theta - dx * 0.01;
        _phi   = Math.max(0.05, Math.min(Math.PI - 0.05, _drag.phi + dy * 0.01));
      } else {
        var dir   = new THREE.Vector3().subVectors(_target, _camera.position).normalize();
        var right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        var up    = new THREE.Vector3().crossVectors(right, dir).normalize();
        var speed = _radius * 0.001;
        _target.addScaledVector(right, -dx * speed);
        _target.addScaledVector(up,     dy * speed);
        _drag.x = e.clientX;
        _drag.y = e.clientY;
      }
    }
    function _onUp(e) {
      _drag = null;
      try { _canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    function _onWheel(e) {
      e.preventDefault();
      _radius = Math.max(0.05, _radius * (1 + e.deltaY * 0.001));
    }
    function _onMenu(e) { e.preventDefault(); }

    function _addListeners() {
      _canvas.addEventListener('pointerdown',  _onDown);
      _canvas.addEventListener('pointermove',  _onMove);
      _canvas.addEventListener('pointerup',    _onUp);
      _canvas.addEventListener('wheel',        _onWheel, { passive: false });
      _canvas.addEventListener('contextmenu',  _onMenu);
    }
    function _removeListeners() {
      if (!_canvas) return;
      _canvas.removeEventListener('pointerdown',  _onDown);
      _canvas.removeEventListener('pointermove',  _onMove);
      _canvas.removeEventListener('pointerup',    _onUp);
      _canvas.removeEventListener('wheel',        _onWheel);
      _canvas.removeEventListener('contextmenu',  _onMenu);
    }

    /* ── Stop renderer without clearing scene ─────────── */
    function _stopRenderer() {
      if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
      _removeListeners();
      if (_renderer) { _renderer.dispose(); _renderer = null; }
      _camera = null;
      _canvas = null;
    }

    /* ── Open preview ─────────────────────────────────── */
    async function open(idx) {
      var cfg = (window.CONFIGURATIONS_CATALOG || [])[idx];
      if (!cfg) return;
      _configFile = cfg.file;

      // Fill info panel
      document.getElementById('configPreviewTitle').textContent = cfg.name;
      document.getElementById('configPreviewDesc').innerHTML = _buildSpecsTable(cfg);

      // Show loading overlay, hide gallery, show modal
      var loadingEl = document.getElementById('configPreviewLoadingOverlay');
      if (loadingEl) loadingEl.style.display = 'flex';
      var gallery = document.getElementById('configGalleryOverlay');
      if (gallery) gallery.style.display = 'none';
      document.getElementById('configPreviewModal').classList.add('active');

      // Create isolated scene with lights
      _scene = new THREE.Scene();
      _scene.background = new THREE.Color(0xf0f0f0);
      _scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      var key = new THREE.DirectionalLight(0xfff4e8, 1.2);
      key.position.set(3, 8, 5);
      _scene.add(key);
      var fill = new THREE.DirectionalLight(0xd0e8ff, 0.4);
      fill.position.set(-3, 2, -2);
      _scene.add(fill);
      _cableGroup = new THREE.Group();
      _cableGroup.name = 'CableGroup';
      _scene.add(_cableGroup);

      // Swap: redirect ALL build calls to preview scene
      // (Cabinet.scene, CabinetChassis._scene, CabinetDrag._scene)
      _mainScene = Cabinet.scene;
      Cabinet.scene = _scene;
      if (window.CabinetChassis) CabinetChassis.setScene(_scene);
      if (window.CabinetDrag)    CabinetDrag.setScene(_scene);

      // Save Cabinet data state so close() can restore it cleanly
      _saveCabinetState();

      // Save CabinetBuilder's mesh/label tracking arrays and replace them with
      // empty ones so that clearAll() inside _applyConfig does NOT remove the
      // original label DOM elements or highlight meshes from the main scene.
      if (window.CabinetBuilder && CabinetBuilder.saveBuilderState) {
        _savedBuilderState = CabinetBuilder.saveBuilderState();
        CabinetBuilder.restoreBuilderState({ lockedAssemblies: [], lockedHighlights: [], labelAnchors: [] });
      }

      // Load config — cabinets + chassis + accessories all go into _scene
      var origToast = window.showToast;
      window.showToast = function () {};
      try {
        if (typeof loadExample === 'function') await loadExample(cfg.file);
      } finally {
        window.showToast = origToast;
      }

      // Hide arrows/labels/highlights — not needed in preview
      if (window.CabinetArrow)   CabinetArrow.setVisible(false);
      if (window.CabinetBuilder) {
        CabinetBuilder.setLabelsVisible(false);
        CabinetBuilder.setHighlightsVisible(false);
      }

      // Set up camera and renderer
      _canvas = document.getElementById('configPreviewCanvas');
      _target = new THREE.Vector3();
      _scene.updateMatrixWorld(true);  // ensure world matrices before autoFit
      _autoFit();

      _renderer = new THREE.WebGLRenderer({ canvas: _canvas, antialias: true });
      _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      _renderer.setSize(_canvas.clientWidth || 400, _canvas.clientHeight || 400, false);
      if (THREE.SRGBColorSpace !== undefined) _renderer.outputColorSpace = THREE.SRGBColorSpace;
      _camera = new THREE.PerspectiveCamera(
        45,
        (_canvas.clientWidth || 400) / (_canvas.clientHeight || 400),
        0.001, 500
      );

      _addListeners();

      // Apply cable config and connect editor
      if (window._CablesEditor) {
        _CablesEditor.setProvider({
          buildCables: buildCables,
          replayAnimation: replayAnimation,
          getCamera: getCamera,
          applyCamera: applyCamera
        }, 'configCablesEditor');
        var cfgKey = cfg.id;
        var cableCfg = window.PreviewCablesConfig && window.PreviewCablesConfig[cfgKey];
        if (cableCfg && cableCfg.camera) applyCamera(cableCfg.camera);
        _CablesEditor.open(cfgKey);
      }

      // Update open-button label based on whether the main scene already has cabinets
      var openBtn = document.querySelector('.config-preview-open-btn');
      if (openBtn) {
        var hasCabs = _savedCabinetState
          ? (_savedCabinetState.cabinets && _savedCabinetState.cabinets.length > 0)
          : (Cabinet.cabinets && Cabinet.cabinets.length > 0);
        openBtn.textContent = hasCabs ? 'Add to active row \u2192' : 'Open for editing \u2192';
      }

      // Hide loading overlay and start render loop
      if (loadingEl) loadingEl.style.display = 'none';
      _loop();
    }

    /* ── Close without editing ────────────────────────── */
    function close() {
      if (window._CablesEditor) {
        _CablesEditor.close();
        _CablesEditor.setProvider(window._PreviewScene, 'cablesEditor');
      }
      _cableGroup = null;
      _cableAnimState = [];
      _stopRenderer();

      // Clear preview scene objects (Cabinet.scene / _scene / _scene still swapped here)
      if (window.CabinetBuilder) CabinetBuilder.clearAll({ noFade: true });
      if (window.CabinetDrag    && CabinetDrag.clearAll)    CabinetDrag.clearAll();
      if (window.CabinetChassis && CabinetChassis.clearAll) CabinetChassis.clearAll();

      // Restore arrow/label visibility for main scene
      if (window.CabinetArrow)   CabinetArrow.setVisible(true);
      if (window.CabinetBuilder) {
        CabinetBuilder.setLabelsVisible(true);
        CabinetBuilder.setHighlightsVisible(true);
      }

      // Restore all scene pointers to main scene
      if (window.CabinetChassis) CabinetChassis.setScene(_mainScene);
      if (window.CabinetDrag)    CabinetDrag.setScene(_mainScene);
      if (_mainScene) Cabinet.scene = _mainScene;

      // Restore Cabinet data state (loadExample overwrote it during preview)
      _restoreCabinetState();

      // Restore CabinetBuilder's mesh/label tracking — original DOM label
      // elements and 3D highlight meshes are back in play
      if (_savedBuilderState && window.CabinetBuilder && CabinetBuilder.restoreBuilderState) {
        CabinetBuilder.restoreBuilderState(_savedBuilderState);
        _savedBuilderState = null;
      }

      // Dispose isolated scene
      if (_scene) {
        _scene.traverse(function (obj) {
          if (obj.geometry) obj.geometry.dispose();
          var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(function (m) { if (m) { if (m.map) m.map.dispose(); m.dispose(); } });
        });
        _scene = null;
      }
      _mainScene  = null;
      _configFile = null;

      // Close modal and restore gallery
      document.getElementById('configPreviewModal').classList.remove('active');
      var gallery = document.getElementById('configGalleryOverlay');
      if (gallery) gallery.style.display = '';
    }

    /* ── Open for editing ─────────────────────────────── */
    async function openForEditing() {
      var file = _configFile;

      // Decide before tearing down: does the main scene already have cabinets?
      var hasExisting = _savedCabinetState
        ? (_savedCabinetState.cabinets && _savedCabinetState.cabinets.length > 0)
        : (Cabinet.cabinets && Cabinet.cabinets.length > 0);

      if (window._CablesEditor) {
        _CablesEditor.close();
        _CablesEditor.setProvider(window._PreviewScene, 'cablesEditor');
      }
      _cableGroup = null;
      _cableAnimState = [];
      _stopRenderer();

      // Clear objects in preview scene first (pointers still swapped)
      if (_scene) {
        if (window.CabinetBuilder) CabinetBuilder.clearAll({ noFade: true });
        if (window.CabinetDrag    && CabinetDrag.clearAll)    CabinetDrag.clearAll();
        if (window.CabinetChassis && CabinetChassis.clearAll) CabinetChassis.clearAll();
        _scene.traverse(function (obj) {
          if (obj.geometry) obj.geometry.dispose();
          var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(function (m) { if (m) { if (m.map) m.map.dispose(); m.dispose(); } });
        });
        _scene = null;
      }

      // Restore all scene pointers to main scene
      if (window.CabinetChassis) CabinetChassis.setScene(_mainScene);
      if (window.CabinetDrag)    CabinetDrag.setScene(_mainScene);
      if (_mainScene) Cabinet.scene = _mainScene;
      _mainScene  = null;
      _configFile = null;

      // Close modal and gallery
      document.getElementById('configPreviewModal').classList.remove('active');
      var gallery = document.getElementById('configGalleryOverlay');
      if (gallery) { gallery.classList.remove('visible'); gallery.style.display = ''; }

      // Restore arrow/label/highlight visibility before loading into main scene
      if (window.CabinetArrow)   CabinetArrow.setVisible(true);
      if (window.CabinetBuilder) {
        CabinetBuilder.setLabelsVisible(true);
        CabinetBuilder.setHighlightsVisible(true);
      }

      if (file) {
        // Capture user's door settings before any load overwrites them
        var anEl = document.getElementById('doorAngle');
        var opEl = document.getElementById('doorOpacity');
        var userAngle   = anEl ? anEl.value : null;
        var userOpacity = opEl ? opEl.value : null;

        if (hasExisting) {
          // Restore builder state so _lockedAssemblies knows about the original main
          // scene meshes — clearAll inside rebuildAllCabinetsFromState will remove them.
          if (_savedBuilderState && window.CabinetBuilder && CabinetBuilder.restoreBuilderState) {
            CabinetBuilder.restoreBuilderState(_savedBuilderState);
          }
          _savedBuilderState = null;
          // Append to existing row — restore saved state first so the
          // main scene reflects the original cabinets, then append.
          // appendConfigToScene already re-applies current UI door values internally.
          _restoreCabinetState();
          if (typeof appendConfigToScene === 'function') await appendConfigToScene(file);
        } else {
          // Scene is empty — discard saved state and do a full replace.
          // loadExample applies config's door values; we override them below.
          _savedBuilderState = null;
          _savedCabinetState = null;
          if (typeof loadExample === 'function') await loadExample(file);
        }

        // Restore user's door settings on the main scene
        if (userAngle   !== null && typeof applyDoorAngle   === 'function') { anEl.value = userAngle;   applyDoorAngle(userAngle); }
        if (userOpacity !== null && typeof applyDoorOpacity === 'function') { opEl.value = userOpacity; applyDoorOpacity(userOpacity); }
      } else {
        _savedCabinetState = null;
      }
    }

    return { open: open, close: close, openForEditing: openForEditing };
  })();

  function openConfigGallery() {
    // Open the gallery directly from the main app (no welcome screen needed)
    var overlay = document.getElementById('configGalleryOverlay');
    if (!overlay) return;
    _galleryOpenedFromApp = true;
    _renderGallery();
    overlay.classList.add('visible');
    overlay.style.display = '';
  }
  window.openConfigGallery = openConfigGallery;

  function openConfigPreview(idx) {
    _ConfigPreview.open(idx);
  }
  window.openConfigPreview = openConfigPreview;

  function closeConfigPreview() {
    _ConfigPreview.close();
  }
  window.closeConfigPreview = closeConfigPreview;

  function openConfigForEditing() {
    _ConfigPreview.openForEditing();
  }
  window.openConfigForEditing = openConfigForEditing;

  /* ──────────────────────────────────────────────────────
     Boot
  ────────────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', function () {
    _startProgressSim();

    // Listen for main scene ready signal
    window.addEventListener('cabinetSceneReady', function () {
      if (!_sceneReady) _onSceneReadyInternal();
    }, { once: true });

    // Fallback: show cards after 5 s regardless
    setTimeout(function () {
      if (!_sceneReady) _onSceneReadyInternal();
    }, 5000);
  });

})();
