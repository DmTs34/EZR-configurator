/**
 * cabinet-builder.js
 * Assembles a 3D cabinet from GLB components based on the description code.
 *
 * Current logic (from ConfiguratorLogic.md):
 *   - Two C-shaped frames: EZR_C_FRM-{HE}-NT.glb
 *   - Frame spacing depends on cabinet width (DE first 2 digits):
 *       300mm → 260mm apart
 *       600mm → 560mm apart
 *       900mm → 860mm apart
 *      1200mm → 1200mm apart
 *   - GLB files live in components/cabinet/
 *   - Scale convention: 1 mm = 0.001 THREE units (SimLab GLB standard)
 */

window.CabinetBuilder = (function () {
  'use strict';

  const COMP_ROOT  = 'components/';
  const MM         = 0.001;   // mm → THREE units

  // Frame spacing (mm) keyed by cabinet width (mm)
  const FRAME_SPACING = {
    300:   260,
    600:   560,
    900:   860,
    1200: 1160,
  };

  // Horizontal profile GLB name keyed by cabinet width (mm)
  const PROFILE_GLB = {
    300:  'EZR_PROF-L220-NT.glb',
    600:  'EZR_PROF-L520-NT.glb',
    900:  'EZR_PROF-L820-NT.glb',
    1200: 'EZR_PROF-L1120-NT.glb',
  };

  // Top profile Y position (mm) keyed by heightU
  const PROFILE_TOP_Y = {
    50: 2310,   // 2130 + 180
    46: 2130,
    42: 1950,   // 2130 - 180
    38: 1770,   // 2130 - 360
    22: 1050,
    18:  870,   // 1050 - 180
  };

  // X offset for both horizontal profiles (mm)
  const PROFILE_X_MM = 40;

  // Vertical profile GLB name keyed by heightU
  const VERT_PROF_GLB = {
    50: 'EZR_PROF-L2270-NT.glb',
    46: 'EZR_PROF-L2090-NT.glb',
    42: 'EZR_PROF-L1910-NT.glb',
    38: 'EZR_PROF-L1730-NT.glb',
    22: 'EZR_PROF-L1010-NT.glb',
    18: 'EZR_PROF-L830-NT.glb',
  };

  // Vertical profile X offsets (mm) keyed by DE code
  // 300mm and 600mm widths have no vertical profiles (not listed here)
  const VERT_PROF_X = {
    '06000': [260, 300],
    '09L00': [600],
    '090R0': [260],
    '12LR0': [260, 900],
  };

  // Mounting plates ─────────────────────────────────
  const PLATE_4U_H    = 177.8;  // mm  (4 × 44.45)
  const PLATE_Y_START =  40;    // mm  bottom offset from cabinet origin
  const PLATE_Z_MM    =  42;    // mm  forward offset (Z axis)
  const ASSEMBLY_LIFT =  14;    // mm  group.position.y lift (feet on y=0)

  // Number of 4U plates per height (plus always 1 × 2U cap)
  const MOUNT_PLT_COUNT = {
    50: 12, 46: 11, 42: 10, 38: 9, 22: 5, 18: 4,
  };

  // X start positions (mm) of plate columns keyed by DE code
  // DE codes not listed here have no mounting plates
  const MOUNT_PLT_X = {
    '03000': [7.5],
    '06000': [7.5, 307.5],
    '09L00': [607.5],
    '090R0': [7.5],
    '12LR0': [7.5, 907.5],
  };

  // Door sizes (mm) per DE — only applies to EZR_CL
  // null = no door on that side
  const DOOR_CONFIG = {
    '03000': { left: 300,  right: null },
    '03TLT': { left: 300,  right: null },
    '03TRT': { left: null, right: 300  },
    '06000': { left: 600,  right: null },
    '06LR0': { left: 600,  right: null },
    '09L00': { left: 600,  right: 300  },
    '090R0': { left: 300,  right: 600  },
    '09STL': { left: 600,  right: 300  },
    '09STR': { left: 300,  right: 600  },
    '09DAR': { left: 300,  right: 600  },
    '12LR0': { left: 600,  right: 600  },
    '12IFA': { left: 600,  right: 600        },
    '12STM': { left: 600,  right: 600        },
    '15DAS': { left: 600, middle: 300, right: 600 },
  };

  const DOOR_Z_MM = 300;  // forward offset (Z axis) for all doors

  // EZR_OP designs → FR base DE (for plate positions)
  const DE_FR_BASE = {
    '03TLT': '03000',
    '03TRT': '03000',
    '09STL': '09L00',
    '09STR': '090R0',
    '09DAR': '090R0',
    '12IFA': '12LR0',
    '12STM': '12LR0',
  };

  // Attachment point coordinates (mm) local to plate origin
  const MOUT_PLT_ATTACH_PTS = {
    A6: { x:  52.5, y:  22.2, z: 1.5 }, A5: { x:  52.5, y:  48.9, z: 1.5 },
    A4: { x:  52.5, y:  75.6, z: 1.5 }, A3: { x:  52.5, y: 102.3, z: 1.5 },
    A2: { x:  52.5, y: 129.0, z: 1.5 }, A1: { x:  52.5, y: 155.7, z: 1.5 },
    B6: { x: 142.5, y:  22.2, z: 1.5 }, B5: { x: 142.5, y:  48.9, z: 1.5 },
    B4: { x: 142.5, y:  75.6, z: 1.5 }, B3: { x: 142.5, y: 102.3, z: 1.5 },
    B2: { x: 142.5, y: 129.0, z: 1.5 }, B1: { x: 142.5, y: 155.7, z: 1.5 },
    C6: { x: 232.5, y:  22.2, z: 1.5 }, C5: { x: 232.5, y:  48.9, z: 1.5 },
    C4: { x: 232.5, y:  75.6, z: 1.5 }, C3: { x: 232.5, y: 102.3, z: 1.5 },
    C2: { x: 232.5, y: 129.0, z: 1.5 }, C1: { x: 232.5, y: 155.7, z: 1.5 },
    'ret-L': { x:  12.6, y: 60.0, z: 1.5 },
    'ret-R': { x: 272.3, y: 60.0, z: 1.5 },
  };

  // Plate designs: name → list of { glb, pt, rotZ? }
  // rotZ — rotation around Z axis in radians
  const PLATE_DESIGNS = {
    'AX': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'A1', rotZ: Math.PI },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'C1', rotZ: Math.PI },
    ],
    'BL': [
      { glb: 'EZR_MDL-L224-NT.glb',   pt: 'B5' },
      { glb: 'EZR_MDL-L224-NT.glb',   pt: 'B2' },
      { glb: 'EZR_SEP_PLT-4U-R.glb',  pt: 'C5' },
    ],
    'BR': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B5' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B2' },
      { glb: 'EZR_SEP_PLT-4U.glb',  pt: 'A5' },
    ],
    'CL': [
      { glb: 'EZR_SEP_PLT-4U-R.glb', pt: 'C5' },
    ],
    'CR': [
      { glb: 'EZR_SEP_PLT-4U.glb', pt: 'A5' },
    ],
    'DL': [
      { glb: 'EZR_MDL-L224-NT.glb',      pt: 'A1', rotZ: Math.PI },
      { glb: 'EZR_MDL-L224-NT.glb',      pt: 'C1', rotZ: Math.PI },
      { glb: 'EZR_SEP_PLT-4U-horiz.glb', pt: 'B6', offsetX:  53 },
    ],
    'DR': [
      { glb: 'EZR_MDL-L224-NT.glb',      pt: 'A1', rotZ: Math.PI },
      { glb: 'EZR_MDL-L224-NT.glb',      pt: 'C1', rotZ: Math.PI },
      { glb: 'EZR_SEP_PLT-4U-horiz.glb', pt: 'B6', offsetX: -53 },
    ],
    'GM': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B1' },
      { glb: 'EZR_MDL-L87-NT.glb',  pt: 'A5', rotZ: Math.PI },
      { glb: 'EZR_MDL-L87-NT.glb',  pt: 'C5', rotZ: Math.PI },
    ],
    'HM': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B1' },
      { glb: 'EZR_MDL-L87-NT.glb',  pt: 'A2' },
      { glb: 'EZR_MDL-L87-NT.glb',  pt: 'C2' },
      { glb: 'EZR_MDL-L87-NT.glb',  pt: 'A5', rotZ: Math.PI },
      { glb: 'EZR_MDL-L87-NT.glb',  pt: 'C5', rotZ: Math.PI },
    ],
    'KM': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B1', rotZ: Math.PI },
    ],
    'EL': [
      { glb: 'EZR_SEP_PLT-4U.glb',   pt: 'A5' },
      { glb: 'EZR_MDL-L224-NT.glb',  pt: 'B2' },
      { glb: 'EZR_MDL-L224-NT.glb',  pt: 'B5', rotZ: Math.PI },
      { glb: 'EZR_MDL-L87-NT.glb',   pt: 'C5' },
      { glb: 'EZR_RET.glb',          pt: 'ret-L' },
    ],
    'ER': [
      { glb: 'EZR_SEP_PLT-4U-R.glb', pt: 'C5' },
      { glb: 'EZR_MDL-L224-NT.glb',  pt: 'B2' },
      { glb: 'EZR_MDL-L224-NT.glb',  pt: 'B5', rotZ: Math.PI },
      { glb: 'EZR_MDL-L87-NT.glb',   pt: 'A5' },
      { glb: 'EZR_RET.glb',          pt: 'ret-R' },
    ],
    'FL': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'A1', rotZ: Math.PI },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B2' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B5', rotZ: Math.PI },
      { glb: 'EZR_MDL-L87-NT.glb',  pt: 'C5' },
    ],
    'FR': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'C1', rotZ: Math.PI },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B2' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B5', rotZ: Math.PI },
      { glb: 'EZR_MDL-L87-NT.glb',  pt: 'A5' },
    ],
  };

  // Per-plate design assignments keyed by OP DE code, then heightU
  // Index 0 = bottom plate. null = no accessories on that plate.
  // Values are either string[] (same for all columns) or string[][] (one array per column).
  const PLATE_DESIGN_ROWS = {
    '09STL': {
      50: ['AX','BR','BR','BR','BR','DR','BR','BR','BR','BR','CR', null],
      46: ['AX','BR','BR','BR','BR','DR','BR','BR','BR','BR','CR'],
      42: ['AX','BR','BR','BR','BR','DR','BR','BR','BR','BR'],
      38: ['AX','BR','BR','BR','DR','BR','BR','BR','CR'],
      22: ['AX','BR','BR','BR','BR'],
      18: ['AX','BR','BR','BR'],
    },
    '09STR': {
      50: ['AX','BL','BL','BL','BL','DL','BL','BL','BL','BL','CL', null],
      46: ['AX','BL','BL','BL','BL','DL','BL','BL','BL','BL','CL'],
      42: ['AX','BL','BL','BL','BL','DL','BL','BL','BL','BL'],
      38: ['AX','BL','BL','BL','DL','BL','BL','BL','CL'],
      22: ['AX','BL','BL','BL','BL'],
      18: ['AX','BL','BL','BL'],
    },
    '09DAR': {
      50: ['KM','HM','GM','GM','GM','GM','GM','GM','GM','GM','GM', null],
      46: ['KM','HM','GM','GM','GM','GM','GM','GM','GM','GM','GM'],
      42: ['KM','HM','GM','GM','GM','GM','GM','GM','GM','GM'],
      38: ['KM','HM','GM','GM','GM','GM','GM','GM','GM'],
      22: ['KM','HM','GM','GM','GM'],
      18: ['KM','HM','GM','GM'],
    },
    // 12STM: two columns — col 0 (left) uses 09STR pattern, col 1 (right) uses 09STL pattern
    '12STM': {
      50: [
        ['AX','BL','BL','BL','BL','DL','BL','BL','BL','BL','CL', null],
        ['AX','BR','BR','BR','BR','DR','BR','BR','BR','BR','CR', null],
      ],
      46: [
        ['AX','BL','BL','BL','BL','DL','BL','BL','BL','BL','CL'],
        ['AX','BR','BR','BR','BR','DR','BR','BR','BR','BR','CR'],
      ],
      42: [
        ['AX','BL','BL','BL','BL','DL','BL','BL','BL','BL'],
        ['AX','BR','BR','BR','BR','DR','BR','BR','BR','BR'],
      ],
      38: [
        ['AX','BL','BL','BL','DL','BL','BL','BL','CL'],
        ['AX','BR','BR','BR','DR','BR','BR','BR','CR'],
      ],
      22: [
        ['AX','BL','BL','BL','BL'],
        ['AX','BR','BR','BR','BR'],
      ],
      18: [
        ['AX','BL','BL','BL'],
        ['AX','BR','BR','BR'],
      ],
    },
    // 12IFA: two columns — col 0 (left) = GL, col 1 (right) = GR on plate 2; plate 1 always empty
    '12IFA': {
      50: [
        [null,'FL','EL','EL','EL','EL','FL','EL','EL','EL','EL',null],
        [null,'FR','ER','ER','ER','ER','FR','ER','ER','ER','ER',null],
      ],
      46: [
        [null,'FL','EL','EL','EL','EL','FL','EL','EL','EL','EL'],
        [null,'FR','ER','ER','ER','ER','FR','ER','ER','ER','ER'],
      ],
      42: [
        [null,'FL','EL','EL','EL','FL','EL','EL','EL',null],
        [null,'FR','ER','ER','ER','FR','ER','ER','ER',null],
      ],
      38: [
        [null,'FL','EL','EL','EL','FL','EL','EL','EL'],
        [null,'FR','ER','ER','ER','FR','ER','ER','ER'],
      ],
      22: [
        [null,'FL','EL','EL','EL'],
        [null,'FR','ER','ER','ER'],
      ],
      18: [
        [null,'FL','EL','EL'],
        [null,'FR','ER','ER'],
      ],
    },
  };

  const _cache = {};              // path → THREE.Group
  let   _assembly        = null;  // current (in-progress) cabinet group
  let   _lockedAssemblies = [];   // confirmed cabinets — kept in scene

  const FADE_MS = 270;         // fade duration in ms

  /* ══════════════════════════════════════════════════
     PUBLIC
  ════════════════════════════════════════════════════ */
  async function build(code, { noFade = false, xOffset = 0 } = {}) {
    if (!code) { _status(''); return; }

    const p = _parse(code);
    if (!p) { showToast('Cannot parse code: ' + code, 'error'); return; }

    // Check one-shot flag from Cabinet state
    const skipFade = noFade || Cabinet.noFadeNext;
    Cabinet.noFadeNext = false;

    _status('Building ' + code + '…');

    // Fade out old assembly immediately — loading happens in parallel
    if (_assembly) {
      if (skipFade) { Cabinet.scene.remove(_assembly); _disposeGroup(_assembly); }
      else          { _fadeOutAndDispose(_assembly); }
      _assembly = null;
    }

    try {
      const group = await _assemble(p);
      group.position.x = xOffset * MM;
      Cabinet.scene.add(group);
      _assembly = group;
      _fitCamera(group);
      if (!skipFade) _fadeIn(group);
      _status('');
      showToast('Built: ' + code, 'success');
      window.dispatchEvent(new CustomEvent('cabinetBuilt'));
    } catch (err) {
      console.error('[CabinetBuilder]', err);
      _status('');
      showToast('Build error — check console', 'error');
    }
  }

  function clearAssembly({ noFade = false } = {}) {
    if (!_assembly) return;
    if (noFade || Cabinet.noFadeNext) {
      Cabinet.noFadeNext = false;
      Cabinet.scene.remove(_assembly);
      _disposeGroup(_assembly);
    } else {
      _fadeOutAndDispose(_assembly);
    }
    _assembly = null;
    window.dispatchEvent(new CustomEvent('cabinetBuilt'));
  }

  // Detach current assembly from management (keep in scene — it's confirmed)
  function lockAssembly() {
    if (_assembly) { _lockedAssemblies.push(_assembly); _assembly = null; }
  }

  // Remove all locked + current assemblies from scene (full reset)
  function clearAll({ noFade = false } = {}) {
    clearAssembly({ noFade });
    for (const grp of _lockedAssemblies) {
      Cabinet.scene.remove(grp);
      _disposeGroup(grp);
    }
    _lockedAssemblies = [];
  }

  /* ══════════════════════════════════════════════════
     PARSE
  ════════════════════════════════════════════════════ */
  function _parse(code) {
    const parts = code.split('-');
    if (parts.length < 6) return null;
    const [pr, he, de, cov, as_, cl] = parts;
    const heightU = parseInt(he);        // e.g. 46
    const widthMM = parseInt(de.slice(0, 2)) * 100;  // first 2 digits of DE, e.g. "09" → 900
    if (isNaN(heightU) || isNaN(widthMM)) return null;
    return { pr, he, de, cov, as: as_, cl, heightU, widthMM };
  }

  /* ══════════════════════════════════════════════════
     BUILD CABINET PART
     Builds one cabinet section (frames + profiles + plates + feet)
     into `group`, shifted right by offsetX mm.
  ════════════════════════════════════════════════════ */
  async function _buildCabinetPart(p, de, offsetX, group) {
    const widthMM   = parseInt(de.slice(0, 2)) * 100;
    const spacingMM = FRAME_SPACING[widthMM];
    if (spacingMM === undefined) throw new Error('Unknown width for DE: ' + de);

    /* ── Frames ───────────────────────────────────── */
    const glbPath = `${COMP_ROOT}EZR_C_FRM-${p.he}-NT.glb`;
    let frameA, frameB;
    try {
      frameA = await _loadGLB(glbPath);
      frameB = await _loadGLB(glbPath);
    } catch (e) {
      console.error('[CabinetBuilder] GLB load error:', e.message);
      showToast('GLB not loaded, using placeholder', 'info');
      frameA = _makePlaceholderFrame(p.heightU, p.cl);
      frameB = _makePlaceholderFrame(p.heightU, p.cl);
    }
    frameA.position.set(offsetX * MM, 0, 0);
    frameB.position.set((offsetX + spacingMM) * MM, 0, 0);
    group.add(frameA, frameB);

    /* ── Horizontal profiles ──────────────────────── */
    const profGlbName = PROFILE_GLB[widthMM];
    const topYmm      = PROFILE_TOP_Y[p.heightU];
    if (profGlbName && topYmm !== undefined) {
      const profPath = `${COMP_ROOT}${profGlbName}`;
      try {
        const profBot = await _loadGLB(profPath);
        const profTop = await _loadGLB(profPath);
        profBot.position.set((offsetX + PROFILE_X_MM) * MM, 0,          0);
        profTop.position.set((offsetX + PROFILE_X_MM) * MM, topYmm * MM, 0);
        group.add(profBot, profTop);
      } catch (e) {
        console.warn('[CabinetBuilder] Profile GLB not found:', profPath);
      }
    }

    /* ── Vertical profiles ────────────────────────── */
    const vertGlbName = VERT_PROF_GLB[p.heightU];
    const deForVert   = DE_FR_BASE[de] || de;
    const vertXList   = VERT_PROF_X[deForVert];
    if (vertGlbName && vertXList) {
      const vertPath = `${COMP_ROOT}${vertGlbName}`;
      try {
        for (const xMM of vertXList) {
          const prof = await _loadGLB(vertPath);
          prof.position.set((offsetX + xMM) * MM, 0, 0);
          group.add(prof);
        }
      } catch (e) {
        console.warn('[CabinetBuilder] Vertical profile GLB not found:', vertPath);
      }
    }

    /* ── Mounting plates ──────────────────────────── */
    const deForPlates   = DE_FR_BASE[de] || de;
    const pltXList      = MOUNT_PLT_X[deForPlates];
    const plt4uCount    = MOUNT_PLT_COUNT[p.heightU];
    const rawDesignRows = (PLATE_DESIGN_ROWS[de] || {})[p.heightU] || null;

    if (pltXList && plt4uCount !== undefined) {
      const plt4uPath = `${COMP_ROOT}EZR_MOUT_PLT-4U.glb`;
      const plt2uPath = `${COMP_ROOT}EZR_MOUT_PLT-2U.glb`;

      for (let colIdx = 0; colIdx < pltXList.length; colIdx++) {
        const xMM = pltXList[colIdx];
        const designRows = rawDesignRows
          ? (Array.isArray(rawDesignRows[0]) ? (rawDesignRows[colIdx] || null) : rawDesignRows)
          : null;
        try {
          let yMM = PLATE_Y_START;
          for (let i = 0; i < plt4uCount; i++) {
            const plt = await _loadGLB(plt4uPath);
            plt.position.set((offsetX + xMM) * MM, yMM * MM, PLATE_Z_MM * MM);
            group.add(plt);

            const designName  = designRows ? designRows[i] : null;
            const accessories = designName ? PLATE_DESIGNS[designName] : null;
            if (accessories) {
              for (const acc of accessories) {
                try {
                  const pt  = MOUT_PLT_ATTACH_PTS[acc.pt];
                  const mdl = await _loadGLB(`${COMP_ROOT}${acc.glb}`);
                  mdl.position.set(
                    (offsetX + xMM + pt.x + (acc.offsetX || 0)) * MM,
                    (yMM + pt.y + (acc.offsetY || 0)) * MM,
                    (PLATE_Z_MM + pt.z) * MM
                  );
                  if (acc.rotZ) mdl.rotation.z = acc.rotZ;
                  mdl.userData.isAccessory = true;
                  group.add(mdl);
                } catch (e) {
                  console.warn('[CabinetBuilder] Accessory GLB not found:', acc.glb);
                }
              }
            }
            yMM += PLATE_4U_H;
          }
          const plt2u = await _loadGLB(plt2uPath);
          plt2u.position.set((offsetX + xMM) * MM, yMM * MM, PLATE_Z_MM * MM);
          group.add(plt2u);
        } catch (e) {
          console.warn('[CabinetBuilder] Mounting plate GLB not found:', e.message);
        }
      }
    }

    /* ── Feet ─────────────────────────────────────── */
    const footPath    = `${COMP_ROOT}EZR_FOOT-M8.glb`;
    const footOffsets = [{ x: 20, z: 50 }, { x: 20, z: 270 }];
    try {
      for (const frameX of [offsetX, offsetX + spacingMM]) {
        for (const off of footOffsets) {
          const foot = await _loadGLB(footPath);
          foot.position.set((frameX + off.x) * MM, 0, off.z * MM);
          group.add(foot);
        }
      }
    } catch (e) {
      console.warn('[CabinetBuilder] Foot GLB not found:', footPath);
    }
  }

  /* ══════════════════════════════════════════════════
     ASSEMBLE
  ════════════════════════════════════════════════════ */
  async function _assemble(p) {
    const group = new THREE.Group();
    group.name  = 'CabinetAssembly';

    /* ── Structure ────────────────────────────────── */
    if (p.de === '15DAS') {
      await _buildCabinetPart(p, '06LR0', 0,   group);  // left: 600 mm
      await _buildCabinetPart(p, '09DAR', 600, group);  // right: 900 mm
    } else {
      await _buildCabinetPart(p, p.de, 0, group);
    }

    /* ── Doors (EZR_CL only) ──────────────────────── */
    if (p.pr === 'EZR_CL') {
      function _doorStyle(code) {
        if ('123ABC'.includes(code)) return 'SOLID';
        if ('456DEF'.includes(code)) return 'GLASS';
        if ('789GHI'.includes(code)) return 'PERF';
        return null;
      }

      const doorColorHex = _clToHex(p.cl);

      function _applyDoorColor(obj) {
        obj.traverse(child => {
          if (child.isMesh && child.material) {
            child.material = child.material.clone();
            child.material.color.setHex(doorColorHex);
          }
        });
      }

      const hingeGlb    = `${COMP_ROOT}EZR_hinge-${p.he}.glb`;
      const HINGE_OFF_X = 6.5;   // mm — pivot offset from door origin along X
      const HINGE_OFF_Z = 39.4;  // mm — pivot offset from door origin along Z

      async function _placeDoorLeft(style, size, x) {
        const glb = `LD-${style}-${p.he}-${size}.glb`;
        try {
          const door  = await _loadGLB(`${COMP_ROOT}${glb}`);
          _applyDoorColor(door);
          // Pivot sits at hinge centre; door is offset back so its origin aligns correctly
          door.position.set(-HINGE_OFF_X * MM, 0, -HINGE_OFF_Z * MM);
          const pivot = new THREE.Group();
          pivot.position.set((x + HINGE_OFF_X) * MM, 0, (DOOR_Z_MM + HINGE_OFF_Z) * MM);
          pivot.userData.isDoor   = true;
          pivot.userData.doorSide = 'left';
          pivot.add(door);
          group.add(pivot);
          try {
            const hinge = await _loadGLB(hingeGlb);
            hinge.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.color.setHex(0x111111); } });
            hinge.position.set(x * MM, 0, DOOR_Z_MM * MM);
            group.add(hinge);
          } catch { /* hinge GLB optional */ }
        } catch (e) { console.warn('[CabinetBuilder] Door GLB not found:', glb); }
      }

      async function _placeDoorRight(style, size, x) {
        const glb = `LD-${style}-${p.he}-${size}.glb`;
        try {
          const door  = await _loadGLB(`${COMP_ROOT}${glb}`);
          _applyDoorColor(door);
          const bbox  = new THREE.Box3().setFromObject(door);
          door.rotation.z = Math.PI;
          // After z=PI rotation x is negated, so hinge offset becomes +X in local space
          door.position.set(HINGE_OFF_X * MM, bbox.max.y, -HINGE_OFF_Z * MM);
          const pivot = new THREE.Group();
          pivot.position.set((x - HINGE_OFF_X) * MM, 0, (DOOR_Z_MM + HINGE_OFF_Z) * MM);
          pivot.userData.isDoor   = true;
          pivot.userData.doorSide = 'right';
          pivot.add(door);
          group.add(pivot);
          try {
            const hinge = await _loadGLB(hingeGlb);
            hinge.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.color.setHex(0x111111); } });
            const hbbox = new THREE.Box3().setFromObject(hinge);
            hinge.rotation.z = Math.PI;
            hinge.position.set(x * MM, hbbox.max.y, DOOR_Z_MM * MM);
            group.add(hinge);
          } catch { /* hinge GLB optional */ }
        } catch (e) { console.warn('[CabinetBuilder] Door GLB not found:', glb); }
      }

      if (p.de === '15DAS') {
        // Three doors: ld(600) at x=0, md(300) at x=600, rd(600) at x=1500
        const ldStyle = _doorStyle(p.cov[1]);
        const mdStyle = _doorStyle(p.cov[2]);
        const rdStyle = _doorStyle(p.cov[3]);
        if (ldStyle) await _placeDoorLeft (ldStyle, 600,  0);
        if (mdStyle) await _placeDoorLeft (mdStyle, 300,  600);
        if (rdStyle) await _placeDoorRight(rdStyle, 600,  1500);
      } else {
        const ldStyle = _doorStyle(p.cov[1]);
        const rdStyle = _doorStyle(p.cov[3]);
        const doorCfg = DOOR_CONFIG[p.de] || null;
        if (doorCfg) {
          if (ldStyle && doorCfg.left)  await _placeDoorLeft (ldStyle, doorCfg.left,  0);
          if (rdStyle && doorCfg.right) await _placeDoorRight(rdStyle, doorCfg.right, p.widthMM);
        }
      }

      /* ── Side walls ───────────────────────────────── */
      const swCode = (p.cov[7] || '0') + (p.cov[8] || '0'); // e.g. "11", "10", "01", "00"
      if (swCode !== '00') {
        const swGlb = `${COMP_ROOT}EZR_SW-${p.he}.glb`;
        const coverColorHex = _clToHex(p.cl);

        function _applyCoverColor(obj) {
          obj.traverse(child => {
            if (!child.isMesh) return;
            const applyToMat = m => {
              const mc = m.clone();
              mc.color.setHex(coverColorHex);
              mc.vertexColors = false;
              mc.map = null;
              mc.needsUpdate = true;
              return mc;
            };
            if (Array.isArray(child.material))
              child.material = child.material.map(applyToMat);
            else
              child.material = applyToMat(child.material);
          });
        }

        // Left side wall: x=0, y=41mm, z=0, no rotation
        if (swCode[0] === '1') {
          try {
            const sw = await _loadGLB(swGlb);
            _applyCoverColor(sw);
            sw.position.set(0, 42 * MM, 40 * MM);
            sw.userData.isSideWall = true;
            group.add(sw);
          } catch (e) { console.warn('[CabinetBuilder] Side wall GLB not found:', swGlb); }
        }

        // Right side wall: rotate upside down (z=PI) around model center, shift to x=widthMM
        if (swCode[1] === '1') {
          try {
            const sw = await _loadGLB(swGlb);
            _applyCoverColor(sw);
            const bbox = new THREE.Box3().setFromObject(sw);
            sw.rotation.z = Math.PI;
            sw.position.set(0, bbox.max.y, 0); // compensate for upside-down flip
            const pivot = new THREE.Group();
            pivot.position.set(p.widthMM * MM, 42 * MM, 40 * MM);
            pivot.userData.isSideWall = true;
            pivot.add(sw);
            group.add(pivot);
          } catch (e) { console.warn('[CabinetBuilder] Side wall GLB not found:', swGlb); }
        }
      }
    }

    /* ── Lift assembly so feet sit on y = 0 ── */
    group.position.y = ASSEMBLY_LIFT * MM;

    return group;
  }

  /* ══════════════════════════════════════════════════
     PLACEHOLDER C-FRAME
     Used when the GLB file is not yet available.
     Approximates a C-profile using 3 boxes.
  ════════════════════════════════════════════════════ */
  function _makePlaceholderFrame(heightU, cl) {
    const H      = heightU * 44.45 * MM;   // total height in THREE units
    const W      = 60  * MM;               // frame width  (60 mm)
    const D      = 600 * MM;               // frame depth (600 mm)
    const T      = 30  * MM;               // wall thickness (30 mm)

    const color  = _clToHex(cl);
    const mat    = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0.35,
    });

    const g = new THREE.Group();

    // Top horizontal bar
    const top = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), mat);
    top.position.set(0, H - T / 2, 0);

    // Bottom horizontal bar
    const bot = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), mat);
    bot.position.set(0, T / 2, 0);

    // Vertical back post connecting top & bottom
    const vert = new THREE.Mesh(new THREE.BoxGeometry(W, H - T * 2, T), mat);
    vert.position.set(0, H / 2, -(D / 2 - T / 2));

    [top, bot, vert].forEach(m => { m.castShadow = true; m.receiveShadow = true; });
    g.add(top, bot, vert);
    return g;
  }

  /* ══════════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════════════ */

  /**
   * Shifts a loaded GLB group so its bounding-box bottom-centre
   * lands at the group's local origin (0, 0, 0).
   * Call BEFORE setting the group's world position.
   */
  function _clToHex(cl) {
    return { GY: 0xaaaaaa, BK: 0x2a2a2a, RD: 0xe53935, WH: 0xf0f0f0 }[cl] ?? 0x888888;
  }

  function _deepClone(source) {
    const clone = source.clone();
    // Give each mesh its own material copy so dispose() on one
    // clone doesn't destroy the cached original's materials
    clone.traverse(obj => {
      if (obj.isMesh) {
        obj.material = Array.isArray(obj.material)
          ? obj.material.map(m => m.clone())
          : obj.material.clone();
      }
    });
    return clone;
  }

  async function _loadGLB(path) {
    if (_cache[path]) return _deepClone(_cache[path]);
    const LoaderClass = THREE.GLTFLoader || window.GLTFLoader;
    if (!LoaderClass) throw new Error('GLTFLoader not loaded');
    return new Promise((resolve, reject) => {
      new LoaderClass().load(
        path,
        gltf => {
          const scene = gltf.scene;
          // Enable shadows on all meshes
          scene.traverse(obj => {
            if (obj.isMesh) {
              obj.castShadow    = true;
              obj.receiveShadow = true;
            }
          });
          // Reset any baked-in transforms from the GLB exporter
          scene.position.set(0, 0, 0);
          scene.rotation.set(0, 0, 0);
          scene.scale.set(1, 1, 1);
          _cache[path] = scene;
          resolve(_deepClone(scene));
        },
        xhr => {
          if (xhr.total) console.log('[CabinetBuilder] Loading', path,
            Math.round(xhr.loaded / xhr.total * 100) + '%');
        },
        err => reject(new Error('GLB load failed: ' + path + (err ? ' — ' + err.message : '')))
      );
    });
  }

  function _disposeGroup(group) {
    group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        (Array.isArray(obj.material) ? obj.material : [obj.material])
          .forEach(m => m.dispose());
      }
    });
  }

  function _collectMats(group) {
    const mats = [];
    group.traverse(obj => {
      if (obj.isMesh) {
        (Array.isArray(obj.material) ? obj.material : [obj.material])
          .forEach(m => mats.push(m));
      }
    });
    return mats;
  }

  function _fadeOutAndDispose(group) {
    const mats  = _collectMats(group);
    mats.forEach(m => { m.transparent = true; m.needsUpdate = true; });
    const start = performance.now();
    (function tick(now) {
      const t = Math.min((now - start) / FADE_MS, 1);
      mats.forEach(m => m.opacity = 1 - t);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        Cabinet.scene.remove(group);
        _disposeGroup(group);
      }
    })(performance.now());
  }

  function _fadeIn(group) {
    const mats  = _collectMats(group);
    // Save original transparent state to restore correctly after fade
    const origTransparent = mats.map(m => m.transparent);
    mats.forEach(m => { m.transparent = true; m.opacity = 0; m.needsUpdate = true; });
    const start = performance.now();
    (function tick(now) {
      const t = Math.min((now - start) / FADE_MS, 1);
      mats.forEach(m => m.opacity = t);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        // Restore original transparent state
        mats.forEach((m, i) => {
          m.transparent = origTransparent[i];
          m.opacity     = 1;
          m.needsUpdate = true;
        });
      }
    })(performance.now());
  }

  function _fitCamera(group) {
    if (!window.CabinetControls) return;
    const box    = new THREE.Box3().setFromObject(group);
    const size   = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    // Always orbit around the assembly centre; keep current zoom if already set
    const currentRadius = CabinetControls.getRadius();
    const maxDim = Math.max(size.x, size.y, size.z);
    const defaultDist = maxDim * 2.0;
    const dist = currentRadius > 0.31 ? currentRadius : defaultDist;
    CabinetControls.setTarget(centre);
    CabinetControls.setView(Math.PI / 5, Math.PI / 3.8, dist);
  }

  function _status(msg) {
    const overlay = document.getElementById('buildStatus');
    const textEl  = document.getElementById('buildStatusText');
    if (!overlay) return;
    if (textEl) textEl.textContent = msg;
    overlay.style.display = msg ? 'flex' : 'none';
  }

  async function buildInto(code, scene) {
    const p = _parse(code);
    if (!p) return null;
    const group = await _assemble(p);
    scene.add(group);
    return group;
  }

  // Valid attachment point labels per accessory type
  const _ACC_SNAP_PTS = {
    'EZR_MDL-L87-NT':  ['A1','A2','A3','A4','A5','B1','B2','B3','B4','B5','C1','C2','C3','C4','C5'],
    'EZR_MDL-L224-NT': ['A1','A2','A3','A4','A5','B1','B2','B3','B4','B5','C1','C2','C3','C4','C5'],
    'EZR_CBFX':        ['A2','A3','A4','A5','A6','B2','B3','B4','B5','B6','C2','C3','C4','C5','C6', 'ret-L', 'ret-R'],
    'EZR_RET':         ['ret-L','ret-R'],
    'EZR_ROUT-BRKT':        ['A5','B5','C5'],
    'EZR_SEP_PLT-4U':       ['A5','B5','C5'],
    'EZR_SEP_PLT-4U-horiz': ['B6'],
  };

  /* Returns array of { id, label, position:THREE.Vector3 } for every valid
     snap point on the built cabinet for the given accessory type. */
  function getSnapPoints(code, accType, xOffset = 0) {
    const p = _parse(code);
    if (!p) return [];
    const labels = _ACC_SNAP_PTS[accType];
    if (!labels) return [];
    const out = [];

    function _collect(de, cabOffsetX) {
      const frDe = DE_FR_BASE[de] || de;
      const cols = MOUNT_PLT_X[frDe];
      if (!cols) return;
      const nPlates = MOUNT_PLT_COUNT[p.heightU];
      if (!nPlates) return;
      cols.forEach((xMM, ci) => {
        for (let pi = 0; pi < nPlates; pi++) {
          const yMM = PLATE_Y_START + pi * PLATE_4U_H;
          labels.forEach(lbl => {
            const pt = MOUT_PLT_ATTACH_PTS[lbl];
            if (!pt) return;
            out.push({
              id: `${de}-c${ci}-p${pi}-${lbl}`, label: lbl,
              position: new THREE.Vector3(
                (xOffset + cabOffsetX + xMM + pt.x) * MM,
                (ASSEMBLY_LIFT + yMM + pt.y) * MM,
                (PLATE_Z_MM + pt.z) * MM),
            });
          });
        }
      });
    }

    if (p.de === '15DAS') {
      _collect('06LR0', 0);
      _collect('09DAR', 600);
    } else {
      _collect(p.de, 0);
    }
    return out;
  }

  return { build, clearAssembly, clearAll, lockAssembly, parseCode: _parse, buildInto, getSnapPoints, getAssembly: () => _assembly };

})();
