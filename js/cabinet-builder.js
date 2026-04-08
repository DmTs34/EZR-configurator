/**
 * cabinet-builder.js
 * Core 3D cabinet assembly engine using Three.js
 *
 * Assembles complete cabinet models from GLB components based on description codes.
 * Manages model caching, scene transforms, attachment points for accessories,
 * and visual feedback (highlights, labels, animations).
 *
 * Architecture:
 *   - Code → Parse → Assembly → Row Transform → Scene
 *   - Snap points calculated independently for drag-and-drop system
 *
 * Cabinet dimensions:
 *   - Width: 300–1200mm (determined by DE code)
 *   - Height: Multiple U heights (18U–50U)
 *   - Depth: 300mm (physical + 150mm for door swing)
 *   - Scale: 1 mm = 0.001 THREE.js units (SimLab convention)
 */

window.CabinetBuilder = (function () {
  'use strict';

  /* ══════════════════════════════════════════════════
     CONFIGURATION & CONSTANTS
     All data structures that drive assembly logic.
  ════════════════════════════════════════════════════ */

  const COMP_ROOT = 'components/';  // Base path for all GLB files
  const MM = 0.001;                 // Millimeter to THREE.js unit scale

  // ─────────────────────────────────────────────────
  // Frame & Profile Configuration
  // ─────────────────────────────────────────────────

  /** Distance between two C-shaped frames (mm) by cabinet width.
      e.g., 300mm cabinet → frames 260mm apart */
  const FRAME_SPACING = {
    300:   260,
    600:   560,
    900:   860,
    1200: 1160,
  };

  /** Horizontal profile GLB filenames by cabinet width (mm).
      Positioned at bottom and top of cabinet. */
  const PROFILE_GLB = {
    300:  'EZR_PROF-L220-NT.glb',
    600:  'EZR_PROF-L520-NT.glb',
    900:  'EZR_PROF-L820-NT.glb',
    1200: 'EZR_PROF-L1120-NT.glb',
  };

  /** Y position of top horizontal profile (mm) keyed by cabinet height.
      Bottom profile always at y=0. */
  const PROFILE_TOP_Y = {
    50: 2310,   // 2130 + 180
    46: 2130,
    42: 1950,   // 2130 - 180
    38: 1770,   // 2130 - 360
    22: 1050,
    18:  870,   // 1050 - 180
  };

  /** X offset from cabinet origin for all horizontal profiles (mm) */
  const PROFILE_X_MM = 40;

  /** Vertical profile GLB filenames by cabinet height (U).
      Positioned at sides of cabinet for wide designs. */
  const VERT_PROF_GLB = {
    50: 'EZR_PROF-L2270-NT.glb',
    46: 'EZR_PROF-L2090-NT.glb',
    42: 'EZR_PROF-L1910-NT.glb',
    38: 'EZR_PROF-L1730-NT.glb',
    22: 'EZR_PROF-L1010-NT.glb',
    18: 'EZR_PROF-L830-NT.glb',
  };

  /** X offsets of vertical profiles (mm) per cabinet design code.
      Only wide designs (06, 09, 12) have vertical profiles. */
  const VERT_PROF_X = {
    '06000': [260, 300],
    '09L00': [600],
    '090R0': [260],
    '12LR0': [260, 900],
  };

  // ─────────────────────────────────────────────────
  // Mounting Plate Configuration
  // ─────────────────────────────────────────────────

  /** Height of one 4U mounting plate (mm) = 4 × 44.45mm RU standard */
  const PLATE_4U_H = 177.8;

  /** Y offset from cabinet bottom to first mounting plate (mm) */
  const PLATE_Y_START = 40;

  /** Forward offset (Z axis) for all mounting plates (mm) */
  const PLATE_Z_MM = 42;

  /** Vertical lift of entire assembly so feet rest on y=0 (mm) */
  const ASSEMBLY_LIFT = 14;

  /** Depth offset of entire assembly along Z-axis to avoid rear wall collisions (mm) */
  const ASSEMBLY_DEPTH_OFFSET = 10;

  /** Number of 4U mounting plates per cabinet height.
      Plus one 2U cap plate always added at the top. */
  const MOUNT_PLT_COUNT = {
    50: 12, 46: 11, 42: 10, 38: 9, 22: 5, 18: 4,
  };

  /** Starting X positions (mm) of mounting plate columns per design.
      Multiple entries = multiple columns. */
  const MOUNT_PLT_X = {
    '03000': [7.5],
    '06000': [7.5, 307.5],
    '09L00': [607.5],
    '090R0': [7.5],
    '12LR0': [7.5, 907.5],
  };

  /** Vertical offset applied to first mounting plate Y position (mm).
      Ensures proper spacing between foot and first plate. */
  const MOUT_PLT_OFFSET_Y = {
    '50U': 22.1,
    '46U': 22.1,
    '42U': 22.1,
    '38U': 22.1,
    '22U': 22.1,
    '18U': 22.1,
  };

  /** Attachment point coordinates local to each mounting plate (mm).
      Used for positioning accessories on plates. */
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
    'ret-L':     { x:  12.6, y: 60.0, z: 1.5 },
    'ret-R':     { x: 272.3, y: 60.0, z: 1.5 },
    'cab-ext-L': { x:  70.4, y: 102.5, z: 1.5 },
    'cab-ext-M': { x: 142.7, y: 102.5, z: 1.5 },
    'cab-ext-R': { x: 215.0, y: 102.5, z: 1.5 },
    'B6-53': { x:  89.5, y:  22.2, z: 1.5 },  // B6 shifted left by 53mm (for horiz plates)
    'B6+53': { x: 195.5, y:  22.2, z: 1.5 },  // B6 shifted right by 53mm (for horiz plates)
  };

  /** Accessory designs mapped to plate attachment points.
      Key = design name (e.g., 'AL', 'BL1'), Value = array of components.
      Components: { glb: filename, pt: attachment point, rotZ?: radians, offsetY?: mm } */
  const PLATE_DESIGNS = {
    // STL-series designs
    'AL': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'C1', rotZ: Math.PI },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'A3' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'A4', rotZ: Math.PI },
    ],
    'AR': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'A1', rotZ: Math.PI },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'C3' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'C4', rotZ: Math.PI },
    ],
    'BL1': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B3' },
      { glb: 'EZR_SEP_PLT-4U-R.glb', pt: 'C5' },
    ],
    'BR1': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B3' },
      { glb: 'EZR_SEP_PLT-4U.glb', pt: 'A5' },
    ],
    'BL2': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B6' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B3' },
      { glb: 'EZR_SEP_PLT-4U-R.glb', pt: 'C5' },
    ],
    'BR2': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B6' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B3' },
      { glb: 'EZR_SEP_PLT-4U.glb', pt: 'A5' },
    ],
    'CL': [
      { glb: 'EZR_SEP_PLT-4U-R.glb', pt: 'C5' },
    ],
    'CR': [
      { glb: 'EZR_SEP_PLT-4U.glb', pt: 'A5' },
    ],
    'DL': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'C1', rotZ: Math.PI },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'A3' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'A4', rotZ: Math.PI },
      { glb: 'EZR_SEP_PLT-4U-horiz.glb', pt: 'B6+53' },
    ],
    'DR': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'A1', rotZ: Math.PI },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'C3' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'C4', rotZ: Math.PI },
      { glb: 'EZR_SEP_PLT-4U-horiz.glb', pt: 'B6-53' },
    ],
    'GM': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B1' },
      { glb: 'EZR_MDL-L87-NT.glb', pt: 'A5', rotZ: Math.PI },
      { glb: 'EZR_MDL-L87-NT.glb', pt: 'C5', rotZ: Math.PI },
    ],
    'HM': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B1' },
      { glb: 'EZR_MDL-L87-NT.glb', pt: 'A2' },
      { glb: 'EZR_MDL-L87-NT.glb', pt: 'C2' },
      { glb: 'EZR_MDL-L87-NT.glb', pt: 'A5', rotZ: Math.PI },
      { glb: 'EZR_MDL-L87-NT.glb', pt: 'C5', rotZ: Math.PI },
    ],
    'KM': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B1', rotZ: Math.PI },
    ],
    'LL': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'A1', rotZ: Math.PI },
    ],
    'LR': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'C1', rotZ: Math.PI },
    ],
    'ML': [
      { glb: 'EZR_SEP_PLT-4U.glb', pt: 'A5' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B5' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B2' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'C5', rotZ: Math.PI },
    ],
    'MR': [
      { glb: 'EZR_SEP_PLT-4U-R.glb', pt: 'C5' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B5' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B2' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'A5', rotZ: Math.PI },
    ],
    'NL': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'A1' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'C5', rotZ: Math.PI },
    ],
    'NR': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'C1' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'A5', rotZ: Math.PI },
    ],
    'OL': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'C5' },
    ],
    'OR': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'A5' },
    ],
    'PM': [
      { glb: 'EZR_CAB_EXT.glb', pt: 'cab-ext-M' },
    ],
    // IFA-series designs
    'EL': [
      { glb: 'EZR_SEP_PLT-4U.glb', pt: 'A5' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B2' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B5', rotZ: Math.PI },
      { glb: 'EZR_MDL-L87-NT.glb', pt: 'C5', rotZ: Math.PI },
      { glb: 'EZR_RET.glb', pt: 'ret-L' },
    ],
    'ER': [
      { glb: 'EZR_SEP_PLT-4U-R.glb', pt: 'C5' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B2' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B5', rotZ: Math.PI },
      { glb: 'EZR_MDL-L87-NT.glb', pt: 'A5', rotZ: Math.PI },
      { glb: 'EZR_RET.glb', pt: 'ret-R' },
    ],
    'FL': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'A1', rotZ: Math.PI },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B2' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B5', rotZ: Math.PI },
      { glb: 'EZR_MDL-L87-NT.glb', pt: 'C5', rotZ: Math.PI },
    ],
    'FR': [
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'C1', rotZ: Math.PI },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B2' },
      { glb: 'EZR_MDL-L224-NT.glb', pt: 'B5', rotZ: Math.PI },
      { glb: 'EZR_MDL-L87-NT.glb', pt: 'A5', rotZ: Math.PI },
    ],
  };

  /** Accessory layout per mounting plate for each cabinet design.
      Keyed by: design code → height → [ design names per plate, or [ [col0], [col1] ] ]
      Index 0 = bottom plate. null = no accessories. */
  const PLATE_DESIGN_ROWS = {
    '03TLT': {
      50: ['LL','ML','ML','NL','ML','ML','NL','ML','ML','OL', null, 'PM'],
      46: ['LL','ML','ML','NL','ML','ML','NL','ML','ML','OL', 'PM'],
      42: ['LL','ML','ML','NL','ML','ML','NL','ML','OL', 'PM'],
      38: ['LL','ML','ML','ML','NL','ML','ML','OL', 'PM'],
      22: ['LL','ML','ML','OL', 'PM'],
      18: ['LL','ML','OL', 'PM'],
    },
    '03TRT': {
      50: ['LR','MR','MR','NR','MR','MR','NR','MR','MR','OR', null, 'PM'],
      46: ['LR','MR','MR','NR','MR','MR','NR','MR','MR','OR', 'PM'],
      42: ['LR','MR','MR','NR','MR','MR','NR','MR','OR', 'PM'],
      38: ['LR','MR','MR','MR','NR','MR','MR','OR', 'PM'],
      22: ['LR','MR','MR','OR', 'PM'],
      18: ['LR','MR','OR', 'PM'],
    },
    '09STL': {
      50: ['AR','BR1','BR2','BR2','BR2','DR','BR1','BR2','BR2','BR2','CR', null],
      46: ['AR','BR1','BR2','BR2','BR2','DR','BR1','BR2','BR2','BR2','CR'],
      42: ['AR','BR1','BR2','BR2','BR2','DR','BR1','BR2','BR2','BR2'],
      38: ['AR','BR1','BR2','BR2','DR','BR1','BR2','BR2','CR'],
      22: ['AR','BR1','BR2','BR2','BR2'],
      18: ['AR','BR1','BR2','BR2'],
    },
    '09STR': {
      50: ['AL','BL1','BL2','BL2','BL2','DL','BL1','BL2','BL2','BL2','CL', null],
      46: ['AL','BL1','BL2','BL2','BL2','DL','BL1','BL2','BL2','BL2','CL'],
      42: ['AL','BL1','BL2','BL2','BL2','DL','BL1','BL2','BL2','BL2'],
      38: ['AL','BL1','BL2','BL2','DL','BL1','BL2','BL2','CL'],
      22: ['AL','BL1','BL2','BL2', 'BL2'],
      18: ['AL','BL1','BL2','BL2'],
    },
    '09DAR': {
      50: ['KM','HM','GM','GM','GM','GM','GM','GM','GM','GM','GM', null],
      46: ['KM','HM','GM','GM','GM','GM','GM','GM','GM','GM','GM'],
      42: ['KM','HM','GM','GM','GM','GM','GM','GM','GM','GM'],
      38: ['KM','HM','GM','GM','GM','GM','GM','GM','GM'],
      22: ['KM','HM','GM','GM','GM'],
      18: ['KM','HM','GM','GM'],
    },
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

  // ─────────────────────────────────────────────────
  // Door & Accessory Configuration
  // ─────────────────────────────────────────────────

  /** Door dimensions (mm) for each design. Only applies to EZR_CL (closed).
      null = no door on that side. */
  const DOOR_CONFIG = {
    '03000': { left: 300,  right: null },
    '03TLT': { left: 300,  right: null },
    '03TRT': { left: null, right: 300 },
    '06000': { left: 600,  right: null },
    '06LR0': { left: 600,  right: null },
    '09L00': { left: 600,  right: 300 },
    '090R0': { left: 300,  right: 600 },
    '09STL': { left: 600,  right: 300 },
    '09STR': { left: 300,  right: 600 },
    '09DAR': { left: 300,  right: 600 },
    '12LR0': { left: 600,  right: 600 },
    '12IFA': { left: 600,  right: 600 },
    '12STM': { left: 600,  right: 600 },
    '15DAS': { left: 600, middle: 300, right: 600 },
  };

  /** Forward offset for all doors (Z axis, mm) */
  const DOOR_Z_MM = 300;

  /** Mounting rail X offset per design code (mm).
      null = no rails for this design. */
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

  /** Maps EZR_OP (open frame) design codes to their FR (frame) base design.
      Used to reference plate positions for open cabinets. */
  const DE_FR_BASE = {
    '03TLT': '03000',
    '03TRT': '03000',
    '09STL': '09L00',
    '09STR': '090R0',
    '09DAR': '090R0',
    '12IFA': '12LR0',
    '12STM': '12LR0',
  };

  // ─────────────────────────────────────────────────
  // Scene Rendering Constants
  // ─────────────────────────────────────────────────

  /** Duration of fade in/out animations (ms) */
  const FADE_MS = 270;

  /** Visual depth of cabinet highlight overlay (mm).
      Extends beyond physical cabinet to cover door swing. */
  const CABINET_DEPTH_MM = 450;

  /* ══════════════════════════════════════════════════
     STATE MANAGEMENT
     Runtime variables tracking scene objects and caches.
  ════════════════════════════════════════════════════ */

  const _cache = {};              // Cache: GLB path → cloned THREE.Group
  let _assembly = null;           // Current cabinet (in edit mode)
  let _lockedAssemblies = [];     // Locked cabinets (confirmed, in scene)

  let _highlightMesh = null;      // Active cabinet highlight surface
  let _highlightLabel = null;     // Active cabinet label element

  const _lockedHighlights = [];   // Highlight meshes for locked cabinets
  const _labelAnchors = [];       // Label anchors for all cabinets
  let _labelContainer = null;     // DOM container for label overlays

  /* ══════════════════════════════════════════════════
     CODE PARSING & VALIDATION
  ════════════════════════════════════════════════════ */

  /**
   * Parses a cabinet description code into structured components.
   * Format: PR-HE-DE-COV-AS-CL
   *
   * @param {string} code - Cabinet code, e.g., 'EZR_CL-46-06000-111111T1S0-00-BK'
   * @returns {object|null} Parsed components: { pr, he, de, cov, as, cl, heightU, widthMM }
   *                        or null if invalid
   */
  function _parse(code) {
    const parts = code.split('-');
    if (parts.length < 6) return null;
    const [pr, he, de, cov, as_, cl] = parts;
    const heightU = parseInt(he);
    const widthMM = parseInt(de.slice(0, 2)) * 100;  // First 2 digits of DE → mm
    if (isNaN(heightU) || isNaN(widthMM)) return null;

    // Parse covering: D[LD][MD][RD]B[BW]S[SW]T[TC]
    // Fixed positions to avoid matching 'B' in door codes (e.g., DB00B1S11T1)
    const bw = cov.length > 5 ? cov[5] : '0';
    const sw = cov.length > 8 ? cov.slice(7, 9) : '00';
    const tc = cov.length > 10 ? cov[10] : '0';

    return { pr, he, de, cov, as: as_, cl, heightU, widthMM, bw, sw, tc };
  }

  /* ══════════════════════════════════════════════════
     RESOURCE LOADING & CLEANUP
     GLB loading with caching, disposal of Three.js resources.
  ════════════════════════════════════════════════════ */

  /**
   * Loads a GLB file via GLTFLoader, caches it, and returns a deep clone.
   * Each call returns a fresh clone with independent materials to prevent
   * disposal conflicts across multiple cabinet instances.
   *
   * @async
   * @param {string} path - GLB file path relative to COMP_ROOT
   * @returns {Promise<THREE.Group>} Cloned scene group
   * @throws {Error} If file not found or loader unavailable
   */
  async function _loadGLB(path) {
    if (_cache[path]) return _deepClone(_cache[path]);
    const LoaderClass = THREE.GLTFLoader || window.GLTFLoader;
    if (!LoaderClass) throw new Error('GLTFLoader not loaded');
    return new Promise((resolve, reject) => {
      new LoaderClass().load(
        path,
        gltf => {
          const scene = gltf.scene;
          // Enable shadows for all meshes
          scene.traverse(obj => {
            if (obj.isMesh) {
              obj.castShadow = true;
              obj.receiveShadow = true;
            }
          });
          // Reset any baked transforms from GLB exporter
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

  /**
   * Creates independent material clones for a Three.js object hierarchy.
   * Prevents disposal of shared cached materials when disposing one cabinet.
   *
   * @param {THREE.Group} source - Source group to clone
   * @returns {THREE.Group} Cloned group with independent materials
   */
  function _deepClone(source) {
    const clone = source.clone();
    clone.traverse(obj => {
      if (obj.isMesh) {
        obj.material = Array.isArray(obj.material)
          ? obj.material.map(m => m.clone())
          : obj.material.clone();
      }
    });
    return clone;
  }

  /**
   * Releases all Three.js resources (geometries, materials) from a group.
   * Must be called before removing a cabinet from scene to prevent memory leak.
   *
   * @param {THREE.Group} group - Cabinet assembly to dispose
   */
  function _disposeGroup(group) {
    group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        (Array.isArray(obj.material) ? obj.material : [obj.material])
          .forEach(m => m.dispose());
      }
    });
  }

  /**
   * Collects all materials from a group hierarchy.
   * Used to apply uniform fading animations.
   *
   * @param {THREE.Group} group - Cabinet assembly
   * @returns {Array<THREE.Material>} Flat array of all materials
   */
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

  /* ══════════════════════════════════════════════════
     SCENE TRANSFORMS & ROW MANAGEMENT
     Positioning cabinets in rows with rotation and flipping.
  ════════════════════════════════════════════════════ */

  /**
   * Fetches row configuration by index from Cabinet state.
   * Defaults to row 0 if index not provided or row doesn't exist.
   *
   * @param {number|null} rowIdx - Row index, or null for active/default
   * @returns {object} Row config: { origin: {x, z}, angle, flipped? }
   */
  function _getRow(rowIdx) {
    const idx = rowIdx ?? Cabinet.activeRowIdx ?? 0;
    return Cabinet.rows?.[idx] ?? { origin: { x: 0, z: 0 }, angle: 0 };
  }

  /**
   * Calculates Y rotation (radians) for a row accounting for angle and flip.
   * angle=0 → cabinet grows along +X
   * angle=1 → cabinet grows along -Z
   * flipped → cabinet faces opposite direction (+π)
   *
   * @param {number|null} rowIdx - Row index
   * @returns {number} Rotation in radians
   */
  function _rowRotY(rowIdx) {
    const row = _getRow(rowIdx);
    const base = row.angle * (Math.PI / 2);
    return row.flipped ? base + Math.PI : base;
  }

  /**
   * Converts local cabinet position to world space accounting for row origin,
   * angle, flip, and width. Ensures flipped cabinets maintain correct placement
   * and depth footprint in grid layouts.
   *
   * @param {number} xOffsetMM - X position within row (mm)
   * @param {number|null} rowIdx - Row index
   * @param {number} widthMM - Cabinet width for flip compensation (mm)
   * @returns {object} World position: { x, z } in THREE.js units
   */
  function _rowWorldPos(xOffsetMM, rowIdx, widthMM) {
    const row = _getRow(rowIdx);
    const ox = row.origin.x * MM;
    const oz = row.origin.z * MM;
    const d = xOffsetMM * MM;
    // When flipped, rotY=π reverses local +X → cabinet drifts left by width.
    // Compensate by shifting +widthMM along row axis + 300mm along depth.
    const DEPTH_MM = 300;
    const flipShift = (row.flipped && widthMM) ? widthMM * MM : 0;
    const depthShift = row.flipped ? DEPTH_MM * MM : 0;
    if (row.angle === 0) return { x: ox + d + flipShift, z: oz + depthShift };
    return { x: ox + depthShift, z: oz - d - flipShift };
  }

  /**
   * Applies row transform (position + rotation) to an object.
   *
   * @param {THREE.Group} obj - Cabinet assembly or other object
   * @param {number} xOffsetMM - X position within row (mm)
   * @param {number|null} rowIdx - Row index
   * @param {number} widthMM - Cabinet width (mm)
   */
  function _applyRowTransform(obj, xOffsetMM, rowIdx, widthMM) {
    const { x, z } = _rowWorldPos(xOffsetMM, rowIdx, widthMM);
    obj.position.x = x;
    obj.position.z = z;
    obj.rotation.y = _rowRotY(rowIdx);
  }

  /* ══════════════════════════════════════════════════
     ANIMATIONS
     Fade in/out effects for smooth cabinet transitions.
  ════════════════════════════════════════════════════ */

  /**
   * Fades out a cabinet group then disposes it.
   * Uses requestAnimationFrame for smooth animation.
   *
   * @param {THREE.Group} group - Cabinet to fade and remove
   */
  function _fadeOutAndDispose(group) {
    const mats = _collectMats(group);
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

  /**
   * Fades in a newly added cabinet group.
   * Restores original transparent state after animation completes.
   *
   * @param {THREE.Group} group - Cabinet to fade in
   */
  function _fadeIn(group) {
    const mats = _collectMats(group);
    const origTransparent = mats.map(m => m.transparent);
    mats.forEach(m => { m.transparent = true; m.opacity = 0; m.needsUpdate = true; });
    const start = performance.now();
    (function tick(now) {
      const t = Math.min((now - start) / FADE_MS, 1);
      mats.forEach(m => m.opacity = t);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        mats.forEach((m, i) => {
          m.transparent = origTransparent[i];
          m.opacity = 1;
          m.needsUpdate = true;
        });
      }
    })(performance.now());
  }

  /* ══════════════════════════════════════════════════
     HIGHLIGHTS & LABELS
     Visual feedback for active and locked cabinets.
  ════════════════════════════════════════════════════ */

  /**
   * Creates or updates the label DOM container for cabinet overlays.
   * Positioned absolutely over the canvas.
   */
  function _ensureLabelContainer() {
    if (_labelContainer) return;
    _labelContainer = document.createElement('div');
    _labelContainer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
    const canvas = Cabinet.renderer?.domElement || document.querySelector('canvas');
    if (canvas?.parentElement) canvas.parentElement.style.position = 'relative';
    canvas?.parentElement?.appendChild(_labelContainer);
  }

  /**
   * Creates a clickable label element for a cabinet.
   * Dispatches event to main UI for context menu.
   *
   * @param {string} text - Label text to display
   * @param {number} cabinetIdx - Cabinet index in state
   * @returns {HTMLElement} Label element
   */
  function _makeLabelEl(text, cabinetIdx) {
    _ensureLabelContainer();
    const el = document.createElement('div');
    el.dataset.cabinetIdx = cabinetIdx;
    el.style.cssText = [
      'position:absolute', 'pointer-events:auto', 'cursor:pointer',
      'transform:translate(-50%,-50%)',
      'font:600 13px "Mont",sans-serif', 'color:#1a1a1a',
      'white-space:nowrap', 'user-select:none',
    ].join(';');
    el.textContent = text;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('cabinetLabelContextMenu', {
        detail: { cabinetIdx, x: e.clientX, y: e.clientY }
      }));
    });
    _labelContainer.appendChild(el);
    return el;
  }

  /**
   * Removes a label element and its anchor.
   *
   * @param {number} cabinetIdx - Cabinet index to remove label for
   */
  function _removeLabelEl(cabinetIdx) {
    const i = _labelAnchors.findIndex(a => a.cabinetIdx === cabinetIdx);
    if (i < 0) return;
    _labelAnchors[i].el.remove();
    _labelAnchors.splice(i, 1);
  }

  /**
   * Displays a highlight surface under the active cabinet.
   * Shows cabinet label with context menu capability.
   *
   * @param {THREE.Group} group - Active cabinet assembly
   * @param {number} widthMM - Cabinet width (mm)
   * @param {number|null} rowIdx - Row index
   */
  function _showHighlight(group, widthMM, rowIdx) {
    _clearHighlight();
    const row = _getRow(rowIdx);
    const rowAngle = row.angle;
    const flipped = !!row.flipped;
    const W = widthMM * MM * 1.1;
    const D = CABINET_DEPTH_MM * MM * 1.1;
    const halfD = CABINET_DEPTH_MM * MM / 2;

    const gx = group.position.x;
    const gz = group.position.z;
    let cx, cz, anchor;

    if (rowAngle === 0) {
      const halfW = (widthMM * MM) / 2;
      cx = flipped ? gx - halfW : gx + halfW;
      cz = flipped ? gz - halfD : gz + halfD;
      anchor = new THREE.Vector3(cx, 0.002, flipped ? gz - D + (50 * MM) : gz + D - (50 * MM));
    } else {
      const halfW = (widthMM * MM) / 2;
      cz = flipped ? gz + halfW : gz - halfW;
      cx = flipped ? gx - halfD : gx + halfD;
      anchor = new THREE.Vector3(flipped ? gx - D + (50 * MM) : gx + D - (50 * MM), 0.002, cz);
    }

    const geo = new THREE.PlaneGeometry(W, D);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(0x65b8a5) } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 uColor;
        void main() {
          float dx = min(vUv.x, 1.0 - vUv.x) * 2.0;
          float dy = min(vUv.y, 1.0 - vUv.y) * 2.0;
          float edge = min(dx, dy);
          float alpha = smoothstep(0.0, 0.35, edge) * 0.45;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });

    _highlightMesh = new THREE.Mesh(geo, mat);
    _highlightMesh.rotation.x = -Math.PI / 2;
    if (rowAngle === 1) _highlightMesh.rotation.z = -Math.PI / 2;
    _highlightMesh.position.set(cx, 0.002, cz);
    _highlightMesh.renderOrder = 1;
    Cabinet.scene.add(_highlightMesh);

    const labelIdx = (Cabinet.editingIdx >= 0) ? Cabinet.editingIdx : (Cabinet.cabinets ? Cabinet.cabinets.length - 1 : 0);
    const labelText = Cabinet.cabinets?.[labelIdx]?.label || `ODF #${labelIdx + 1}`;
    _highlightLabel = _makeLabelEl(labelText, labelIdx);
    _labelAnchors.push({ el: _highlightLabel, anchor, cabinetIdx: labelIdx });
  }

  /**
   * Removes the highlight surface and label for the active cabinet.
   */
  function _clearHighlight() {
    if (_highlightMesh) {
      Cabinet.scene.remove(_highlightMesh);
      _highlightMesh.geometry.dispose();
      _highlightMesh.material.dispose();
      _highlightMesh = null;
    }
    if (_highlightLabel) {
      const labelIdx = parseInt(_highlightLabel.dataset.cabinetIdx ?? '-1');
      _removeLabelEl(labelIdx);
      _highlightLabel = null;
    }
  }

  /**
   * Updates the text content of a cabinet label.
   *
   * @param {number} cabinetIdx - Cabinet index
   * @param {string} text - New label text
   */
  function updateLabel(cabinetIdx, text) {
    const entry = _labelAnchors.find(a => a.cabinetIdx === cabinetIdx);
    if (entry) entry.el.textContent = text;
  }

  /**
   * Projects all label anchor points from 3D to 2D screen space and updates DOM.
   * Called each frame to keep labels aligned with 3D cabinets.
   */
  function updateLabelOverlays() {
    if (!_labelAnchors.length || !Cabinet.camera) return;
    const canvas = Cabinet.renderer?.domElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    for (const { el, anchor } of _labelAnchors) {
      const v = anchor.clone().project(Cabinet.camera);
      const x = (v.x + 1) / 2 * rect.width;
      const y = (-v.y + 1) / 2 * rect.height;
      el.style.display = (v.z > 1) ? 'none' : 'block';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
    }
  }

  /**
   * Displays a persistent highlight surface under a locked cabinet.
   * Locked cabinets show with lower opacity highlight and persist in scene.
   *
   * @param {number} xOffset - X position within row (mm)
   * @param {number} widthMM - Cabinet width (mm)
   * @param {number} cabinetIdx - Cabinet index in state
   * @param {number|null} rowIdx - Row index
   * @param {string|null} label - Optional label text
   */
  function showLockedHighlight(xOffset, widthMM, cabinetIdx, rowIdx, label) {
    const W = widthMM * MM * 1.1;
    const D = CABINET_DEPTH_MM * MM * 1.1;
    const halfD = CABINET_DEPTH_MM * MM / 2;

    const geo = new THREE.PlaneGeometry(W, D);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(0x9c6b5f) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vUv; uniform vec3 uColor;
        void main(){
          float dx=min(vUv.x,1.0-vUv.x)*2.0; float dy=min(vUv.y,1.0-vUv.y)*2.0;
          float edge=min(dx,dy);
          float alpha=smoothstep(0.0,0.35,edge)*0.18;
          gl_FragColor=vec4(uColor,alpha);
        }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 1;
    mesh.userData.isHighlightMat = true;
    mesh.userData.cabinetIdx = cabinetIdx;
    mesh.userData.xOffsetMM = xOffset;
    mesh.userData.widthMM = widthMM;

    const row = _getRow(rowIdx);
    const rowAngle = row.angle;
    const flipped = !!row.flipped;
    const { x: rx0, z: rz0 } = _rowWorldPos(xOffset, rowIdx, widthMM);
    const halfW = widthMM * MM / 2;
    const rx = row.angle === 0 ? (flipped ? rx0 - halfW : rx0 + halfW) : rx0;
    const rz = row.angle === 0 ? rz0 : (flipped ? rz0 + halfW : rz0 - halfW);

    if (rowAngle === 0) {
      mesh.position.set(rx, 0.001, flipped ? rz - halfD : rz + halfD);
    } else {
      mesh.rotation.z = -Math.PI / 2;
      mesh.position.set(flipped ? rx - halfD : rx + halfD, 0.001, rz);
    }
    Cabinet.scene.add(mesh);

    const lbl = label || Cabinet.cabinets[cabinetIdx]?.label || `ODF #${cabinetIdx + 1}`;
    let anchor;
    if (rowAngle === 0) {
      anchor = new THREE.Vector3(rx, 0.002, flipped ? rz - D + (50 * MM) : rz + D - (50 * MM));
    } else {
      anchor = new THREE.Vector3(flipped ? rx - D + (50 * MM) : rx + D - (50 * MM), 0.002, rz);
    }
    const el = _makeLabelEl(lbl, cabinetIdx);
    _labelAnchors.push({ el, anchor, cabinetIdx });

    _lockedHighlights.push({ mesh, cabinetIdx });
  }

  /**
   * Removes highlight surface and label for a specific locked cabinet.
   *
   * @param {number} cabinetIdx - Cabinet index to remove
   */
  function removeLockedHighlight(cabinetIdx) {
    const i = _lockedHighlights.findIndex(h => h.cabinetIdx === cabinetIdx);
    if (i < 0) return;
    const { mesh } = _lockedHighlights.splice(i, 1)[0];
    Cabinet.scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
    _removeLabelEl(cabinetIdx);
  }

  /**
   * Removes all locked cabinet highlights and labels from scene.
   */
  function clearLockedHighlights() {
    for (const { mesh } of _lockedHighlights) {
      Cabinet.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    _lockedHighlights.length = 0;
    for (const { el } of _labelAnchors) el.remove();
    _labelAnchors.length = 0;
  }

  /**
   * Fits camera to frame a cabinet assembly.
   * Preserves current zoom if already set; otherwise defaults to 2× max dimension.
   *
   * @param {THREE.Group} group - Cabinet to frame
   */
  function _fitCamera(group) {
    if (!window.CabinetControls) return;
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const currentRadius = CabinetControls.getRadius();
    const maxDim = Math.max(size.x, size.y, size.z);
    const defaultDist = maxDim * 2.0;
    const dist = currentRadius > 0.31 ? currentRadius : defaultDist;
    CabinetControls.setTarget(centre);
    CabinetControls.setView(Math.PI / 5, Math.PI / 3.8, dist);
  }

  /**
   * Shows or hides the build status overlay message.
   *
   * @param {string} msg - Status message, or '' to hide
   */
  function _status(msg) {
    const overlay = document.getElementById('buildStatus');
    const textEl = document.getElementById('buildStatusText');
    if (!overlay) return;
    if (textEl) textEl.textContent = msg;
    overlay.style.display = msg ? 'flex' : 'none';
  }

  /* ══════════════════════════════════════════════════
     CABINET ASSEMBLY
     Core assembly functions: structure, doors, accessories.
  ════════════════════════════════════════════════════ */

  /**
   * Creates a placeholder C-shaped frame for preview when GLB not available.
   * Approximates a frame using three boxes: top bar, bottom bar, back post.
   *
   * @param {number} heightU - Cabinet height in U
   * @param {string} cl - Cover color code (GY, BK, RD, WH)
   * @returns {THREE.Group} Placeholder frame group
   */
  function _makePlaceholderFrame(heightU, cl) {
    const H = heightU * 44.45 * MM;
    const W = 60 * MM;
    const D = 600 * MM;
    const T = 30 * MM;

    const color = _clToHex(cl);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0.35,
    });

    const g = new THREE.Group();

    const top = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), mat);
    top.position.set(0, H - T / 2, 0);

    const bot = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), mat);
    bot.position.set(0, T / 2, 0);

    const vert = new THREE.Mesh(new THREE.BoxGeometry(W, H - T * 2, T), mat);
    vert.position.set(0, H / 2, -(D / 2 - T / 2));

    [top, bot, vert].forEach(m => { m.castShadow = true; m.receiveShadow = true; });
    g.add(top, bot, vert);
    return g;
  }

  /**
   * Converts color code to hex value for Three.js materials.
   *
   * @param {string} cl - Color code: GY (gray), BK (black), RD (red), WH (white)
   * @returns {number} Hex color value
   */
  function _clToHex(cl) {
    return { GY: 0xaaaaaa, BK: 0x2a2a2a, RD: 0xe53935, WH: 0xf0f0f0 }[cl] ?? 0x888888;
  }

  /**
   * Assembles one cabinet section: frames, profiles, plates, feet, rails.
   * Handles structure for both single and composite cabinets (15DAS).
   *
   * @async
   * @param {object} p - Parsed code object
   * @param {string} de - Design code
   * @param {number} offsetX - X offset within cabinet (mm)
   * @param {THREE.Group} group - Group to add parts to
   */
  async function _buildCabinetPart(p, de, offsetX, group) {
    const widthMM = parseInt(de.slice(0, 2)) * 100;
    const spacingMM = FRAME_SPACING[widthMM];
    if (spacingMM === undefined) throw new Error('Unknown width for DE: ' + de);

    // Frames (left and right C-shaped profiles)
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

    // Horizontal profiles (bottom and top)
    const profGlbName = PROFILE_GLB[widthMM];
    const topYmm = PROFILE_TOP_Y[p.heightU];
    if (profGlbName && topYmm !== undefined) {
      const profPath = `${COMP_ROOT}${profGlbName}`;
      try {
        const profBot = await _loadGLB(profPath);
        const profTop = await _loadGLB(profPath);
        profBot.position.set((offsetX + PROFILE_X_MM) * MM, 0, 0);
        profTop.position.set((offsetX + PROFILE_X_MM) * MM, topYmm * MM, 0);
        group.add(profBot, profTop);
      } catch (e) {
        console.warn('[CabinetBuilder] Profile GLB not found:', profPath);
      }
    }

    // Vertical profiles (for wide cabinets 09, 12)
    const vertGlbName = VERT_PROF_GLB[p.heightU];
    const deForVert = DE_FR_BASE[de] || de;
    const vertXList = VERT_PROF_X[deForVert];
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

    // Mounting plates and accessory modules
    const deForPlates = DE_FR_BASE[de] || de;
    const pltXList = MOUNT_PLT_X[deForPlates];
    const plt4uCount = MOUNT_PLT_COUNT[p.heightU];
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
          const heightUKey = `${p.heightU}U`;
          const offsetY = MOUT_PLT_OFFSET_Y[heightUKey] ?? 0;
          let yMM = PLATE_Y_START + offsetY;
          for (let i = 0; i < plt4uCount; i++) {
            const plt = await _loadGLB(plt4uPath);
            plt.position.set((offsetX + xMM) * MM, yMM * MM, PLATE_Z_MM * MM);
            group.add(plt);

            const designName = designRows ? designRows[i] : null;
            const accessories = designName ? PLATE_DESIGNS[designName] : null;
            if (accessories) {
              for (const acc of accessories) {
                try {
                  const pt = MOUT_PLT_ATTACH_PTS[acc.pt];
                  const mdl = await _loadGLB(`${COMP_ROOT}${acc.glb}`);
                  mdl.position.set(
                    (offsetX + xMM + pt.x) * MM,
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

    // Mounting rails (for specific designs)
    const railXOffset = RAIL_X_OFFSET[de];
    if (railXOffset !== null && railXOffset !== undefined) {
      const railPath = `${COMP_ROOT}EZR_RLS-${p.he}.glb`;
      const RAIL_Y_OFFSET = 40;
      try {
        const rail = await _loadGLB(railPath);
        rail.position.set((offsetX + railXOffset) * MM, RAIL_Y_OFFSET * MM, 0);
        group.add(rail);
      } catch (e) {
        console.warn('[CabinetBuilder] Rail GLB not found:', railPath);
      }
    }

    // Feet (support points at corners)
    const footPath = `${COMP_ROOT}EZR_FOOT-M8.glb`;
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

  /**
   * Main cabinet assembly orchestrator.
   * Combines structure, doors, walls, roofs, and bottoms into final assembly.
   * Handles both standard single cabinets and composite 15DAS (wide triple) designs.
   *
   * @async
   * @param {object} p - Parsed code object
   * @returns {Promise<THREE.Group>} Complete cabinet assembly
   */
  async function _assemble(p) {
    const group = new THREE.Group();
    group.name = 'CabinetAssembly';

    // STRUCTURE: Frames, profiles, plates, feet
    if (p.de === '15DAS') {
      await _buildCabinetPart(p, '06LR0', 0, group);    // Left: 600mm
      await _buildCabinetPart(p, '09DAR', 600, group);  // Right: 900mm
    } else {
      await _buildCabinetPart(p, p.de, 0, group);
    }

    // DOORS (EZR_CL only) — includes glass/perf panels and hinges
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

      const hingeGlb = `${COMP_ROOT}EZR_hinge-${p.he}.glb`;
      const HINGE_OFF_X = 6.5;
      const HINGE_OFF_Z = 39.4;

      /**
       * Adds glass or perforated panel to door.
       * Glass: light blue transparent material with 0.25 opacity.
       * Perf: canvas texture with staggered holes and door color background.
       */
      function _addDoorPanel(door, type) {
        const bbox = new THREE.Box3().setFromObject(door);
        const W = (bbox.max.x - bbox.min.x) - 10 * MM;
        const H = (bbox.max.y - bbox.min.y) - 10 * MM;
        const D = 2 * MM;
        const cx = (bbox.min.x + bbox.max.x) / 2;
        const cy = (bbox.min.y + bbox.max.y) / 2;
        const cz = (bbox.min.z + bbox.max.z) / 2;

        const geo = new THREE.BoxGeometry(W, H, D);
        let mat;
        if (type === 'GLASS') {
          mat = new THREE.MeshPhysicalMaterial({
            color: 0xadd8e6, transparent: true, opacity: 0.25,
            roughness: 0, metalness: 0, transmission: 0.85,
            side: THREE.DoubleSide, depthWrite: false,
          });
        } else {
          // PERF: staggered round holes with door color background (70% transparent)
          const cw = 256, ch = 256;
          const canvas = document.createElement('canvas');
          canvas.width = cw; canvas.height = ch;
          const ctx = canvas.getContext('2d');

          const r = (doorColorHex >> 16) & 255;
          const g = (doorColorHex >> 8) & 255;
          const b = doorColorHex & 255;
          ctx.fillStyle = `rgba(${r},${g},${b},0.3)`;
          ctx.fillRect(0, 0, cw, ch);

          const pitch = 20;
          const radius = 8.4;
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = 'rgba(0,0,0,1)';
          for (let row = 0; row * pitch < ch + pitch; row++) {
            const offsetX = (row % 2) * (pitch / 2);
            for (let col = -1; col * pitch < cw + pitch; col++) {
              ctx.beginPath();
              ctx.arc(col * pitch + offsetX, row * pitch, radius, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.globalCompositeOperation = 'source-over';

          const tex = new THREE.CanvasTexture(canvas);
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(W / MM / 135, H / MM / 135);
          mat = new THREE.MeshBasicMaterial({
            map: tex, transparent: true, alphaTest: 0.1,
            side: THREE.DoubleSide, depthWrite: false,
          });
        }
        const panel = new THREE.Mesh(geo, mat);
        panel.position.set(cx, cy, cz);
        panel.renderOrder = 1;
        door.add(panel);
      }

      async function _placeDoorLeft(style, size, x) {
        const baseStyle = (style === 'GLASS' || style === 'PERF') ? 'OPEN' : style;
        const glb = `LD-${baseStyle}-${p.he}-${size}.glb`;
        try {
          const door = await _loadGLB(`${COMP_ROOT}${glb}`);
          _applyDoorColor(door);
          if (style === 'GLASS' || style === 'PERF') _addDoorPanel(door, style);
          door.position.set(-HINGE_OFF_X * MM, 0, -HINGE_OFF_Z * MM);
          const pivot = new THREE.Group();
          pivot.position.set((x + HINGE_OFF_X) * MM, 0, (DOOR_Z_MM + HINGE_OFF_Z) * MM);
          pivot.userData.isDoor = true;
          pivot.userData.doorSide = 'left';
          pivot.add(door);
          group.add(pivot);
          try {
            const hinge = await _loadGLB(hingeGlb);
            hinge.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.color.setHex(0x111111); } });
            hinge.position.set(x * MM, 0, DOOR_Z_MM * MM);
            group.add(hinge);
          } catch { /* hinge optional */ }
        } catch (e) { console.warn('[CabinetBuilder] Door GLB not found:', glb); }
      }

      async function _placeDoorRight(style, size, x) {
        const baseStyle = (style === 'GLASS' || style === 'PERF') ? 'OPEN' : style;
        const glb = `LD-${baseStyle}-${p.he}-${size}.glb`;
        try {
          const door = await _loadGLB(`${COMP_ROOT}${glb}`);
          _applyDoorColor(door);
          if (style === 'GLASS' || style === 'PERF') _addDoorPanel(door, style);
          const bbox = new THREE.Box3().setFromObject(door);
          door.rotation.z = Math.PI;
          door.position.set(HINGE_OFF_X * MM, bbox.max.y, -HINGE_OFF_Z * MM);
          const pivot = new THREE.Group();
          pivot.position.set((x - HINGE_OFF_X) * MM, -14 * MM, (DOOR_Z_MM + HINGE_OFF_Z) * MM);
          pivot.userData.isDoor = true;
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
          } catch { /* hinge optional */ }
        } catch (e) { console.warn('[CabinetBuilder] Door GLB not found:', glb); }
      }

      if (p.de === '15DAS') {
        const ldStyle = _doorStyle(p.cov[1]);
        const mdStyle = _doorStyle(p.cov[2]);
        const rdStyle = _doorStyle(p.cov[3]);
        if (ldStyle) await _placeDoorLeft(ldStyle, 600, 0);
        if (mdStyle) await _placeDoorLeft(mdStyle, 300, 600);
        if (rdStyle) await _placeDoorRight(rdStyle, 600, 1500);
      } else {
        const ldStyle = _doorStyle(p.cov[1]);
        const rdStyle = _doorStyle(p.cov[3]);
        const doorCfg = DOOR_CONFIG[p.de] || null;
        if (doorCfg) {
          if (ldStyle && doorCfg.left) await _placeDoorLeft(ldStyle, doorCfg.left, 0);
          if (rdStyle && doorCfg.right) await _placeDoorRight(rdStyle, doorCfg.right, p.widthMM);
        }
      }

      // Front bars (horizontal support bars at top/bottom of doors)
      const fbarWidthCode = { 300: '03', 600: '06', 900: '09', 1200: '12' }[p.widthMM];
      const topYmm = PROFILE_TOP_Y[p.heightU];
      if (fbarWidthCode && topYmm !== undefined) {
        const fbarPath = `${COMP_ROOT}EZR_FRNT_BAR-${fbarWidthCode}.glb`;
        try {
          const barBot = await _loadGLB(fbarPath);
          barBot.position.set(0, 0, 300 * MM);
          group.add(barBot);
        } catch (e) { console.warn('[CabinetBuilder] Front bar GLB not found:', fbarPath); }
        try {
          const barTop = await _loadGLB(fbarPath);
          const bbox = new THREE.Box3().setFromObject(barTop);
          barTop.rotation.z = Math.PI;
          barTop.position.set(bbox.max.x + 25.5 * MM, topYmm * MM + bbox.max.y, 300 * MM);
          group.add(barTop);
        } catch (e) { console.warn('[CabinetBuilder] Front bar GLB not found:', fbarPath); }
      }

      // Side walls (left/right covers)
      const swCode = (p.cov[7] || '0') + (p.cov[8] || '0');
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

        if (swCode[0] === '1') {
          try {
            const sw = await _loadGLB(swGlb);
            _applyCoverColor(sw);
            sw.position.set(0, 42 * MM, 40 * MM);
            sw.userData.isSideWall = true;
            group.add(sw);
          } catch (e) { console.warn('[CabinetBuilder] Side wall GLB not found:', swGlb); }
        }

        if (swCode[1] === '1') {
          try {
            const sw = await _loadGLB(swGlb);
            _applyCoverColor(sw);
            const bbox = new THREE.Box3().setFromObject(sw);
            sw.rotation.z = Math.PI;
            sw.position.set(0, bbox.max.y, 0);
            const pivot = new THREE.Group();
            pivot.position.set(p.widthMM * MM, 42 * MM, 40 * MM);
            pivot.userData.isSideWall = true;
            pivot.add(sw);
            group.add(pivot);
          } catch (e) { console.warn('[CabinetBuilder] Side wall GLB not found:', swGlb); }
        }
      }

      // Rear wall (EZR_CL only, when BW code = 1)
      const bwCode = p.bw || '0';
      if (bwCode === '1') {
        try {
          const coverColorHex = _clToHex(p.cl);
          const bwGlb = `${COMP_ROOT}EZR_BW-${p.he}.glb`;
          const wallWidth = 300;  // Each wall panel is 300mm wide
          const numWalls = Math.ceil(p.widthMM / wallWidth);

          for (let i = 0; i < numWalls; i++) {
            const bwMesh = await _loadGLB(bwGlb);
            // Apply cover color
            bwMesh.traverse(child => {
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
            // Position: -2mm on Z, spaced by 300mm on X
            bwMesh.position.set((i * wallWidth) * MM, 0, -2 * MM);
            bwMesh.userData.isRearWall = true;
            group.add(bwMesh);
          }
        } catch (e) {
          console.warn('[CabinetBuilder] Rear wall GLB not found:', `EZR_BW-${p.he}.glb`);
        }
      }

      // Top roof & bottom panels (EZR_CL only, when TC code = 1)
      const tcCode = p.cov[10] || '0';
      if (tcCode === '1') {
        const topYmm = PROFILE_TOP_Y[p.heightU];
        const PANEL_X_START = 40;
        const PANEL_Z_OFFSET = 40;

        const panelConfig = {
          300: [{ length: 220, xOffset: 0 }],
          600: [{ length: 220, xOffset: 0 }, { length: 300, xOffset: 220 }],
          900: [{ length: 220, xOffset: 0 }, { length: 300, xOffset: 220 }, { length: 300, xOffset: 520 }],
          1200: [{ length: 220, xOffset: 0 }, { length: 300, xOffset: 220 }, { length: 300, xOffset: 520 }, { length: 300, xOffset: 820 }],
        };

        const widthKey = p.widthMM;
        const panels = panelConfig[widthKey];
        if (panels) {
          for (const panel of panels) {
            const roofPath = `${COMP_ROOT}EZR_ROOF-BRSH-L${panel.length}.glb`;
            try {
              const roofMesh = await _loadGLB(roofPath);
              roofMesh.position.set((PANEL_X_START + panel.xOffset) * MM, topYmm * MM, PANEL_Z_OFFSET * MM);
              group.add(roofMesh);
            } catch (e) {
              console.warn('[CabinetBuilder] Roof GLB not found:', roofPath);
            }
          }

          for (const panel of panels) {
            const bottomPath = `${COMP_ROOT}EZR_ROOF-SLD-L${panel.length}.glb`;
            try {
              const bottomMesh = await _loadGLB(bottomPath);
              bottomMesh.position.set((PANEL_X_START + panel.xOffset) * MM, 0, PANEL_Z_OFFSET * MM);
              group.add(bottomMesh);
            } catch (e) {
              console.warn('[CabinetBuilder] Bottom GLB not found:', bottomPath);
            }
          }
        }
      }
    }

    // Lift entire assembly so feet sit on y=0, and offset depth to avoid rear wall collisions
    group.position.y = ASSEMBLY_LIFT * MM;
    group.position.z = ASSEMBLY_DEPTH_OFFSET * MM;

    return group;
  }

  /* ══════════════════════════════════════════════════
     SNAP POINTS SYSTEM
     Calculates attachment points for drag-and-drop accessories.
  ════════════════════════════════════════════════════ */

  /** Valid attachment points for each accessory type.
      Maps component filename to array of valid point labels. */
  const _ACC_SNAP_PTS = {
    'EZR_MDL-L87-NT':        ['A2','A3','A4','A5','A6','B2','B3','B4','B5','B6','C2','C3','C4','C5','C6'],
    'EZR_MDL-L224-NT':       ['A2','A3','A4','A5','A6','B2','B3','B4','B5','B6','C2','C3','C4','C5','C6'],
    'EZR_CBFX':              ['A2','A3','A4','A5','A6','B2','B3','B4','B5','B6','C2','C3','C4','C5','C6', 'ret-L', 'ret-R'],
    'EZR_RET':               ['ret-L','ret-R'],
    'EZR_ROUT-BRKT':         ['A5','B5','C5'],
    'EZR_SEP_PLT-4U':        ['A5','B5','C5'],
    'EZR_SEP_PLT-4U-horiz':  ['B6', 'B6-53', 'B6+53'],
    'EZR_SEP_PLT-4U-R':      ['C5'],
    'EZR_TBRKT':             ['A5','A6','B5','B6','C5','C6','ret-L','ret-R'],
    'EZR_CAB_EXT':           ['cab-ext-L','cab-ext-M','cab-ext-R'],
  };

  /**
   * Calculates all valid snap points for a given accessory type on a cabinet.
   * Returns world-space positions accounting for row transforms, plate offsets,
   * and multi-column layouts.
   *
   * Used by drag-and-drop system to show valid attachment locations.
   *
   * @param {string} code - Cabinet description code
   * @param {string} accType - Accessory component filename
   * @param {number} xOffset - Cabinet X position within row (mm), default 0
   * @param {number|null} rowIdx - Row index, default null (uses active row)
   * @returns {Array<object>} Array of { id, label, position: THREE.Vector3 }
   */
  function getSnapPoints(code, accType, xOffset = 0, rowIdx = null) {
    const p = _parse(code);
    if (!p) return [];
    const labels = _ACC_SNAP_PTS[accType];
    if (!labels) return [];
    const out = [];

    const row = _getRow(rowIdx);
    const rotY = _rowRotY(rowIdx);
    const cosR = Math.cos(rotY);
    const sinR = Math.sin(rotY);

    // Transform local cabinet coordinates to world space
    // accounting for row rotation and flipping
    function _toWorld(lxMM, lyMM, lzMM) {
      const { x: pivotX, z: pivotZ } = _rowWorldPos(xOffset, rowIdx, p.widthMM);
      const dlx = lxMM * MM;
      const dlz = lzMM * MM;
      return new THREE.Vector3(
        pivotX + dlx * cosR + dlz * sinR,
        lyMM * MM,
        pivotZ - dlx * sinR + dlz * cosR,
      );
    }

    function _collect(de, cabOffsetX) {
      const frDe = DE_FR_BASE[de] || de;
      const cols = MOUNT_PLT_X[frDe];
      if (!cols) return;
      const nPlates = MOUNT_PLT_COUNT[p.heightU];
      if (!nPlates) return;
      const heightUKey = `${p.heightU}U`;
      const offsetY = MOUT_PLT_OFFSET_Y[heightUKey] ?? 0;
      cols.forEach((xMM, ci) => {
        for (let pi = 0; pi < nPlates; pi++) {
          const yMM = PLATE_Y_START + offsetY + pi * PLATE_4U_H;
          labels.forEach(lbl => {
            const pt = MOUT_PLT_ATTACH_PTS[lbl];
            if (!pt) return;
            const lxMM = cabOffsetX + xMM + pt.x;
            const lyMM = ASSEMBLY_LIFT + yMM + pt.y;
            const lzMM = PLATE_Z_MM + pt.z;
            out.push({
              id: `${de}-c${ci}-p${pi}-${lbl}`,
              label: lbl,
              position: _toWorld(lxMM, lyMM, lzMM),
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

  /* ══════════════════════════════════════════════════
     PUBLIC API
     All exported functions for external use.
  ════════════════════════════════════════════════════ */

  /**
   * Builds a cabinet from a description code and adds to scene.
   *
   * @async
   * @param {string} code - Cabinet description code
   * @param {object} opts - Options
   * @param {boolean} opts.noFade - Skip fade-in animation, default false
   * @param {number} opts.xOffset - X position within row (mm), default 0
   * @param {boolean} opts.noFitCamera - Don't zoom to fit, default false
   * @param {number|null} opts.rowIdx - Row index, default null
   */
  async function build(code, { noFade = false, xOffset = 0, noFitCamera = false, rowIdx = null } = {}) {
    if (!code) { _status(''); return; }

    const p = _parse(code);
    if (!p) { showToast('Cannot parse code: ' + code, 'error'); return; }

    const skipFade = noFade || Cabinet.noFadeNext;
    Cabinet.noFadeNext = false;

    _status('Building ' + code + '…');

    if (_assembly) {
      if (skipFade) { Cabinet.scene.remove(_assembly); _disposeGroup(_assembly); }
      else { _fadeOutAndDispose(_assembly); }
      _assembly = null;
    }

    try {
      const group = await _assemble(p);
      const rIdx = rowIdx ?? Cabinet.activeRowIdx ?? 0;
      _applyRowTransform(group, xOffset, rIdx, p.widthMM);
      Cabinet.scene.add(group);
      _assembly = group;
      _showHighlight(group, p.widthMM, rIdx);
      if (!noFitCamera) _fitCamera(group);
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

  /**
   * Clears the active cabinet from the scene (not locked cabinets).
   *
   * @param {object} opts - Options
   * @param {boolean} opts.noFade - Skip fade-out animation, default false
   */
  function clearAssembly({ noFade = false } = {}) {
    _clearHighlight();
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

  /**
   * Removes all cabinets (active and locked) from scene.
   * Clears all highlights and labels.
   *
   * @param {object} opts - Options
   * @param {boolean} opts.noFade - Skip fade animations, default false
   */
  function clearAll({ noFade = false } = {}) {
    clearAssembly({ noFade });
    for (const grp of _lockedAssemblies) {
      Cabinet.scene.remove(grp);
      _disposeGroup(grp);
    }
    _lockedAssemblies = [];
    clearLockedHighlights();
  }

  /**
   * Moves active cabinet to locked state (confirmed).
   * Keeps in scene for reference and inserts at editingIdx to preserve order.
   */
  function lockAssembly() {
    if (!_assembly) return;
    const idx = (typeof Cabinet !== 'undefined') ? Cabinet.editingIdx : -1;
    if (idx >= 0 && idx <= _lockedAssemblies.length) {
      _lockedAssemblies.splice(idx, 0, _assembly);
    } else {
      _lockedAssemblies.push(_assembly);
    }
    _assembly = null;
  }

  /**
   * Returns the active cabinet assembly group.
   * @returns {THREE.Group|null} Current cabinet or null if none
   */
  function getAssembly() {
    return _assembly;
  }

  /**
   * Returns a locked cabinet by index.
   * @returns {THREE.Group|null} Locked cabinet or null if not found
   */
  function getLockedAssembly(idx) {
    return _lockedAssemblies[idx] ?? null;
  }

  /**
   * Removes and disposes a locked cabinet from scene.
   *
   * @param {number} idx - Index in locked assemblies array
   */
  function unlockAssembly(idx) {
    if (idx < 0 || idx >= _lockedAssemblies.length) return;
    const grp = _lockedAssemblies[idx];
    Cabinet.scene.remove(grp);
    _disposeGroup(grp);
    _lockedAssemblies.splice(idx, 1);
  }

  /**
   * Shifts all locked assemblies from a given index rightward along row axis.
   * Updates both meshes and highlight surfaces.
   *
   * @param {number} fromIdx - Starting index in locked assemblies
   * @param {number} deltaMM - Distance to shift (mm)
   */
  function shiftAssembliesRight(fromIdx, deltaMM) {
    const d = deltaMM * MM;
    for (let i = fromIdx; i < _lockedAssemblies.length; i++) {
      const cab = Cabinet.cabinets[i];
      if (!cab) continue;
      const angle = _getRow(cab.rowIdx).angle;
      if (angle === 0) _lockedAssemblies[i].position.x += d;
      else _lockedAssemblies[i].position.z -= d;
    }
    for (const h of _lockedHighlights) {
      if (h.cabinetIdx < fromIdx) continue;
      const cab = Cabinet.cabinets[h.cabinetIdx];
      if (!cab) continue;
      const angle = _getRow(cab.rowIdx).angle;
      if (angle === 0) h.mesh.position.x += d;
      else h.mesh.position.z -= d;
    }
  }

  /**
   * Recalculates and reapplies row transforms for all cabinets after row origin/angle changes.
   * Rebuilds all highlights and repositions accessories.
   */
  function rebuildAllForNewOrigin() {
    for (let i = 0; i < _lockedAssemblies.length; i++) {
      const cab = Cabinet.cabinets[i];
      if (!cab) continue;
      const p = _parse(cab.code);
      _applyRowTransform(_lockedAssemblies[i], cab.xOffset, cab.rowIdx ?? 0, p?.widthMM);
    }
    if (_assembly && Cabinet.editingIdx >= 0) {
      const cab = Cabinet.cabinets[Cabinet.editingIdx];
      if (cab) {
        const p = _parse(cab.code);
        _applyRowTransform(_assembly, cab.xOffset, cab.rowIdx ?? 0, p?.widthMM);
      }
    }
    clearLockedHighlights();
    for (let i = 0; i < Cabinet.cabinets.length; i++) {
      if (i === Cabinet.editingIdx) continue;
      const cab = Cabinet.cabinets[i];
      const p = _parse(cab.code);
      if (p) showLockedHighlight(cab.xOffset, p.widthMM, i, cab.rowIdx ?? 0);
    }
    if (_assembly && Cabinet.editingIdx >= 0) {
      const cab = Cabinet.cabinets[Cabinet.editingIdx];
      if (cab) {
        const p = _parse(cab.code);
        if (p) _showHighlight(_assembly, p.widthMM, cab.rowIdx ?? 0);
      }
    }
    if (window.CabinetDrag?.rebuildAllAccessories) {
      CabinetDrag.rebuildAllAccessories();
    }
  }

  /**
   * Rebuilds all locked cabinets from state after row deletion.
   * Clears and repopulates locked assemblies to reflect current state.
   */
  async function rebuildAllCabinetsFromState() {
    clearAll({ noFade: true });
    const editIdx = Cabinet.editingIdx;
    for (let i = 0; i < Cabinet.cabinets.length; i++) {
      if (i === editIdx) { _lockedAssemblies.push(null); continue; }
      const cab = Cabinet.cabinets[i];
      const p = _parse(cab.code);
      if (!p) { _lockedAssemblies.push(null); continue; }
      const group = await _assemble(p);
      _applyRowTransform(group, cab.xOffset, cab.rowIdx ?? 0, p.widthMM);
      Cabinet.scene.add(group);
      _lockedAssemblies.push(group);
      showLockedHighlight(cab.xOffset, p.widthMM, i, cab.rowIdx ?? 0);
    }
  }

  /**
   * Builds a cabinet into a specific scene (not the main Cabinet.scene).
   * Used for secondary views or exports.
   *
   * @async
   * @param {string} code - Cabinet description code
   * @param {THREE.Scene} scene - Target scene
   * @returns {Promise<THREE.Group|null>} Assembled group or null if parse failed
   */
  async function buildInto(code, scene) {
    const p = _parse(code);
    if (!p) return null;
    const group = await _assemble(p);
    scene.add(group);
    return group;
  }

  /**
   * Clears the active cabinet highlight without affecting the cabinet itself.
   */
  function clearHighlight() {
    _clearHighlight();
  }

  return {
    build,
    clearAssembly,
    clearAll,
    lockAssembly,
    unlockAssembly,
    getAssembly,
    getLockedAssembly,
    shiftAssembliesRight,
    rebuildAllForNewOrigin,
    rebuildAllCabinetsFromState,
    buildInto,
    clearHighlight,
    showLockedHighlight,
    removeLockedHighlight,
    clearLockedHighlights,
    updateLabel,
    updateLabelOverlays,
    getSnapPoints,
    parseCode: _parse,
    rowWorldPos: _rowWorldPos,
  };
})();
