/**
 * cabinet-assembly-config.js
 * All configuration constants and data tables for the cabinet assembly engine.
 * These are global constants referenced by cabinet-builder.js (CabinetBuilder IIFE).
 */


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

/** Which C-FRM frame indices (0=left, 1=right) are free of mounting plates.
    Keyed by base design code (DE_FR_BASE is applied before lookup).
    Derived codes (e.g. 09DAR → 090R0) inherit via DE_FR_BASE automatically. */
const CFRM_FREE_FRAMES = {
  '03000': [],
  '06000': [],
  '09L00': [0],
  '090R0': [1],
  '12LR0': [],
  '06LR0': [0, 1],
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

/** Attachment point coordinates local to each C-FRM (C-shaped vertical frame profile).
    Keyed by cabinet height (U value, e.g. 46 matches EZR_C_FRM-46-NT.glb).
    Coordinates are relative to the origin of each individual C-FRM model.
    Used for accessories that mount directly onto the C-FRM (e.g. EZR_CBFX). */
const CFRM_ATTACH_PTS = {
  50: { 'C-FRM-1': { x: 20, y: 2200, z: 40 }, 'C-FRM-2': { x: 20, y: 1700, z: 40 }, 'C-FRM-3': { x: 20, y: 1200, z: 40 }, 'C-FRM-4': { x: 20, y: 700, z: 40 }, 'C-FRM-5': { x: 20, y: 200, z: 40 }},
  46: { 'C-FRM-1': { x: 20, y: 2020, z: 40 }, 'C-FRM-2': { x: 20, y: 1520, z: 40 }, 'C-FRM-3': { x: 20, y: 1020, z: 40 } , 'C-FRM-4': { x: 20, y: 520, z: 40 }},
  42: { 'C-FRM-1': { x: 20, y: 1840, z: 40 }, 'C-FRM-2': { x: 20, y: 1340, z: 40 }, 'C-FRM-3': { x: 20, y: 840, z: 40 } , 'C-FRM-4': { x: 20, y: 340, z: 40 }},
  38: { 'C-FRM-1': { x: 20, y: 1660, z: 40 }, 'C-FRM-2': { x: 20, y: 1160, z: 40 }, 'C-FRM-3': { x: 20, y: 660, z: 40 } , 'C-FRM-4': { x: 20, y: 160, z: 40 }},
  22: { 'C-FRM-1': { x: 20, y: 940, z: 40 }, 'C-FRM-2': { x: 20, y: 525, z: 40 }, 'C-FRM-3': { x: 20, y: 110, z: 40 }  },
  18: { 'C-FRM-1': { x: 20, y: 760, z: 40 }, 'C-FRM-2': { x: 20, y: 435, z: 40 }, 'C-FRM-3': { x: 20, y: 110, z: 40 }   },
};

/** Valid attachment points for each accessory type.
    Maps component filename to array of valid point labels. */
/**
 * Preset accessories auto-injected when a cabinet has no manually placed accessories.
 * Keyed by DE code. Each entry targets the LEFT C-FRM only (frm0).
 * Snap ID format matches _collectCFRM: `${de}-frm0-${label}`.
 */
const _PRESET_ACCESSORIES = {
  // Left C-FRM (frm0)
  '09STL': [
    { code: 'EZR_TBRKT', snapId: '09STL-frm0-C-FRM-1' },
    { code: 'EZR_RET',   snapId: '09STL-frm0-C-FRM-2' },
    { code: 'EZR_RET',   snapId: '09STL-frm0-C-FRM-3' },
  ],
  '06LR0': [
    { code: 'EZR_TBRKT', snapId: '06LR0-frm0-C-FRM-1' },
    { code: 'EZR_RET',   snapId: '06LR0-frm0-C-FRM-2' },
    { code: 'EZR_RET',   snapId: '06LR0-frm0-C-FRM-3' },
  ],
  // Right C-FRM (frm1)
  '09STR': [
    { code: 'EZR_TBRKT', snapId: '09STR-frm1-C-FRM-1' },
    { code: 'EZR_RET',   snapId: '09STR-frm1-C-FRM-2' },
    { code: 'EZR_RET',   snapId: '09STR-frm1-C-FRM-3' },
  ],
  '09DAR': [
    { code: 'EZR_TBRKT', snapId: '09DAR-frm1-C-FRM-1' },
    { code: 'EZR_RET',   snapId: '09DAR-frm1-C-FRM-2' },
    { code: 'EZR_RET',   snapId: '09DAR-frm1-C-FRM-3' },
  ],
  // 15DAS = 06LR0 (left) + 09DAR (right) — snap IDs use those same prefixes
  '15DAS': [
    { code: 'EZR_TBRKT', snapId: '06LR0-frm0-C-FRM-1' },
    { code: 'EZR_RET',   snapId: '06LR0-frm0-C-FRM-2' },
    { code: 'EZR_RET',   snapId: '06LR0-frm0-C-FRM-3' },
    { code: 'EZR_TBRKT', snapId: '09DAR-frm1-C-FRM-1' },
    { code: 'EZR_RET',   snapId: '09DAR-frm1-C-FRM-2' },
    { code: 'EZR_RET',   snapId: '09DAR-frm1-C-FRM-3' },
  ],
};


const _ACC_SNAP_PTS = {
  'EZR_MDL-L87-NT':        ['A2','A3','A4','A5','A6','B2','B3','B4','B5','B6','C2','C3','C4','C5','C6'],
  'EZR_MDL-L224-NT':       ['A2','A3','A4','A5','A6','B2','B3','B4','B5','B6','C2','C3','C4','C5','C6'],
  'EZR_CBFX':              ['A2','A3','A4','A5','A6','B2','B3','B4','B5','B6','C2','C3','C4','C5','C6', 'ret-L', 'ret-R', 'C-FRM-1','C-FRM-2','C-FRM-3','C-FRM-4','C-FRM-5'],
  'EZR_RET':               ['ret-L','ret-R', 'C-FRM-1','C-FRM-2','C-FRM-3','C-FRM-4','C-FRM-5'],
  'EZR_ROUT-BRKT':         ['A6', 'A1'],
  'EZR_SEP_PLT-4U':        ['A5','B5','C5', 'C-FRM-1','C-FRM-2','C-FRM-3','C-FRM-4','C-FRM-5'],
  'EZR_SEP_PLT-4U-horiz':  ['B6', 'B6-53', 'B6+53'],
  'EZR_SEP_PLT-4U-R':      ['C5'],
  'EZR_TBRKT':             ['A5','A6','B5','B6','C5','C6','ret-L','ret-R', 'C-FRM-1','C-FRM-2','C-FRM-3','C-FRM-4','C-FRM-5'],
  'EZR_CAB_EXT':           ['cab-ext-L','cab-ext-M','cab-ext-R'],
};

/** Child snap points on accessories (local mm), for acc-on-acc attachment. */
const _ACC_CHILD_SNAP_PTS = {
  'EZR_ROUT-BRKT': [
    { id: 'rout-plt-0', x: 92, y: -22.2, z: 70  },
    { id: 'rout-plt-1', x: 92, y: -22.2, z: 186 },
  ],
};

/** Child snap points on chassis (local mm, base coords before DE offset).
    For acc-on-chassis attachment. */
const _CHASSIS_CHILD_SNAP_PTS = {
  'Chassis-EZR_ROUT-BRKT': [
    { id: 'rout-plt-0', x: 25,  y: 2, z: 96  },
    { id: 'rout-plt-1', x: 25,  y: 2, z: 212 },
    { id: 'rout-plt-2', x: 324, y: 2, z: 96  },
    { id: 'rout-plt-3', x: 324, y: 2, z: 212 },
  ],
};

/** X offset (mm) added to Chassis-EZR_ROUT-BRKT child snap X coords per DE code.
    DEs not listed (03000, 06000, etc.) have no chassis rail → no snap points. */
const _CHASSIS_PLT_X_OFFSET_BY_DE = {
  '06LR0': 80,
  '09L00': 40,
  '090R0': 120,
  '09STL': 40,
  '09STR': 120,
  '09DAR': 120,
  '12LR0': 80,
  '12IFA': 80,
  '12STM': 80,
};

/** Maps an accessory type to the parent type it attaches to (acc-on-acc or acc-on-chassis).
    Values can be an accessory code OR a chassis code. */
const _ACC_PARENT_TYPE = {
  'EZR_ROUT-PLT': ['EZR_ROUT-BRKT', 'Chassis-EZR_ROUT-BRKT'],
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
    { glb: 'EZR_MDL-L224-NT.glb', pt: 'B2' },
    { glb: 'EZR_MDL-L87-NT.glb', pt: 'A4', rotZ: Math.PI },
    { glb: 'EZR_MDL-L87-NT.glb', pt: 'C4', rotZ: Math.PI },
  ],
  'HM': [
    { glb: 'EZR_MDL-L224-NT.glb', pt: 'B2' },
    { glb: 'EZR_MDL-L87-NT.glb', pt: 'A3' },
    { glb: 'EZR_MDL-L87-NT.glb', pt: 'C3' },
    { glb: 'EZR_MDL-L87-NT.glb', pt: 'A4', rotZ: Math.PI },
    { glb: 'EZR_MDL-L87-NT.glb', pt: 'C4', rotZ: Math.PI },
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
    { glb: 'EZR_MDL-L224-NT.glb', pt: 'B3' },
    { glb: 'EZR_MDL-L224-NT.glb', pt: 'B4', rotZ: Math.PI },
    { glb: 'EZR_MDL-L87-NT.glb', pt: 'C4' },
    { glb: 'EZR_RET.glb', pt: 'ret-L' },
  ],
  'ER': [
    { glb: 'EZR_SEP_PLT-4U-R.glb', pt: 'C5' },
    { glb: 'EZR_MDL-L224-NT.glb', pt: 'B3' },
    { glb: 'EZR_MDL-L224-NT.glb', pt: 'B4', rotZ: Math.PI },
    { glb: 'EZR_MDL-L87-NT.glb', pt: 'A4' },
    { glb: 'EZR_RET.glb', pt: 'ret-R' },
  ],
  'FL': [
    { glb: 'EZR_MDL-L224-NT.glb', pt: 'A1', rotZ: Math.PI },
    { glb: 'EZR_MDL-L224-NT.glb', pt: 'B3' },
    { glb: 'EZR_MDL-L224-NT.glb', pt: 'B4', rotZ: Math.PI },
    { glb: 'EZR_MDL-L87-NT.glb', pt: 'C4' },
  ],
  'FR': [
    { glb: 'EZR_MDL-L224-NT.glb', pt: 'C1', rotZ: Math.PI },
    { glb: 'EZR_MDL-L224-NT.glb', pt: 'B3' },
    { glb: 'EZR_MDL-L224-NT.glb', pt: 'B4', rotZ: Math.PI },
    { glb: 'EZR_MDL-L87-NT.glb', pt: 'A4' },
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
      ['AR','BR1','BR2','BR2','BR2','DR','BR1','BR2','BR2','BR2','CR', null],
      ['AL','BL1','BL2','BL2','BL2','DL','BL1','BL2','BL2','BL2','CL', null],
    ],
    46: [
      ['AR','BL1','BL2','BL2','BL2','DL','BL1','BL2','BL2','BL2','CL'],
      ['AL','BR1','BR2','BR2','BR2','DR','BR1','BR2','BR2','BR2','CR'],
    ],
    42: [
      ['AL','BL1','BL2','BL2','BL2','DL','BL1','BL2','BL2','BL2'],
      ['AR','BR1','BR2','BR2','BR2','DR','BR1','BR2','BR2','BR2'],
    ],
    38: [
      ['AL','BL1','BL2','BL2','DL','BL1','BL2','BL2','CL'],
      ['AR','BR1','BR2','BR2','DR','BR1','BR2','BR2','CR'],
    ],
    22: [
      ['AL','BL1','BL2','BL2','BL2'],
      ['AR','BR1','BR2','BR2','BR2'],
    ],
    18: [
      ['AL','BL1','BL2','BL2'],
      ['AR','BR1','BR2','BR2'],
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