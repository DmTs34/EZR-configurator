/**
 * cabinet-main.js
 * Three.js scene for the EZR Cabinet Configurator.
 */
(function () {
  'use strict';

  /* ── Boot: wait until layout is painted ────────────
     DOMContentLoaded fires before CSS layout is applied,
     so canvas.clientWidth can be 0. Double-rAF guarantees
     the browser has done at least one layout pass.
  ─────────────────────────────────────────────────── */
  window.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(() => requestAnimationFrame(_tryInit));
  });

  function _tryInit() {
    const canvas = document.getElementById('cabinet-canvas');
    if (!canvas) return;

    // If canvas still has no size, retry next frame
    if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
      requestAnimationFrame(_tryInit);
      return;
    }

    try {
      _init(canvas);
    } catch (err) {
      console.error('[CabinetScene] Init error:', err);
      _setLoadingMsg('3D scene failed to initialise. See console.');
    }
  }

  /* ── Core initialisation ────────────────────────── */
  function _init(canvas) {
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;

    /* Renderer */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // SRGBColorSpace in r152+; fallback for older builds
    if (THREE.SRGBColorSpace !== undefined) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    Cabinet.renderer = renderer;

    /* Scene */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    Cabinet.scene = scene;

    /* Cameras */
    const camera     = new THREE.PerspectiveCamera(45, W / H, 0.001, 200);
    const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.001, 200);
    let   _orthoActive = false;
    Cabinet.camera = camera;

    /* Lights */
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    const key = new THREE.DirectionalLight(0xfff4e8, 1.1);
    key.position.set(4, 6, 4);
    key.castShadow = true;
    key.shadow.bias = -0.001;
    key.shadow.normalBias = 0.02;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xd0e8ff, 0.45);
    fill.position.set(-4, 2, -3);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xccffee, 0.25);
    rim.position.set(0, -2, -5);
    scene.add(rim);

    /* Grid */
    window.dispatchEvent(new CustomEvent('cabinetSceneReady'));

    /* Controls & gizmo */
    CabinetControls.init(camera, renderer);
    _initGizmo();

    /* Ortho frustum helper — call after radius or canvas size changes */
    function _updateOrtho() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const r = CabinetControls.getRadius();
      const halfH = r * Math.tan(22.5 * Math.PI / 180); // fov=45 → half-fov=22.5°
      const halfW = halfH * (w / h);
      orthoCamera.left   = -halfW;
      orthoCamera.right  =  halfW;
      orthoCamera.top    =  halfH;
      orthoCamera.bottom = -halfH;
      orthoCamera.updateProjectionMatrix();
    }

    /* Resize */
    new ResizeObserver(() => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      _updateOrtho();
    }).observe(canvas.parentElement);

    /* Render loop */
    (function loop() {
      requestAnimationFrame(loop);
      CabinetControls.update();
      if (_orthoActive) {
        orthoCamera.position.copy(camera.position);
        orthoCamera.quaternion.copy(camera.quaternion);
        _updateOrtho();
      }
      renderer.render(scene, _orthoActive ? orthoCamera : camera);
      _renderGizmo();
      if (window.CabinetBuilder) CabinetBuilder.updateLabelOverlays();
      if (window.CabinetArrow)   CabinetArrow.updateLabels();
    })();

    /* Ortho toggle — exposed via CabinetCamera */
    CabinetCamera._toggleOrtho = function () {
      _orthoActive = !_orthoActive;
      Cabinet.camera = _orthoActive ? orthoCamera : camera;
      const btn = document.getElementById('orthoBtn');
      if (btn) {
        btn.textContent = _orthoActive ? 'Ortho' : 'Persp';
        btn.classList.toggle('active', _orthoActive);
      }
    };

    /* Drag-and-drop accessory placement */
    if (window.CabinetDrag) CabinetDrag.init(canvas, scene, camera);

    /* Row-origin arrow */
    if (window.CabinetArrow) CabinetArrow.init(canvas, scene, camera);

    /* Done – hide loading overlay */
    const overlay = document.getElementById('viewportLoading');
    if (overlay) overlay.style.display = 'none';
  }

  /* ── Orbit controls ─────────────────────────────── */
  window.CabinetControls = (function () {
    let cam, canvasEl;
    let theta = 36.0 * Math.PI / 180, phi = 86.2 * Math.PI / 180, radius = 5.240;
    let target;   // initialised inside init() — THREE must be loaded first
    let drag = false, panMode = false, panStart = null;
    let lastX = 0, lastY = 0;

    function update() {
      if (!cam || !target) return;
      const x = target.x + radius * Math.sin(phi) * Math.sin(theta);
      const y = target.y + radius * Math.cos(phi);
      const z = target.z + radius * Math.sin(phi) * Math.cos(theta);
      cam.position.set(x, y, z);
      // When nearly top-down, use -Z as up so the view stays stable
      cam.up.set(0, phi < 0.1 ? 0 : 1, phi < 0.1 ? -1 : 0);
      cam.lookAt(target);
    }

    function init(camera, renderer) {
      cam      = camera;
      canvasEl = renderer.domElement;
      target   = new THREE.Vector3(0.450, 1.092, 0.152);

      canvasEl.addEventListener('mousedown', e => {
        if (e.button === 2) {
          panMode  = true;
          panStart = { x: e.clientX, y: e.clientY, t: target.clone() };
        } else {
          drag = true;
        }
        lastX = e.clientX; lastY = e.clientY;
      });

      window.addEventListener('mousemove', e => {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        if (drag && !panMode) {
          theta -= dx * 0.006;
          phi    = Math.max(0.05, Math.min(Math.PI - 0.05, phi + dy * 0.006));
        }
        if (panMode && panStart) {
          const s     = radius * 0.0015;
          const right = new THREE.Vector3();
          const up    = new THREE.Vector3(0, 1, 0);
          cam.getWorldDirection(right);
          right.cross(up).normalize();
          target.copy(panStart.t)
            .addScaledVector(right, -(e.clientX - panStart.x) * s)
            .addScaledVector(up,     (e.clientY - panStart.y) * s);
        }
      });

      window.addEventListener('mouseup', () => { drag = false; panMode = false; panStart = null; });
      canvasEl.addEventListener('wheel', e => {
        radius = Math.max(0.3, Math.min(30, radius + e.deltaY * 0.004));
      }, { passive: true });
      canvasEl.addEventListener('contextmenu', e => e.preventDefault());
    }

    function setView(t, p, r) { theta = t; phi = p; if (r != null) radius = r; }
    function setTarget(v)     { target.copy(v); }
    function getTarget()      { return target.clone(); }
    function getTheta()       { return theta; }
    function getPhi()         { return phi; }
    function getRadius()      { return radius; }

    return { init, update, setView, setTarget, getTarget, getTheta, getPhi, getRadius };
  })();

  /* ── Camera presets ─────────────────────────────── */
  window.CabinetCamera = {
    toggleOrtho() { if (this._toggleOrtho) this._toggleOrtho(); },
    setView(name) {
      const MAP = {
        front: [0,          Math.PI/2],
        side:  [Math.PI/2,  Math.PI/2],
        top:   [0,          0.01],
        iso:   [Math.PI/5,  Math.PI/3.8],
      };
      const v = MAP[name]; if (!v) return;

      // Angles
      const t0 = CabinetControls.getTheta(), p0 = CabinetControls.getPhi();
      const [t1, p1] = v;

      // Target: animate from current to assembly centre
      const tgt0 = CabinetControls.getTarget();
      const tgt1 = _assemblyCenter();

      const start = performance.now(), dur = 520;
      const ease  = t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      (function tick(now) {
        const e = ease(Math.min((now - start) / dur, 1));
        CabinetControls.setView(t0 + (t1-t0)*e, p0 + (p1-p0)*e);
        CabinetControls.setTarget(new THREE.Vector3(
          tgt0.x + (tgt1.x - tgt0.x) * e,
          tgt0.y + (tgt1.y - tgt0.y) * e,
          tgt0.z + (tgt1.z - tgt0.z) * e,
        ));
        if (now - start < dur) requestAnimationFrame(tick);
      })(performance.now());
    }
  };

  function _assemblyCenter() {
    const assembly = Cabinet.scene && Cabinet.scene.getObjectByName('CabinetAssembly');
    if (!assembly) return new THREE.Vector3(0, 0.9, 0);
    const box = new THREE.Box3().setFromObject(assembly);
    return box.getCenter(new THREE.Vector3());
  }

  /* ── Gizmo — scissor/viewport composited into main canvas ── */
  let _gizmoScene, _gizmoCam;

  const _GIZMO_SIZE   = 112;  // px
  const _GIZMO_MARGIN = 20;   // px from canvas edges

  function _initGizmo() {
    _gizmoScene = new THREE.Scene();
    _gizmoCam   = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 20);

    const AXES = [
      { dir: new THREE.Vector3(1, 0, 0), color: 0xff3333, neg: 0x661111, label: 'X' },
      { dir: new THREE.Vector3(0, 1, 0), color: 0x33cc44, neg: 0x115522, label: 'Y' },
      { dir: new THREE.Vector3(0, 0, 1), color: 0x3388ff, neg: 0x113366, label: 'Z' },
    ];

    AXES.forEach(({ dir, color, neg, label }) => {
      // Positive arrow
      const arrow = new THREE.ArrowHelper(
        dir, new THREE.Vector3(0, 0, 0), 1.05, color, 0.28, 0.14
      );
      arrow.line.material.depthTest    = false;
      arrow.line.material.transparent  = true;
      arrow.cone.material.depthTest    = false;
      arrow.cone.material.transparent  = true;
      arrow.renderOrder = 999;
      _gizmoScene.add(arrow);

      // Negative stub
      const negLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          dir.clone().negate().multiplyScalar(0.45),
        ]),
        new THREE.LineBasicMaterial({ color: neg, depthTest: false, transparent: true, opacity: 0.5 })
      );
      negLine.renderOrder = 998;
      _gizmoScene.add(negLine);

      // Sprite label
      _gizmoScene.add(_makeGizmoLabel(label, color, dir.clone().multiplyScalar(1.38)));
    });
  }

  function _makeGizmoLabel(text, color, position) {
    const size = 64;
    const cv   = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx  = cv.getContext('2d');

    ctx.font         = 'bold 34px "Mont", monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#' + color.toString(16).padStart(6, '0');
    ctx.fillText(text, size / 2, size / 2 + 1);

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false,
    }));
    sprite.scale.set(0.52, 0.52, 0.52);
    sprite.position.copy(position);
    sprite.renderOrder = 1000;
    return sprite;
  }

  function _renderGizmo() {
    if (!_gizmoScene || !_gizmoCam || !Cabinet.renderer) return;

    // Point gizmo camera from the same direction as the main camera
    const theta = CabinetControls.getTheta();
    const phi   = CabinetControls.getPhi();
    const dir   = new THREE.Vector3(
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.cos(theta)
    );
    _gizmoCam.position.copy(dir.multiplyScalar(7));
    _gizmoCam.lookAt(0, 0, 0);
    _gizmoCam.up.set(0, 1, 0);
    _gizmoCam.updateMatrixWorld(true);

    const rdr    = Cabinet.renderer;
    const canvas = rdr.domElement;
    const x = _GIZMO_MARGIN, y = _GIZMO_MARGIN;
    const gs = _GIZMO_SIZE;

    const prevAutoClear = rdr.autoClear;
    rdr.autoClear = false;

    rdr.setScissorTest(true);
    rdr.setScissor(x, y, gs, gs);
    rdr.setViewport(x, y, gs, gs);

    const prevColor = new THREE.Color();
    const prevAlpha = rdr.getClearAlpha();
    rdr.getClearColor(prevColor);
    rdr.setClearColor(0xffffff, 1);
    rdr.clear(true, true, false);

    rdr.render(_gizmoScene, _gizmoCam);

    rdr.setClearColor(prevColor, prevAlpha);
    rdr.setScissorTest(false);
    rdr.setViewport(0, 0, canvas.clientWidth, canvas.clientHeight);
    rdr.autoClear = prevAutoClear;
  }

  /* ── Helpers ────────────────────────────────────── */
  function _setLoadingMsg(msg) {
    const span = document.querySelector('#viewportLoading span');
    if (span) span.textContent = msg;
    const spinner = document.querySelector('#viewportLoading .spinner');
    if (spinner) spinner.style.display = 'none';
  }

})();
