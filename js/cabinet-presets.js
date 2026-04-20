/**
 * cabinet-presets.js
 * Preview modal (mini Three.js scene), preset gallery, thumbnail capture.
 * Exposes: openPreview, closePreview, togglePresetGallery, selectPreset, _PreviewScene.
 */


/* ══════════════════════════════════════════════════════
   PREVIEW MODAL — independent mini Three.js scene
   Supports accessories (single GLB) and presets (frames + profiles).
   Pointer drag = orbit; wheel = zoom.
════════════════════════════════════════════════════════ */
const _PreviewScene = (() => {
  let _raf, _renderer, _scene, _camera, _canvas;
  let _theta = 0.291, _phi = 1.2, _radius = 2;
  let _target = new THREE.Vector3();
  let _drag = null;
  let _cableGroup    = null;
  let _cableAnimState = [];   // [{ mesh, total, current, speed, active, done }]
  let _cableAnimMode  = 'sequential';
  let _lineMaterials  = [];   // LineMaterial instances — need resolution updated on resize
  const _cache = {};

  function _loadGLB(path) {
    if (_cache[path]) return Promise.resolve(_cache[path].clone(true));
    const LC = THREE.GLTFLoader || window.GLTFLoader;
    return new Promise((resolve, reject) =>
      new LC().load(path, gltf => {
        const g = gltf.scene;
        g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.set(1, 1, 1);
        _cache[path] = g;
        resolve(g.clone(true));
      }, null, reject)
    );
  }

  function _updateCam() {
    if (!_camera) return;
    _camera.position.set(
      _target.x + _radius * Math.sin(_phi) * Math.sin(_theta),
      _target.y + _radius * Math.cos(_phi),
      _target.z + _radius * Math.sin(_phi) * Math.cos(_theta)
    );
    _camera.lookAt(_target);
  }

  function _tickCableAnim() {
    for (let i = 0; i < _cableAnimState.length; i++) {
      const s = _cableAnimState[i];
      if (s.done || !s.active) continue;
      s.current = Math.min(s.current + s.speed, s.total);
      s.mesh.geometry.instanceCount = Math.floor(s.current);
      if (s.current >= s.total) {
        s.done = true;
        if (_cableAnimMode === 'sequential' && i + 1 < _cableAnimState.length) {
          _cableAnimState[i + 1].active = true;
        }
      }
    }
  }

  const _statusbar = document.getElementById('previewStatusbar');
  function _updateStatusbar() {
    if (!_statusbar) return;
    if (window.PreviewPointsEditVisible === false) {
      _statusbar.style.display = 'none';
      return;
    }
    _statusbar.style.display = '';
    const deg = r => (r * 180 / Math.PI).toFixed(1) + '°';
    const f3  = v => v.toFixed(3);
    _statusbar.innerHTML =
      `<span><span class="csb-key">θ</span><span class="csb-val">${deg(_theta)}</span></span>` +
      `<span><span class="csb-key">φ</span><span class="csb-val">${deg(_phi)}</span></span>` +
      `<span><span class="csb-key">r</span><span class="csb-val">${f3(_radius)}</span></span>` +
      `<span><span class="csb-key">target</span><span class="csb-val">(${f3(_target.x)}, ${f3(_target.y)}, ${f3(_target.z)})</span></span>`;
  }

  function _loop() {
    _raf = requestAnimationFrame(_loop);
    // Keep renderer/camera in sync with actual CSS canvas size every frame
    const W = _canvas.clientWidth;
    const H = _canvas.clientHeight;
    if (W > 0 && H > 0) {
      const bufW = Math.floor(W * _renderer.getPixelRatio());
      const bufH = Math.floor(H * _renderer.getPixelRatio());
      if (_renderer.domElement.width !== bufW || _renderer.domElement.height !== bufH) {
        _renderer.setSize(W, H, false);
        _camera.aspect = W / H;
        _camera.updateProjectionMatrix();
        _lineMaterials.forEach(m => m.resolution.set(W, H));
      }
    }
    _updateCam();
    _tickCableAnim();
    _updateStatusbar();
    _renderer.render(_scene, _camera);
  }

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
    const dx = e.clientX - _drag.x;
    const dy = e.clientY - _drag.y;
    if (_drag.type === 'orbit') {
      _theta = _drag.theta - dx * 0.01;
      _phi   = Math.max(0.05, Math.min(Math.PI - 0.05, _drag.phi + dy * 0.01));
    } else {
      // Pan: move target in camera right/up plane
      const dir   = new THREE.Vector3().subVectors(_target, _camera.position).normalize();
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      const up    = new THREE.Vector3().crossVectors(right, dir).normalize();
      const speed = _radius * 0.001;
      _target.addScaledVector(right, -dx * speed);
      _target.addScaledVector(up,     dy * speed);
      _drag.x = e.clientX;
      _drag.y = e.clientY;
    }
  }
  function _onUp(e)       { _drag = null; try { _canvas.releasePointerCapture(e.pointerId); } catch (_) {} }
  function _onMenu(e)     { e.preventDefault(); }
  function _onWheel(e)    { e.preventDefault(); _radius = Math.max(0.01, _radius * (1 + e.deltaY * 0.001)); }

  function start(canvas) {
    _canvas = canvas;

    _renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    _renderer.setSize(canvas.clientWidth || 1, canvas.clientHeight || 1, false);
    if (THREE.SRGBColorSpace !== undefined) _renderer.outputColorSpace = THREE.SRGBColorSpace;

    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(0xf6f6f6);

    _camera = new THREE.PerspectiveCamera(45, 1, 0.001, 200);

    _scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xfff4e8, 1.2);
    key.position.set(2, 4, 3);
    _scene.add(key);
    const fill = new THREE.DirectionalLight(0xd0e8ff, 0.5);
    fill.position.set(-3, 2, -2);
    _scene.add(fill);

    _cableGroup = new THREE.Group();
    _cableGroup.name = 'CableGroup';
    _scene.add(_cableGroup);

    canvas.addEventListener('pointerdown',  _onDown);
    canvas.addEventListener('pointermove',  _onMove);
    canvas.addEventListener('pointerup',    _onUp);
    canvas.addEventListener('wheel',        _onWheel, { passive: false });
    canvas.addEventListener('contextmenu',  _onMenu);

    _loop();
  }

  function stop() {
    cancelAnimationFrame(_raf); _raf = null;
    if (_canvas) {
      _canvas.removeEventListener('pointerdown',  _onDown);
      _canvas.removeEventListener('pointermove',  _onMove);
      _canvas.removeEventListener('pointerup',    _onUp);
      _canvas.removeEventListener('wheel',        _onWheel);
      _canvas.removeEventListener('contextmenu',  _onMenu);
    }
    if (_scene) _scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => { if (m) m.dispose(); });
    });
    if (_renderer) _renderer.dispose();
    _renderer = _scene = _camera = _canvas = _cableGroup = null;
  }

  function _autoFit(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    box.getCenter(_target);
    const size = box.getSize(new THREE.Vector3());
    _radius = Math.max(size.x, size.y, size.z) * 2.0;
    _theta  = 0.291;
    _phi    = 1.2;
  }

  async function loadAccessory(code) {
    const group = await _loadGLB(`components/${code}.glb`);
    _scene.add(group);
    _autoFit(group);
  }

  async function loadPreset(code) {
    const group = await CabinetBuilder.buildInto(code, _scene);
    if (group) _autoFit(group);
  }

  const _sphereMat = new THREE.MeshStandardMaterial({ color: 0xff2222, depthTest: false });

  function _makeLabelSprite(text, size) {
    const cw = 160, ch = 64;
    const canvas = document.createElement('canvas');
    canvas.width  = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff4444';
    ctx.font = `bold ${ch * 0.26}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cw / 2, ch / 2);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    const aspect = cw / ch;
    sprite.scale.set(size * aspect, size, 1);
    sprite.renderOrder = 2;
    return sprite;
  }

  function buildCables(cables, anim = {}, waypoints = []) {
    if (!_cableGroup) return;
    // Dispose existing cable objects and clear material list
    while (_cableGroup.children.length) {
      const m = _cableGroup.children[0];
      _cableGroup.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material && m.material !== _sphereMat) {
        if (m.material.map) m.material.map.dispose();
        m.material.dispose();
      }
    }
    _cableAnimState = [];
    _lineMaterials  = [];
    _cableAnimMode  = anim.mode || 'sequential';

    const animated = anim.enabled !== false;
    const duration = anim.duration || 0.6;
    const MM = 0.001;
    const W  = _canvas ? _canvas.clientWidth  : 800;
    const H  = _canvas ? _canvas.clientHeight : 600;

    // Build per-group wpMap — supports both new waypointGroups[] and legacy flat waypoints[]
    const wpGroupMap  = {};   // groupId → { wpId: wp }
    const allWaypoints = [];  // flattened, for edit-mode markers
    const waypointGroups = waypoints; // parameter renamed for clarity
    if (waypointGroups.length > 0) {
      if (waypointGroups[0].waypoints !== undefined) {
        // New format: [{id, waypoints:[...]}, ...]
        waypointGroups.forEach(g => {
          const m = {};
          (g.waypoints || []).forEach(wp => { m[wp.id] = wp; });
          wpGroupMap[g.id] = m;
          allWaypoints.push(...(g.waypoints || []));
        });
      } else {
        // Legacy flat format: [{id, x, y, z}, ...]
        const m = {};
        waypointGroups.forEach(wp => { m[wp.id] = wp; });
        wpGroupMap['default'] = m;
        allWaypoints.push(...waypointGroups);
      }
    }

    cables.forEach((cable, ci) => {
      const groupId = cable.group || 'default';
      const wpMap   = wpGroupMap[groupId] || wpGroupMap[Object.keys(wpGroupMap)[0]] || {};
      // Resolve points: new path-based or legacy points array
      let rawPts;
      if (cable.path && cable.path.length >= 2) {
        rawPts = cable.path.map(id => wpMap[id]).filter(Boolean);
      } else if (cable.points && cable.points.length >= 2) {
        rawPts = cable.points;
      } else {
        return;
      }
      if (rawPts.length < 2) return;

      const pts      = rawPts.map(p => new THREE.Vector3(p.x * MM, p.y * MM, p.z * MM));
      const curve    = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', cable.tension ?? 0.5);
      const segments = cable.tubularSegments || 48;
      const sampled  = curve.getPoints(segments);   // segments+1 points
      const flat     = [];
      sampled.forEach(p => flat.push(p.x, p.y, p.z));

      const resolvedColor = (cable.type && window.CableTypes && window.CableTypes[cable.type])
        ? window.CableTypes[cable.type].color
        : (cable.color || '#222222');
      const lineWidth = Math.max(1.5, (cable.radius || 4) * 0.4);

      const geom = new THREE.LineGeometry();
      geom.setPositions(flat);
      const mat = new THREE.LineMaterial({
        color:      resolvedColor,
        linewidth:  lineWidth,
        resolution: new THREE.Vector2(W, H),
      });
      _lineMaterials.push(mat);
      const line = new THREE.Line2(geom, mat);
      line.computeLineDistances();
      _cableGroup.add(line);

      const total = segments;   // number of segments = instanceCount to reveal
      const speed = total / (duration * 60);
      if (animated) geom.instanceCount = 0;
      _cableAnimState.push({ mesh: line, total, current: animated ? 0 : total, speed,
                             active: false, done: !animated });
    });

    // Edit mode: waypoint spheres + labels
    if (window.PreviewPointsEditVisible !== false) {
      const SR = 6 * MM;
      if (allWaypoints.length > 0) {
        allWaypoints.forEach(wp => {
          const pt = new THREE.Vector3(wp.x * MM, wp.y * MM, wp.z * MM);
          const sg = new THREE.SphereGeometry(SR, 8, 6);
          const sm = new THREE.Mesh(sg, _sphereMat);
          sm.position.copy(pt); sm.renderOrder = 1;
          _cableGroup.add(sm);
          const sprite = _makeLabelSprite(String(wp.id), SR * 5);
          sprite.position.set(pt.x + SR * 2.5, pt.y + SR * 2.5, pt.z);
          _cableGroup.add(sprite);
        });
      } else {
        // Legacy: per-cable-point markers
        cables.forEach((cable, ci) => {
          if (!cable.points) return;
          const sr = (cable.radius || 4) * 1.6 * MM;
          cable.points.forEach((p, pi) => {
            const pt = new THREE.Vector3(p.x * MM, p.y * MM, p.z * MM);
            const sg = new THREE.SphereGeometry(sr, 8, 6);
            const sm = new THREE.Mesh(sg, _sphereMat);
            sm.position.copy(pt); sm.renderOrder = 1;
            _cableGroup.add(sm);
            const sprite = _makeLabelSprite(`${ci+1}-${pi+1}`, sr * 5);
            sprite.position.set(pt.x + sr*2.5, pt.y + sr*2.5, pt.z);
            _cableGroup.add(sprite);
          });
        });
      }
    }

    // Activate first cable(s)
    if (animated && _cableAnimState.length > 0) {
      if (_cableAnimMode === 'sequential') {
        _cableAnimState[0].active = true;
      } else {
        _cableAnimState.forEach(s => { s.active = true; });
      }
    }
  }

  function replayAnimation() {
    _cableAnimState.forEach((s, i) => {
      s.current = 0;
      s.done    = false;
      s.active  = _cableAnimMode !== 'sequential' || i === 0;
      s.mesh.geometry.instanceCount = 0;
    });
  }

  function applyCamera(cam) {
    const DEG = Math.PI / 180;
    if (cam.theta  !== undefined) _theta  = cam.theta  * DEG;
    if (cam.phi    !== undefined) _phi    = cam.phi    * DEG;
    if (cam.radius !== undefined) _radius = cam.radius;
    if (cam.target) _target.set(cam.target.x, cam.target.y, cam.target.z);
  }

  function getCamera() {
    const RAD = 180 / Math.PI;
    return {
      theta:  +(_theta  * RAD).toFixed(2),
      phi:    +(_phi    * RAD).toFixed(2),
      radius: +_radius.toFixed(4),
      target: {
        x: +_target.x.toFixed(4),
        y: +_target.y.toFixed(4),
        z: +_target.z.toFixed(4),
      },
    };
  }

  return { start, stop, loadAccessory, loadPreset, buildCables, replayAnimation, applyCamera, getCamera, _makeLabelSprite };
})();

/* ══════════════════════════════════════════════════════ */
function openPreview(type, code) {
  const modal  = document.getElementById('previewModal');
  const title  = document.getElementById('previewModalTitle');
  const canvas = document.getElementById('previewCanvas');
  if (!modal || !canvas) return;
  title.textContent = code;
  modal.classList.toggle('preview-no-editor', window.PreviewPointsEditVisible === false);
  modal.classList.add('active');
  requestAnimationFrame(() => {
    _PreviewScene.start(canvas);
    const cfgKey = type === 'preset'
      ? ('preset_' + (parseCode(code)?.de || ''))
      : code;
    const _applyCfgCamera = () => {
      const cfg = window.PreviewCablesConfig?.[cfgKey];
      if (cfg?.camera) _PreviewScene.applyCamera(cfg.camera);
      _CablesEditor.open(cfgKey);
    };
    if (type === 'accessory') {
      _PreviewScene.loadAccessory(code).then(_applyCfgCamera).catch(e => console.error('[Preview]', e));
    } else {
      _PreviewScene.loadPreset(code).then(_applyCfgCamera).catch(e => console.error('[Preview]', e));
    }
  });
}

function closePreview() {
  _CablesEditor.close();
  _PreviewScene.stop();
  document.getElementById('previewModal')?.classList.remove('active');
}

/* ── Floor grid is now managed by cabinet-floor.js ─────────────────────── */
// Use CabinetFloor.update() to update the grid after changes
// Use CabinetFloor.setVisible() to show/hide the grid

/** Returns true if a static file exists (HEAD request, no-throw). */
async function _staticExists(src) {
  return fetch(src, { method: 'HEAD' })
    .then(r => r.ok)
    .catch(() => false);
}

function _renderAccessoryCards() {
  const grid = document.getElementById('accGrid');
  if (!grid) return;
  grid.innerHTML = ACCESSORY_CATALOG.map(a => `
    <div class="preset-card acc-card" data-acc-code="${a.code}">
      <div class="preset-card-thumb" id="${_safeThumbId(a.code)}">
        <div class="preset-thumb-spinner"></div>
        <button class="card-preview-btn" onclick="openPreview('accessory','${a.code}')" title="Preview 3D model">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
      <div class="preset-card-info">
        <div class="preset-card-code">${a.code}</div>
        <div class="preset-card-order">${a.desc}</div>
      </div>
    </div>`).join('');
}

async function _renderAccThumbs() {
  // If all thumbs are already cached, just apply them — no scene disruption
  const allCached = ACCESSORY_CATALOG.every(a => !!_accThumbs[a.code]);
  if (allCached) {
    for (const a of ACCESSORY_CATALOG) _applyAccThumb(a.code, _accThumbs[a.code]);
    return;
  }

  if (_accThumbsActive) return;
  if (!Cabinet.renderer || !Cabinet.scene || !Cabinet.camera) return;
  _accThumbsActive = true;

  // Save state
  const origCode   = Cabinet.descriptionCode;
  const origTheta  = CabinetControls.getTheta();
  const origPhi    = CabinetControls.getPhi();
  const origRadius = CabinetControls.getRadius();
  const origTarget = CabinetControls.getTarget();
  const origToast  = window.showToast;
  window.showToast = () => {};

  CabinetBuilder.clearAssembly({ noFade: true });

  for (const a of ACCESSORY_CATALOG) {
    if (_accThumbs[a.code]) {
      _applyAccThumb(a.code, _accThumbs[a.code]);
      continue;
    }
    const staticSrc = `thumbnails/accessories/${a.code.replace(/[^\w\-]/g, '_')}.jpg`;
    if (await _staticExists(staticSrc)) {
      _applyAccThumb(a.code, staticSrc);
      _accThumbs[a.code] = staticSrc;
      continue;
    }
    try {
      const dataURL = await _captureAccThumb(a.code);
      _accThumbs[a.code] = dataURL;
      _applyAccThumb(a.code, dataURL);
    } catch (e) {
      const el = document.getElementById(_safeThumbId(a.code));
      if (el) el.innerHTML = '';
    }
  }

  // Restore camera
  CabinetControls.setTarget(origTarget);
  CabinetControls.setView(origTheta, origPhi, origRadius);

  // Restore original assembly
  if (origCode && Cabinet.isCodeValid) {
    await CabinetBuilder.build(origCode, { noFade: true, xOffset: Cabinet.currentCabinetXOffset, noFitCamera: true }).catch(() => {});
  } else {
    CabinetBuilder.clearAssembly({ noFade: true });
  }

  window.showToast  = origToast;
  _accThumbsActive  = false;
}

async function _captureAccThumb(code, cam = {}) {
  const rdr   = Cabinet.renderer;
  const scene = Cabinet.scene;
  const camera = Cabinet.camera;
  const LoaderClass = THREE.GLTFLoader || window.GLTFLoader;
  if (!LoaderClass) throw new Error('GLTFLoader not available');

  const theta      = cam.theta         ?? 0.291;
  const phi        = cam.phi           ?? 1.409;
  const radiusMult = cam.accRadiusMult ?? 2.2;

  // Load the accessory GLB
  const obj = await new Promise((resolve, reject) => {
    new LoaderClass().load(`components/${code}.glb`, gltf => resolve(gltf.scene), null, reject);
  });

  // Centre at origin
  const bbox = new THREE.Box3().setFromObject(obj);
  const centre = bbox.getCenter(new THREE.Vector3());
  obj.position.sub(centre);
  obj.name = '__accThumb';
  scene.add(obj);

  // Fit camera
  const size   = bbox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  CabinetControls.setTarget(new THREE.Vector3(0, 0, 0));
  CabinetControls.setView(theta, phi, maxDim * radiusMult);
  CabinetControls.update();

  // Render at thumbnail resolution
  const W = 512, H = 352;
  const prevAspect = camera.aspect;
  const cssW = rdr.domElement.clientWidth  || 800;
  const cssH = rdr.domElement.clientHeight || 600;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  rdr.setSize(W, H, false);
  CabinetFloor.setVisible(false);
  if (window.CabinetArrow) CabinetArrow.setVisible(false);
  CabinetBuilder.setHighlightsVisible(false);
  rdr.render(scene, camera);
  CabinetFloor.setVisible(true);
  if (window.CabinetArrow) CabinetArrow.setVisible(true);
  CabinetBuilder.setHighlightsVisible(true);
  const dataURL = rdr.domElement.toDataURL('image/jpeg', 0.88);

  // Restore renderer size
  rdr.setSize(cssW, cssH, false);
  camera.aspect = prevAspect;
  camera.updateProjectionMatrix();

  scene.remove(obj);
  return dataURL;
}

function _applyAccThumb(code, dataURL) {
  const el = document.getElementById(_safeThumbId(code));
  if (!el) return;
  // If img already exists just update src — don't add another one
  const existing = el.querySelector('img');
  if (existing) { existing.src = dataURL; return; }
  const img = document.createElement('img');
  img.src = dataURL;
  const spinner = el.querySelector('.preset-thumb-spinner');
  if (spinner) spinner.replaceWith(img);
  else el.insertBefore(img, el.firstChild);
}

function _collapseStep1ToCode() {
  ['#browseBlock', '#wizardBlock', '#useConfigBtn'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.style.display = 'none';
  });
  document.getElementById('step1')?.classList.add('collapsed');
}

function _expandStep1() {
  ['#browseBlock', '#wizardBlock', '#useConfigBtn'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.style.display = '';
  });
}

async function useEZRConfig() {
  if (!Cabinet.isCodeValid) {
    showToast('Configure a valid cabinet code first', 'warn');
    return;
  }
  _collapseStep1ToCode();
  activateStep('step2');
  unlockStep('step4');
  document.getElementById('step2').scrollIntoView({ behavior: 'smooth' });
  // Reset accessory grid scroll so cards always start from the left
  const accGrid = document.getElementById('accGrid');
  if (accGrid) accGrid.scrollLeft = 0;
  _renderAccThumbs();
  // Inject and render preset accessories for EZR_OP designs
  if (window.CabinetDrag) await CabinetDrag.applyPresetsIfEmpty();
}

const _presetThumbs  = {};  // code → dataURL cache
let   _presetsActive = false;
let   _galleryAborted = false;  // set by selectPreset to stop gallery mid-render

function togglePresetGallery() {
  openModal('presetModal');
  _renderPresetGallery();
}


function selectPreset(code) {
  closeModal('presetModal');
  const parsed = parseCode(code);
  if (!parsed) { showToast('Invalid preset code', 'error'); return; }
  // Abort any in-progress gallery rendering so it doesn't overwrite the scene
  _galleryAborted = true;
  Cabinet.wizardSelections = parsed;
  Cabinet.noFadeNext = true;
  _applySelectionsToCode();
  setMode('code');
  useEZRConfig();
}

async function _renderPresetGallery() {
  if (_presetsActive) return;
  _presetsActive = true;
  _galleryAborted = false;

  const grid = document.getElementById('presetGrid');
  if (!grid) { _presetsActive = false; return; }

  // Capture origCode BEFORE the render loop (loop overwrites Cabinet.descriptionCode)
  const origCode = Cabinet.descriptionCode;

  // Hide viewport and door controls during rendering
  const overlay = document.getElementById('viewportLoading');
  const overlaySpan = overlay && overlay.querySelector('span');
  const doorPanel = document.getElementById('doorControls');
  if (overlay) {
    if (overlaySpan) overlaySpan.textContent = 'Generating previews…';
    overlay.style.display = 'flex';
  }
  if (doorPanel) doorPanel.style.display = 'none';

  // Render card skeletons immediately
  grid.innerHTML = PRESET_CONFIGS.map(p => `
    <div class="preset-card" onclick="selectPreset('${p.code}')">
      <div class="preset-card-thumb" id="pthumb-${p.code.replace(/[^\w]/g, '_')}">
        <div class="preset-thumb-spinner"></div>
        <button class="card-preview-btn" onclick="event.stopPropagation();openPreview('preset','${p.code}')" title="Preview 3D model">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
      <div class="preset-card-info">
        <div class="preset-card-code">${p.code}</div>
        <div class="preset-card-order">${p.order}</div>
      </div>
    </div>`).join('');

  // Render thumbnails one by one — try static file first, fall back to Three.js
  for (const p of PRESET_CONFIGS) {
    // User selected a preset — stop rendering and leave scene as-is
    if (_galleryAborted) break;

    if (_presetThumbs[p.code]) {
      _applyThumb(p.code, _presetThumbs[p.code]);
      continue;
    }
    const staticSrc = `thumbnails/presets/${p.code.replace(/[^\w\-]/g, '_')}.jpg`;
    if (await _staticExists(staticSrc)) {
      _applyThumb(p.code, staticSrc);
      _presetThumbs[p.code] = staticSrc;
      continue;
    }
    try {
      const dataURL = await _capturePresetThumb(p.code);
      _presetThumbs[p.code] = dataURL;
      _applyThumb(p.code, dataURL);
    } catch (e) {
      const el = document.getElementById('pthumb-' + p.code.replace(/[^\w]/g, '_'));
      if (el) el.innerHTML = '<span style="font-size:10px;color:#aaa">—</span>';
    }
  }

  const origToast = window.showToast;
  window.showToast = () => {};
  if (_galleryAborted) {
    // User selected a preset while gallery was rendering.
    // _onValidCode skipped the build, so we do it here after the thumbnail render settled.
    const selectedCode = Cabinet.descriptionCode;
    const selectedXOff = Cabinet.currentCabinetXOffset;
    if (selectedCode && Cabinet.isCodeValid) {
      await CabinetBuilder.build(selectedCode, { noFade: true, xOffset: selectedXOff }).catch(() => {});
    } else {
      CabinetBuilder.clearAssembly({ noFade: true });
    }
  } else {
    // Restore the previously active cabinet (or clear)
    if (origCode && Cabinet.isCodeValid) {
      await CabinetBuilder.build(origCode, { noFade: true, xOffset: Cabinet.currentCabinetXOffset }).catch(() => {});
    } else {
      CabinetBuilder.clearAssembly({ noFade: true });
    }
  }
  window.showToast = origToast;

  // Hide overlay and restore door controls
  if (overlay) overlay.style.display = 'none';
  _updateDoorControls();

  _presetsActive = false;
  _galleryAborted = false;
}

function _applyThumb(code, dataURL) {
  const el = document.getElementById('pthumb-' + code.replace(/[^\w]/g, '_'));
  if (!el) return;
  const img = document.createElement('img');
  img.src = dataURL;
  const spinner = el.querySelector('.preset-thumb-spinner');
  if (spinner) spinner.replaceWith(img);
  else el.insertBefore(img, el.firstChild);
}

async function _capturePresetThumb(code, cam = {}) {
  const rdr    = Cabinet.renderer;
  const scene  = Cabinet.scene;
  const camera = Cabinet.camera;
  if (!rdr || !scene || !camera) throw new Error('Scene not ready');

  const theta      = cam.theta            ?? 0.291;
  const phi        = cam.phi              ?? 1.409;
  const radiusMult = cam.presetRadiusMult ?? 0.75;

  // Reset radius to 0 so _fitCamera uses auto-fit distance
  CabinetControls.setView(CabinetControls.getTheta(), CabinetControls.getPhi(), 0);

  // Suppress toasts and status while rendering thumbnail
  const origToast  = window.showToast;
  window.showToast = () => {};
  await CabinetBuilder.build(code, { noFade: true }).catch(e => { window.showToast = origToast; throw e; });
  window.showToast = origToast;

  // Temporarily inject preset accessories so they appear in the thumbnail
  const _prevCabinets   = Cabinet.cabinets;
  const _prevEditingIdx = Cabinet.editingIdx;
  const _prevPlaced     = Cabinet.placedAccessories;
  Cabinet.cabinets         = [{ code, xOffset: 0, rowIdx: 0, placedAccessories: [] }];
  Cabinet.editingIdx       = 0;
  Cabinet.placedAccessories = [];
  if (window.CabinetDrag?.applyPresetsIfEmpty) await CabinetDrag.applyPresetsIfEmpty();
  // Make preset accessories fully opaque for thumbnail
  if (window.CabinetDrag) {
    Cabinet.scene.traverse(obj => {
      if (obj.userData.isPlaced && obj.isMesh) {
        obj.material.opacity = 1; obj.material.transparent = false; obj.material.needsUpdate = true;
      }
    });
  }

  // Ensure full opacity (safety net in case materials were partially transparent)
  const assembly = scene.getObjectByName('CabinetAssembly');
  if (assembly) {
    assembly.traverse(obj => {
      if (obj.isMesh) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => { m.opacity = 1; m.transparent = false; m.needsUpdate = true; });
      }
    });
  }

  // Apply desired thumbnail angle AFTER build (_fitCamera overwrites theta/phi)
  CabinetControls.setView(theta, phi, CabinetControls.getRadius() * radiusMult);
  CabinetControls.update();

  // Render at thumbnail resolution
  const W = 1020, H = 720;
  const prevAspect = camera.aspect;
  const cssW = rdr.domElement.clientWidth  || 800;
  const cssH = rdr.domElement.clientHeight || 600;

  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  rdr.setSize(W, H, false);
  CabinetFloor.setVisible(false);
  if (window.CabinetArrow) CabinetArrow.setVisible(false);
  CabinetBuilder.setHighlightsVisible(false);
  rdr.render(scene, camera);
  CabinetFloor.setVisible(true);
  if (window.CabinetArrow) CabinetArrow.setVisible(true);
  CabinetBuilder.setHighlightsVisible(true);
  const dataURL = rdr.domElement.toDataURL('image/jpeg', 0.92);

  // Restore renderer
  rdr.setSize(cssW, cssH, false);
  camera.aspect = prevAspect;
  camera.updateProjectionMatrix();

  // Clean up temporary preset accessories and state
  if (window.CabinetDrag) CabinetDrag.clear();
  Cabinet.cabinets          = _prevCabinets;
  Cabinet.editingIdx        = _prevEditingIdx;
  Cabinet.placedAccessories = _prevPlaced;

  return dataURL;
}

/**
 * Loads a full saved configuration and captures a thumbnail of the entire scene.
 * Used by exportAllThumbs() for ready-configuration gallery images.
 */
async function _captureConfigThumb(configFile, cam = {}) {
  const rdr    = Cabinet.renderer;
  const scene  = Cabinet.scene;
  const camera = Cabinet.camera;
  if (!rdr || !scene || !camera) throw new Error('Scene not ready');

  const theta      = cam.theta            ?? 0.291;
  const phi        = cam.phi              ?? 1.409;
  const radiusMult = cam.presetRadiusMult ?? 0.75;

  // Load the configuration (suppress toasts)
  const origToast  = window.showToast;
  window.showToast = () => {};
  try {
    await loadExample(configFile);
  } finally {
    window.showToast = origToast;
  }

  // Apply thumbnail camera angle, keeping the radius that _applyConfig set
  const currentRadius = CabinetControls.getRadius();
  CabinetControls.setView(theta, phi, currentRadius * radiusMult);
  CabinetControls.update();

  // Render at thumbnail resolution
  const W = 1020, H = 720;
  const prevAspect = camera.aspect;
  const cssW = rdr.domElement.clientWidth  || 800;
  const cssH = rdr.domElement.clientHeight || 600;

  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  rdr.setSize(W, H, false);
  CabinetFloor.setVisible(false);
  if (window.CabinetArrow) CabinetArrow.setVisible(false);
  CabinetBuilder.setHighlightsVisible(false);
  rdr.render(scene, camera);
  CabinetFloor.setVisible(true);
  if (window.CabinetArrow) CabinetArrow.setVisible(true);
  CabinetBuilder.setHighlightsVisible(true);
  const dataURL = rdr.domElement.toDataURL('image/jpeg', 0.92);

  // Restore renderer size
  rdr.setSize(cssW, cssH, false);
  camera.aspect = prevAspect;
  camera.updateProjectionMatrix();

  return dataURL;
}