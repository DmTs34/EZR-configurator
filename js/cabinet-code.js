/**
 * cabinet-code.js
 * Cabinet code catalog data + code builder/parser/validator.
 * Description code structure: EZR_XX-XXX-XXXXX-DxxxBxSxxTx-x-XX
 *   PR  – EZR_FR / EZR_OP / EZR_CL
 *   HE  – 50U / 46U / 42U / 38U / 22U / 18U
 *   DE  – 5-char design code (depends on PR)
 *   COV – DLD MD RD  B BW  S SW  T TC
 *   AS  – A / B / C
 *   CL  – GY / BK / RD / WH
 */

/* ══════════════════════════════════════════════════════
   CATALOG DATA
══════════════════════════════════════════════════════ */

const PRESET_CONFIGS = [
  { order: '85280142', code: 'EZR_OP-46U-06LR0-D000B0S00T0-A-GY' },
  { order: '85269549', code: 'EZR_OP-46U-09STL-D000B0S00T0-A-GY' },
  { order: '85269555', code: 'EZR_OP-46U-09STR-D000B0S00T0-A-GY' },
  { order: '85269565', code: 'EZR_OP-46U-12IFA-D000B0S00T0-A-GY' },
  { order: '—',        code: 'EZR_OP-46U-15DAS-D000B0S00T0-E-GY' },
  { order: '85274066', code: 'EZR_CL-46U-06LR0-DB00B1S11T1-A-BK' },
  { order: '85274483', code: 'EZR_CL-46U-06LR0-DH00B1S11T1-A-BK' },
  { order: '85268280', code: 'EZR_CL-46U-09STL-DB02B1S11T1-A-BK' },
  { order: '85269556', code: 'EZR_CL-46U-09STR-D20BB1S11T1-A-BK' },
  { order: '—',        code: 'EZR_CL-46U-12IFA-DH0HB1S11T1-A-RD' },
  { order: '85274607', code: 'EZR_CL-46U-15DAS-DH2HB1S11T1-E-BK' },
];

const PR_TYPES = {
  'EZR_FR': { label: 'Frame',  short: 'FR', icon: '⬜', desc: 'Open frame — no doors, no internal accessories' },
  'EZR_OP': { label: 'Open',   short: 'OP', icon: '🔲', desc: 'No doors, with predefined internal accessories' },
  'EZR_CL': { label: 'Closed', short: 'CL', icon: '🔳', desc: 'Frame or Open + doors, side walls, roof & floor' },
};

const HE_OPTIONS = ['18U','22U','38U','42U','46U','50U'];

const DE_BY_PR = {
  'EZR_FR': [
    { code:'03000', label:'300 mm',       desc:'With mounting plates' },
    { code:'06000', label:'600 mm',       desc:'With mounting plates' },
    { code:'06LR0', label:'600 mm empty', desc:'No mounting plates' },
    { code:'09L00', label:'900 mm left',  desc:'Left-oriented chassis\nPlates on the right' },
    { code:'090R0', label:'900 mm right', desc:'Right-oriented chassis\nPlates on the left' },
    { code:'12LR0', label:'1200 mm',      desc:'Any chassis\nPlates on both sides' },
  ],
  'EZR_OP': [
    { code:'06LR0', label:'600 mm LR',       desc:'Based on FR-06LR0, with added accessories' },
    { code:'03TLT', label:'300 mm top-left', desc:'Based on 03000, cable entry top-left' },
    { code:'03TRT', label:'300 mm top-right',desc:'Based on 03000, cable entry top-right' },
    { code:'09STL', label:'900 mm left std', desc:'Standard left-oriented chassis with accessories' },
    { code:'09STR', label:'900 mm right std',desc:'Standard right-oriented chassis with accessories' },
    { code:'09DAR', label:'900 mm double',   desc:'Right-oriented, stackable with 06LR0 for double cabinet' },
    { code:'12IFA', label:'1200 mm IANOS',   desc:'Based on 12LR0 — IANOS FF chassis' },
    { code:'12STM', label:'1200 mm STM',     desc:'Based on 12LR0 — left/right chassis + cable entry section' },
    { code:'15DAS', label:'1500 mm DAS',     desc:'Double: 06LR0 (600mm) + 09DAR (900mm)' },
  ],
  'EZR_CL': [],
};

function getDeOptions(pr) {
  if (pr !== 'EZR_CL') return DE_BY_PR[pr] || [];
  return [
    ...DE_BY_PR['EZR_FR'].map(d => ({ ...d, label: d.label + ' (Frame)',  origin: 'FR' })),
    ...DE_BY_PR['EZR_OP'].map(d => ({ ...d, label: d.label + ' (Open)',   origin: 'OP' })),
  ];
}

const AS_OPTIONS = [
  { code:'A', label:'Pre-assembled',   desc:'Delivered fully assembled' },
  { code:'B', label:'Quick-mount',     desc:'Partially assembled — fast on-site install' },
  { code:'E', label:'Two-box',          desc:'15DAS special: assembled, delivered in two boxes' },
];

const CL_OPTIONS = [
  { code:'GY', label:'Grey',  hex:'#9e9e9e' },
  { code:'BK', label:'Black', hex:'#212121' },
  { code:'RD', label:'Red',   hex:'#e53935' },
  { code:'WH', label:'White', hex:'#f0f0f0', border: true },
];

const DOOR_CODES_300 = [
  { code:'1', desc:'Solid — button lock' },
  { code:'2', desc:'Solid — key 1333' },
  { code:'3', desc:'Solid — 3-digit code' },
  { code:'4', desc:'Safety glass — button lock' },
  { code:'5', desc:'Safety glass — key 1333' },
  { code:'6', desc:'Safety glass — 3-digit code' },
  { code:'7', desc:'Perforated — button lock' },
  { code:'8', desc:'Perforated — key 1333' },
  { code:'9', desc:'Perforated — 3-digit code' },
  { code:'0', desc:'No door' },
];

const DOOR_CODES_600 = [
  { code:'A', desc:'Solid — button lock' },
  { code:'B', desc:'Solid — key 1333' },
  { code:'C', desc:'Solid — 3-digit code' },
  { code:'D', desc:'Safety glass — button lock' },
  { code:'E', desc:'Safety glass — key 1333' },
  { code:'F', desc:'Safety glass — 3-digit code' },
  { code:'G', desc:'Perforated — button lock' },
  { code:'H', desc:'Perforated — key 1333' },
  { code:'I', desc:'Perforated — 3-digit code' },
  { code:'0', desc:'No door' },
];

function _isDoorCodeValidForSize(code, size) {
  if (!size)            return true;   // unknown DE — skip
  if (size === 'none')  return code === '0';
  if (size === '300')   return DOOR_CODES_300.some(d => d.code === code);
  if (size === '600')   return DOOR_CODES_600.some(d => d.code === code);
  return false;
}

// Returns { ld: '300'|'600'|'none', rd: '300'|'600'|'none' } based on DE code
function _getDoorConfig(de) {
  if (!de) return { ld: null, rd: null };
  if (de === '15DAS') return { ld: '600', md: '300', rd: '600' };
  const LD_300  = ['03000','090R0','03TLT','09STR','09DAR'];
  const LD_600  = ['06000','06LR0','09L00','12LR0','09STL','12IFA','12STM'];
  const RD_NONE = ['03000','03TLT','06000','06LR0'];
  const RD_600  = ['090R0','09STR','09DAR','12LR0','12IFA','12STM'];
  const RD_300  = ['03TRT','09L00','09STL'];
  return {
    ld: LD_300.includes(de) ? '300' : LD_600.includes(de) ? '600' : 'none',
    rd: RD_NONE.includes(de) ? 'none' : RD_600.includes(de) ? '600' : RD_300.includes(de) ? '300' : 'none',
  };
}

/* ══════════════════════════════════════════════════════
   CODE BUILDER
══════════════════════════════════════════════════════ */
function buildCode(s) {
  if (!s.pr || !s.he || !s.de) return '';

  let doorsCode = 'D000';
  let wallsCode = 'B0S00T0';

  if (s.pr === 'EZR_CL') {
    if (s.doors) {
      doorsCode = s.de === '15DAS'
        ? `D${s.doors.ld || '0'}${s.doors.md || '0'}${s.doors.rd || '0'}`
        : `D${s.doors.ld || '0'}0${s.doors.rd || '0'}`;
    }
    if (s.cov) wallsCode = `B${s.cov.bw || '0'}S${s.cov.sw || '00'}T${s.cov.tc || '0'}`;
  }

  if (!s.as || !s.cl) return '';
  return `${s.pr}-${s.he}-${s.de}-${doorsCode}${wallsCode}-${s.as}-${s.cl}`;
}

function parseCode(code) {
  const parts = code.split('-');
  if (parts.length < 6) return null;
  const pr      = parts[0];
  const he      = parts[1];
  const de      = parts[2];
  const covFull = parts[3];
  const as_     = parts[4];
  const cl      = parts[5];

  if (!PR_TYPES[pr]) return null;
  if (!HE_OPTIONS.includes(he)) return null;
  const deList = getDeOptions(pr);
  if (!deList.find(d => d.code === de)) return null;

  // Doors segment: 15DAS uses D{ld}{md}{rd} (4 chars), others use D{ld}0{rd} (4 chars)
  const dm   = de === '15DAS'
    ? covFull.slice(0, 4).match(/^D(.)(.)(.)$/)
    : covFull.slice(0, 4).match(/^D(.)0(.)$/);
  const wm = covFull.slice(4).match(/^B(.)S(..)T(.)$/);
  if (!dm || !wm) return null;

  const doors = de === '15DAS'
    ? { ld: dm[1], md: dm[2], rd: dm[3] }
    : { ld: dm[1], rd: dm[2] };

  return {
    pr, he, de,
    doors,
    cov: { bw: wm[1], sw: wm[2], tc: wm[3] },
    as: as_, cl,
  };
}

function validateCode(code) {
  if (!code) return { valid: false, msg: 'Select all segments to configure' };
  const parsed = parseCode(code);
  if (!parsed) return { valid: false, msg: 'Invalid code format' };
  return { valid: true, msg: 'Valid configuration' };
}
