/**
 * cabinet-ui.js
 * UI interactions for the EZR Cabinet Configurator.
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

/* ══════════════════════════════════════════════════════
   STEP 1 — CABINET INPUT MODE
══════════════════════════════════════════════════════ */
function setMode(mode) {
  Cabinet.inputMode = mode;
  _renderCodeEditor();
}

/* ── Segment-based Code Editor ──────────────────────── */

let _activePopoverIndex = -1;
let _lastBuiltCode      = null;

/**
 * Renders the 6 interactive segment chips from Cabinet.wizardSelections.
 * Also updates the validation status line.
 */
function _renderCodeEditor() {
  const container = document.getElementById('codeSegments');
  if (!container) return;

  const s         = Cabinet.wizardSelections;
  const doorsVal  = _doorsSegmentValue(s);
  const wallsVal  = _wallsSegmentValue(s);

  // Doors and Covering chips are non-clickable for FR/OP (always fixed D000 / B0S00T0)
  const covFixed = !!s.pr && s.pr !== 'EZR_CL';

  const FIELDS = [
    { label: 'Product',  value: s.pr     || null, fixed: false },
    { label: 'Height',   value: s.he     || null, fixed: false },
    { label: 'Design',   value: s.de     || null, fixed: false },
    { label: 'Doors',    value: doorsVal,          fixed: covFixed },
    { label: 'Covering', value: wallsVal,          fixed: covFixed },
    { label: 'Assembly', value: s.as     || null, fixed: false },
    { label: 'Colour',   value: s.cl     || null, fixed: false },
  ];

  const validity = _segmentValidity(s);
  const validationResult = _getValidationMsg(s, validity);

  container.innerHTML = FIELDS.map((f, i) => {
    const empty   = f.value === null;
    const invalid = validity[i] === false;
    const cls     = [empty ? 'empty' : invalid ? 'invalid' : '', f.fixed ? 'fixed' : ''].join(' ').trim();
    const hint    = invalid ? _segmentInvalidHint(i, s) : '';
    const click   = f.fixed ? '' : `onclick="segmentClick(${i}, this)"`;
    return `<div class="code-segment ${cls}" ${click} title="${hint}">
      <span class="seg-value">${f.value || '—'}</span>
      <span class="seg-label">${f.label}</span>
    </div>`;
  }).join('');

  _applyValidationState(validationResult);
}

function _doorsSegmentValue(s) {
  if (!s.pr) return null;
  if (s.pr !== 'EZR_CL') return 'D000';
  if (s.doors) {
    return s.de === '15DAS'
      ? `D${s.doors.ld || '0'}${s.doors.md || '0'}${s.doors.rd || '0'}`
      : `D${s.doors.ld || '0'}0${s.doors.rd || '0'}`;
  }
  return null;
}

function _wallsSegmentValue(s) {
  if (!s.pr) return null;
  if (s.pr !== 'EZR_CL') return 'B0S00T0';
  if (s.cov) return `B${s.cov.bw || '0'}S${s.cov.sw || '00'}T${s.cov.tc || '0'}`;
  return null;
}

function _segmentValidity(s) {
  const clValid = s.cl
    ? (['GY','BK','RD','WH'].includes(s.cl) &&
       !((s.pr === 'EZR_FR' || s.pr === 'EZR_OP') && s.cl !== 'GY'))
    : null;

  // Doors validity (index 3)
  let doorsValid = null;
  if (s.pr && s.pr !== 'EZR_CL') {
    doorsValid = true; // FR/OP: always D000, always valid
  } else if (s.pr === 'EZR_CL') {
    if (s._doorsInvalid) {
      doorsValid = false;
    } else if (s.doors && s.de) {
      const cfg  = _getDoorConfig(s.de);
      const ldOk = _isDoorCodeValidForSize(s.doors.ld || '0', cfg.ld);
      const mdOk = cfg.md ? _isDoorCodeValidForSize(s.doors.md || '0', cfg.md) : true;
      const rdOk = _isDoorCodeValidForSize(s.doors.rd || '0', cfg.rd);
      doorsValid = ldOk && mdOk && rdOk ? true : false;
    } else {
      doorsValid = s.doors ? true : null;
    }
  }

  // Walls/Covering validity (index 4)
  let wallsValid = null;
  if (s.pr && s.pr !== 'EZR_CL') {
    wallsValid = true;
  } else if (s.pr === 'EZR_CL') {
    if (s._covInvalid) wallsValid = false;
    else wallsValid = s.cov ? true : null;
  }

  // AS validity: E only allowed for 15DAS; non-E not allowed for 15DAS
  let asValid = null;
  if (s.as) {
    if (!['A','B','E'].includes(s.as)) {
      asValid = false;
    } else if (s.as === 'E' && s.de && !s.de.startsWith('15')) {
      asValid = false; // E is exclusive to 15xx width
    } else if (s.as !== 'E' && s.de?.startsWith('15')) {
      asValid = false; // 15xx width requires E
    } else {
      asValid = true;
    }
  }

  return [
    s.pr ? !!PR_TYPES[s.pr] : null,
    s.he ? HE_OPTIONS.includes(s.he) : null,
    s.de ? (s.pr ? !!getDeOptions(s.pr).find(d => d.code === s.de) : false) : null,
    doorsValid,
    wallsValid,
    asValid,
    clValid,
  ];
}

function _segmentInvalidHint(index, s) {
  const clHint = (s.pr === 'EZR_FR' || s.pr === 'EZR_OP')
    ? 'Frame and Open types can only be Grey (GY)'
    : 'Unknown colour: ' + s.cl;
  const hints = [
    'Unknown cabinet type: ' + s.pr,
    'Unknown height: ' + s.he,
    s.pr ? 'Design ' + s.de + ' is not valid for ' + s.pr : 'Select Product first',
    'Invalid door code',
    'Invalid covering code',
    s.as === 'E' ? 'Assembly E (Two-box) is only valid for 1500mm width designs'
                 : (s.de?.startsWith('15') ? '1500mm design requires Assembly E (Two-box)' : 'Unknown assembly option: ' + s.as),
    clHint,
  ];
  return hints[index] || 'Invalid value';
}

function _getValidationMsg(s, validity) {
  if (validity[0] === false) return { valid: false, msg: 'Unknown Product: ' + s.pr };
  if (validity[1] === false) return { valid: false, msg: 'Unknown Height: ' + s.he };
  if (validity[2] === false) return { valid: false, msg: s.pr ? 'Design ' + s.de + ' not valid for ' + s.pr : 'Select Product first' };
  if (validity[3] === false) return { valid: false, msg: 'Invalid door code' };
  if (validity[5] === false) return { valid: false, msg:
    s.as === 'E' ? 'Assembly E is only valid for 1500mm width designs'
                 : (s.de?.startsWith('15') ? '1500mm design requires Assembly E (Two-box)' : 'Unknown Assembly: ' + s.as) };
  if (validity[6] === false) return { valid: false, msg: 'Unknown Colour: ' + s.cl };

  if (!s.pr) return { valid: false, msg: 'Select Product' };
  if (!s.he) return { valid: false, msg: 'Select Height' };
  if (!s.de) return { valid: false, msg: 'Select Design' };
  if (s.pr === 'EZR_CL' && !s.doors) return { valid: false, msg: 'Select Doors' };
  if (!s.as) return { valid: false, msg: 'Select Assembly' };
  if (!s.cl) return { valid: false, msg: 'Select Colour' };

  return { valid: true, msg: 'Valid configuration' };
}

/* ── Segment popover ─────────────────────────────────── */

function segmentClick(index, el) {
  if (_activePopoverIndex === index) {
    _closeSegmentPopover();
    return;
  }
  _showSegmentPopover(index, el);
}

function _showSegmentPopover(index, anchorEl) {
  const popover = document.getElementById('segmentPopover');
  if (!popover) return;

  _activePopoverIndex = index;
  popover.innerHTML   = _buildPopoverContent(index);
  popover.classList.add('open');

  // Position below the anchor, keeping within viewport
  const rect = anchorEl.getBoundingClientRect();
  const pw   = index === 3 ? 420 : 280;  // Doors popover is wider (two columns)
  let left   = rect.left;
  let top    = rect.bottom + 6;

  if (left + pw > window.innerWidth - 10) left = window.innerWidth - pw - 10;
  if (left < 10) left = 10;
  // Flip above if would overflow bottom
  const estH = 280;
  if (top + estH > window.innerHeight - 10) top = rect.top - estH - 4;
  if (top < 10) top = 10;

  popover.style.left     = left + 'px';
  popover.style.top      = top  + 'px';
  popover.style.maxWidth = pw   + 'px';
}

function _closeSegmentPopover() {
  const popover = document.getElementById('segmentPopover');
  if (popover) popover.classList.remove('open');
  _activePopoverIndex = -1;
}

function _buildPopoverContent(index) {
  const s     = Cabinet.wizardSelections;
  const cur   = [s.pr, s.he, s.de, _doorsSegmentValue(s), _wallsSegmentValue(s), s.as, s.cl][index];
  const title = ['Product', 'Height', 'Design', 'Doors', 'Covering', 'Assembly', 'Colour'][index];

  let html = `<div class="seg-popover-title">${title}</div>`;

  if (index === 0) { // PR
    html += '<div class="seg-popover-options">';
    for (const [code, info] of Object.entries(PR_TYPES)) {
      const sel = cur === code ? 'selected' : '';
      html += `<button class="seg-popover-btn ${sel}" onclick="_segSetPR('${code}')">
        ${code}<span class="seg-popover-btn-sub">${info.desc}</span>
      </button>`;
    }
    html += '</div>';

  } else if (index === 1) { // HE
    html += '<div class="seg-popover-options">';
    for (const he of HE_OPTIONS) {
      const sel = cur === he ? 'selected' : '';
      html += `<button class="seg-popover-btn ${sel}" onclick="_segSet(1,'${he}')">${he}</button>`;
    }
    html += '</div>';

  } else if (index === 2) { // DE
    if (!s.pr) {
      html += '<div class="seg-popover-note">Select Product first</div>';
    } else {
      const opts = getDeOptions(s.pr);
      html += '<div class="seg-popover-options">';
      for (const d of opts) {
        const sel = cur === d.code ? 'selected' : '';
        html += `<button class="seg-popover-btn ${sel}" onclick="_segSet(2,'${d.code}')">
          ${d.code}<span class="seg-popover-btn-sub">${d.desc}</span>
        </button>`;
      }
      html += '</div>';
    }

  } else if (index === 3) { // DOORS
    html += _buildDoorsPopoverContent(s);

  } else if (index === 4) { // COVERING (walls)
    if (!s.pr || s.pr === 'EZR_FR' || s.pr === 'EZR_OP') {
      html += '<div class="seg-popover-note">Fixed for Frame and Open types:<br><code>B0S00T0</code></div>';
    } else {
      html += _buildCovPopoverContent(s.cov || {});
    }

  } else if (index === 5) { // AS
    html += '<div class="seg-popover-options">';
    const is15xx = s.de?.startsWith('15');
    for (const a of AS_OPTIONS) {
      if (a.code === 'C') continue;              // C removed
      if (a.code === 'E' && !is15xx) continue;  // E only for 1500mm
      if (a.code !== 'E' && is15xx) continue;   // 1500mm only allows E
      const sel = cur === a.code ? 'selected' : '';
      html += `<button class="seg-popover-btn ${sel}" onclick="_segSet(5,'${a.code}')">
        ${a.code}<span class="seg-popover-btn-sub">${a.desc}</span>
      </button>`;
    }
    html += '</div>';

  } else if (index === 6) { // CL
    const clRestricted = s.pr === 'EZR_FR' || s.pr === 'EZR_OP';
    if (clRestricted) {
      html += '<div class="seg-popover-note">Frame and Open types are only available in Grey.</div>';
    }
    html += '<div class="seg-popover-options">';
    for (const c of CL_OPTIONS) {
      const locked   = clRestricted && c.code !== 'GY';
      const sel      = cur === c.code ? 'selected' : '';
      const bord     = c.border ? 'border:1px solid #ccc;' : '';
      const disabled = locked ? 'disabled style="opacity:0.3;cursor:not-allowed"' : '';
      const onclick  = locked ? '' : `onclick="_segSet(6,'${c.code}')"`;
      html += `<button class="seg-popover-btn ${sel}" ${onclick} ${disabled}>
        <span style="display:flex;align-items:center;gap:6px">
          <span class="cl-swatch-sm" style="background:${c.hex};${bord}flex-shrink:0"></span>${c.code}
        </span>
        <span class="seg-popover-btn-sub">${c.label}</span>
      </button>`;
    }
    html += '</div>';
  }

  return html;
}

function _buildDoorsPopoverContent(s) {
  if (!s.pr || s.pr !== 'EZR_CL') {
    return '<div class="seg-popover-note">Fixed for Frame and Open types:<br><code>D000</code></div>';
  }
  if (!s.de) {
    return '<div class="seg-popover-note">Select Design first</div>';
  }

  const cfg   = _getDoorConfig(s.de);
  const doors = s.doors || { ld: '0', md: '0', rd: '0' };

  const mkDoorSection = (side, label, size, curVal) => {
    if (size === 'none') {
      return `<div class="cov-row">
        <span class="cov-label">${label}</span>
        <span class="seg-popover-note" style="padding:0;font-style:normal;color:var(--color-text-secondary)">No door</span>
      </div>`;
    }
    const codes = size === '300' ? DOOR_CODES_300 : DOOR_CODES_600;
    return `<div class="door-section">
      <div class="cov-label" style="padding:6px 0 4px">${label} <span style="opacity:.5">(${size} mm)</span></div>
      <div class="seg-popover-options">
        ${codes.map(d => `<button class="seg-popover-btn ${curVal === d.code ? 'selected' : ''}"
          onclick="_segSetDoor('${side}','${d.code}')">
          ${d.code}<span class="seg-popover-btn-sub">${d.desc}</span>
        </button>`).join('')}
      </div>
    </div>`;
  };

  const doorSections = s.de === '15DAS'
    ? `${mkDoorSection('ld', 'Left door (600mm)',   cfg.ld, doors.ld || '0')}
       ${mkDoorSection('md', 'Middle door (300mm)', cfg.md, doors.md || '0')}
       ${mkDoorSection('rd', 'Right door (600mm)',  cfg.rd, doors.rd || '0')}`
    : `${mkDoorSection('ld', 'Left door',  cfg.ld, doors.ld || '0')}
       ${mkDoorSection('rd', 'Right door', cfg.rd, doors.rd || '0')}`;

  return `<div class="seg-popover-cov">
    <div class="door-sections-row">
      ${doorSections}
    </div>
    <div style="padding:8px 12px">
      <button class="btn btn-primary" onclick="_closeSegmentPopover()"
        style="width:100%;font-size:11px;padding:5px 0">Done</button>
    </div>
  </div>`;
}

function _buildCovPopoverContent(cov) {
  const BW_OPT = [{ code:'0', label:'None' }, { code:'1', label:'Yes' }];
  const SW_OPT = [
    { code:'00', label:'None' }, { code:'10', label:'Left' },
    { code:'01', label:'Right' }, { code:'11', label:'Both' }
  ];
  const TC_OPT = [{ code:'0', label:'None' }, { code:'1', label:'Yes' }];

  const mkRow = (label, key, opts, cur) => `
    <div class="cov-row">
      <span class="cov-label">${label}</span>
      <div class="cov-options">
        ${opts.map(o => `<button class="cov-opt ${cur === o.code ? 'active' : ''}"
          onclick="_segSetCov('${key}','${o.code}')">${o.label}</button>`).join('')}
      </div>
    </div>`;

  return `<div class="seg-popover-cov">
    ${mkRow('Back Wall',  'bw', BW_OPT, cov.bw || '0')}
    ${mkRow('Side Walls', 'sw', SW_OPT, cov.sw || '00')}
    ${mkRow('Top & Floor','tc', TC_OPT, cov.tc || '0')}
    <div style="padding:8px 12px">
      <button class="btn btn-primary" onclick="_closeSegmentPopover()"
        style="width:100%;font-size:11px;padding:5px 0">Done</button>
    </div>
  </div>`;
}

/* ── Segment value setters ───────────────────────────── */

function _segSet(index, value) {
  const keys = ['pr', 'he', 'de', null, null, 'as', 'cl'];
  const key  = keys[index];
  if (!key) return;
  Cabinet.wizardSelections[key] = value;

  // When DE changes, reset doors to defaults for new DE
  if (index === 2 && Cabinet.wizardSelections.doors) {
    const cfg = _getDoorConfig(value);
    const d   = Cabinet.wizardSelections.doors;
    if (cfg.ld === 'none') d.ld = '0';
    if (!cfg.md)           delete d.md;   // remove md if not 15DAS
    if (cfg.rd === 'none') d.rd = '0';
  }

  _closeSegmentPopover();
  _applySelectionsToCode();
}

function _segSetPR(pr) {
  const s = Cabinet.wizardSelections;
  s.pr = pr;
  if (pr !== 'EZR_CL') {
    delete s.cov;
    delete s.doors;
    if (pr === 'EZR_FR' || pr === 'EZR_OP') s.cl = 'GY';
  } else {
    if (!s.doors) s.doors = { ld:'0', rd:'0' };
    if (!s.cov)   s.cov   = { bw:'0', sw:'00', tc:'0' };
  }
  _closeSegmentPopover();
  _applySelectionsToCode();
}

function _segSetDoor(side, code) {
  const s = Cabinet.wizardSelections;
  if (!s.doors) s.doors = { ld:'0', rd:'0' };
  s.doors[side] = code;
  _applySelectionsToCode();
  // Defer innerHTML replacement until after the click event has fully bubbled —
  // replacing it synchronously detaches e.target, causing the outside-click
  // handler to wrongly close the popover.
  setTimeout(() => {
    const popover = document.getElementById('segmentPopover');
    if (popover && popover.classList.contains('open')) {
      popover.innerHTML = _buildPopoverContent(3);
    }
  }, 0);
}

function _segSetCov(key, val) {
  const s = Cabinet.wizardSelections;
  if (!s.cov) s.cov = {};
  s.cov[key] = val;
  // Re-render popover in place (don't close)
  const popover = document.getElementById('segmentPopover');
  if (popover && popover.classList.contains('open')) {
    popover.innerHTML = _buildPopoverContent(4);
  }
  _applySelectionsToCode();
}

/**
 * Rebuilds the description code from current wizardSelections,
 * then builds the 3D cabinet if valid or clears it if not.
 */
function _applySelectionsToCode() {
  const s = Cabinet.wizardSelections;

  // Ensure doors/cov are in correct state
  if (s.pr === 'EZR_FR' || s.pr === 'EZR_OP') {
    s.cov   = null;
    s.doors = null;
  } else if (s.pr === 'EZR_CL') {
    if (!s.doors) s.doors = { ld:'0', rd:'0' };
    if (!s.cov)   s.cov   = { bw:'0', sw:'00', tc:'0' };
  }

  const code    = buildCode(s);
  const isValid = code ? validateCode(code).valid : false;

  _renderCodeEditor();

  if (isValid) {
    _onValidCode(code);
  } else {
    Cabinet.isCodeValid     = false;
    Cabinet.descriptionCode = '';
    _renderCurrentCodeRow('');
    _setUseConfigBtn(false);
    if (_lastBuiltCode && window.CabinetBuilder) {
      CabinetBuilder.clearAssembly();
      _lastBuiltCode = null;
    }
  }
}

function _applyValidationState({ valid, msg }) {
  const dot   = document.getElementById('validationDot');
  const msgEl = document.getElementById('validationMsg');
  if (!dot || !msgEl) return;
  const neutral = msg === 'Select all segments to configure' || msg === 'Select Product' ||
                  msg === 'Select Height' || msg === 'Select Design' ||
                  msg === 'Select Assembly' || msg === 'Select Colour';
  dot.className     = 'validation-dot' + (valid ? ' valid' : neutral ? '' : ' invalid');
  msgEl.textContent = msg;
  msgEl.style.color = valid ? 'var(--color-success)' : neutral ? '' : 'var(--color-danger)';
}

function _resetCodeState() {
  Cabinet.wizardSelections = {};
  _renderCodeEditor();
  _applyValidationState({ valid: false, msg: 'Select all segments to configure' });
  _setUseConfigBtn(false);
  const input = document.getElementById('currentCodeValue');
  if (input && document.activeElement !== input) {
    input.value = '';
    input.classList.remove('valid', 'invalid');
  }
}

function _setUseConfigBtn(enabled) {
  const btn = document.getElementById('useConfigBtn');
  if (btn) btn.disabled = !enabled;
}

function _afterCodeComplete() {
  _onValidCode(Cabinet.descriptionCode);
}

/**
 * Called whenever a valid code is produced (wizard or text input).
 * Writes to state immediately — no confirmation needed.
 */
function _onValidCode(code) {
  // ── If new cabinet (not editing): push to cabinets[] and start editing it ──
  if (Cabinet.editingIdx < 0) {
    const newIdx = Cabinet.cabinets.length;
    Cabinet.cabinets.push({
      code,
      xOffset: Cabinet.currentCabinetXOffset,
      rowIdx:  Cabinet.activeRowIdx ?? 0,
      placedAccessories: [],
      label: `ODF #${newIdx + 1}`,
    });
    Cabinet.editingIdx  = newIdx;
    _editBaseOffsets    = Cabinet.cabinets.map(c => c.xOffset);
    _editBaseWidth      = CabinetBuilder.parseCode(code)?.widthMM ?? 0;
  } else {
    // ── Editing existing: shift neighbours if width changed, then update code ──
    _shiftCabinetsIfWidthChanged(code);
    Cabinet.cabinets[Cabinet.editingIdx].code = code;
    Cabinet.currentCabinetXOffset = Cabinet.cabinets[Cabinet.editingIdx].xOffset;
  }

  Cabinet.descriptionCode = code;
  Cabinet.isCodeValid     = true;

  _renderCodeEditor();
  _renderCurrentCodeRow(code);
  completeStep('step1');
  _setUseConfigBtn(true);
  if (window.CabinetDrag) CabinetDrag.clear();
  _rebuildBOM();
  // Skip build while preset gallery is rendering — gallery cleanup will build after abort
  if (window.CabinetBuilder && !_presetsActive) CabinetBuilder.build(code, { xOffset: Cabinet.currentCabinetXOffset, noFitCamera: true });
  _lastBuiltCode = code;
}

function _renderCurrentCodeRow(code) {
  const input = document.getElementById('currentCodeValue');
  if (!input || document.activeElement === input) return;
  input.value = code || '';
  input.classList.remove('valid', 'invalid');
  if (code) input.classList.add('valid');
}

/* ══════════════════════════════════════════════════════
   WIZARD MODAL  (multi-step)
══════════════════════════════════════════════════════ */
let _wiz = { step: 1, totalSteps: 5, sel: {} };

const WIZARD_STEPS_NOCL  = [1,2,3,6];
const WIZARD_STEPS_CL    = [1,2,3,4,5,6,7];

function openWizard() {
  _wiz = { step: 1, totalSteps: 5, sel: { ...Cabinet.wizardSelections } };
  openModal('wizardModal');
  _wizRender();
}

function _wizSteps() {
  const pr = _wiz.sel.pr;
  return pr === 'EZR_CL' ? WIZARD_STEPS_CL : WIZARD_STEPS_NOCL;
}

function _wizCurrentIndex() { return _wiz.step - 1; }

function _wizRender() {
  const steps = _wizSteps();
  const stepId = steps[_wizCurrentIndex()];
  _wiz.totalSteps = steps.length;

  document.getElementById('wizProgress').textContent =
    `Step ${_wiz.step} of ${_wiz.totalSteps}`;
  const pct = (_wiz.step / _wiz.totalSteps) * 100;
  document.getElementById('wizProgressBar').style.width = pct + '%';

  document.querySelectorAll('.wiz-panel').forEach(p => p.style.display = 'none');
  const panel = document.getElementById('wizPanel' + stepId);
  if (panel) {
    panel.style.display = 'block';
    _wizFillPanel(stepId);
  }

  document.getElementById('wizBack').style.visibility = _wiz.step > 1 ? 'visible' : 'hidden';
  const nextBtn = document.getElementById('wizNext');
  nextBtn.textContent = _wiz.step === _wiz.totalSteps ? 'Finish' : 'Next →';

  const s = _wiz.sel;
  let covSeg = null;
  if (s.de) {
    if (s.pr !== 'EZR_CL') {
      covSeg = 'D000B0S00T0';
    } else if (s.doors || s.cov) {
      const doorsCode = s.doors
        ? (s.de === '15DAS'
            ? `D${s.doors.ld||'0'}${s.doors.md||'0'}${s.doors.rd||'0'}`
            : `D${s.doors.ld||'0'}0${s.doors.rd||'0'}`)
        : 'D000';
      const wallsCode = s.cov
        ? `B${s.cov.bw||'0'}S${s.cov.sw||'00'}T${s.cov.tc||'0'}`
        : 'B0S00T0';
      covSeg = doorsCode + wallsCode;
    }
  }
  const cl = s.pr !== 'EZR_CL' && s.as ? 'GY' : s.cl;
  const allSegs = [
    { value: s.pr,   label: 'Product'  },
    { value: s.he,   label: 'Height'   },
    { value: s.de,   label: 'Design'   },
    { value: covSeg, label: 'Covering' },
    { value: s.as,   label: 'Assembly' },
    { value: cl,     label: 'Colour'   },
  ].filter(seg => seg.value);
  document.getElementById('wizCodePreview').innerHTML = allSegs.map(seg => `
    <div class="wiz-code-segment">
      <div class="wiz-seg-value">${seg.value}</div>
      <div class="wiz-seg-label">${seg.label}</div>
    </div>`).join('') || '…';
}

function _wizFillPanel(stepId) {
  const sel = _wiz.sel;
  if (stepId === 1) {
    document.querySelectorAll('[data-wiz-pr]').forEach(el => {
      el.classList.toggle('selected', el.dataset.wizPr === sel.pr);
    });
  } else if (stepId === 2) {
    document.querySelectorAll('[data-wiz-he]').forEach(el => {
      el.classList.toggle('selected', el.dataset.wizHe === sel.he);
    });
    const pr = sel.pr || 'EZR_FR';
    const img = document.getElementById('wizHeightImg');
    img.src = `images/wizard/${pr}-heights.png`;
    img.alt = pr;
  } else if (stepId === 3) {
    _renderWizDE();
  } else if (stepId === 4) {
    _renderWizCovDoors();
  } else if (stepId === 5) {
    _renderWizCovWalls();
  } else if (stepId === 6) {
    const is15xx = sel.de?.startsWith('15');
    document.querySelectorAll('[data-wiz-as]').forEach(el => {
      const code = el.dataset.wizAs;
      // Show E only for 15xx; hide A/B/C for 15xx
      if (code === 'E') {
        el.style.display = is15xx ? '' : 'none';
      } else {
        el.style.display = is15xx ? 'none' : '';
      }
      el.classList.toggle('selected', code === sel.as);
    });
  } else if (stepId === 7) {
    document.querySelectorAll('[data-wiz-cl]').forEach(el => {
      el.classList.toggle('selected', el.dataset.wizCl === sel.cl);
    });
  }
}

function _renderWizDE() {
  const pr = _wiz.sel.pr || 'EZR_FR';
  const container = document.getElementById('wizDEOptions');
  const opts = getDeOptions(pr);
  container.innerHTML = opts.map(d => `
    <button class="wiz-de-card ${_wiz.sel.de === d.code ? 'selected' : ''}"
            onclick="_wizSelectDE('${d.code}')">
      <div class="wiz-de-label">${d.label}</div>
      <div class="wiz-de-desc">${d.desc}</div>
    </button>`).join('');

  const imgWrap = document.getElementById('wizDEImgWrap');
  if (pr === 'EZR_FR' || pr === 'EZR_OP') {
    document.getElementById('wizDEImg').src = `images/wizard/${pr}-designs.png`;
    imgWrap.style.display = 'block';
    container.classList.add('wiz-de-grid--row');
  } else {
    imgWrap.style.display = 'none';
    container.classList.remove('wiz-de-grid--row');
  }
}

function _renderWizCovDoors() {
  const cov = _wiz.sel.cov || {};
  const mkDoor = (side, key) => `
    <div class="cov-row">
      <span class="cov-label">${side} Door</span>
      <div class="cov-options">${DOOR_OPTS.map(o => `
        <button class="cov-opt ${(cov[key]||'0') === o.code ? 'active' : ''}"
                onclick="_wizSetCov('${key}','${o.code}')">${o.label}</button>`).join('')}
      </div>
    </div>`;
  document.getElementById('wizCovDoors').innerHTML =
    mkDoor('Left', 'ld') + mkDoor('Right', 'rd');
}

function _renderWizCovWalls() {
  const cov = _wiz.sel.cov || {};
  const swOpts = [
    { code:'00', label:'None' }, { code:'10', label:'Left' },
    { code:'01', label:'Right' }, { code:'11', label:'Both' }
  ];
  const tcOpts = [
    { code:'0', label:'None' }, { code:'1', label:'Brush top + solid floor' }
  ];
  document.getElementById('wizCovWalls').innerHTML = `
    <div class="cov-row">
      <span class="cov-label">Back Wall</span>
      <div class="cov-options">
        <button class="cov-opt ${(cov.bw||'0')==='0'?'active':''}" onclick="_wizSetCov('bw','0')">None</button>
        <button class="cov-opt ${(cov.bw||'0')==='1'?'active':''}" onclick="_wizSetCov('bw','1')">Yes</button>
      </div>
    </div>
    <div class="cov-row">
      <span class="cov-label">Side Walls</span>
      <div class="cov-options">
        ${swOpts.map(o => `<button class="cov-opt ${(cov.sw||'00')===o.code?'active':''}"
                onclick="_wizSetCov('sw','${o.code}')">${o.label}</button>`).join('')}
      </div>
    </div>
    <div class="cov-row">
      <span class="cov-label">Top & Floor</span>
      <div class="cov-options">
        ${tcOpts.map(o => `<button class="cov-opt ${(cov.tc||'0')===o.code?'active':''}"
                onclick="_wizSetCov('tc','${o.code}')">${o.label}</button>`).join('')}
      </div>
    </div>`;
}

function wizSelectPR(pr) {
  _wiz.sel.pr = pr;
  delete _wiz.sel.de;
  if (pr !== 'EZR_CL') delete _wiz.sel.cov;
  document.querySelectorAll('[data-wiz-pr]').forEach(el =>
    el.classList.toggle('selected', el.dataset.wizPr === pr));
  _wiz.totalSteps = _wizSteps().length;
  document.getElementById('wizProgress').textContent =
    `Step ${_wiz.step} of ${_wiz.totalSteps}`;
}

function wizSelectHE(he) {
  _wiz.sel.he = he;
  document.querySelectorAll('[data-wiz-he]').forEach(el =>
    el.classList.toggle('selected', el.dataset.wizHe === he));
}

function _wizSelectDE(code) {
  const prev = _wiz.sel.de;
  _wiz.sel.de = code;
  // Keep AS in sync with 15DAS requirement
  if (code.startsWith('15')) {
    _wiz.sel.as = 'E'; // force Two-box for 1500mm designs
  } else if (prev?.startsWith('15') && _wiz.sel.as === 'E') {
    delete _wiz.sel.as; // clear E when leaving 1500mm design
  }
  _renderWizDE();
}

function _wizSetCov(key, val) {
  if (!_wiz.sel.cov) _wiz.sel.cov = {};
  _wiz.sel.cov[key] = val;
  const stepId = _wizSteps()[_wizCurrentIndex()];
  if (stepId === 4) _renderWizCovDoors();
  if (stepId === 5) _renderWizCovWalls();
}

function wizSelectAS(code) {
  _wiz.sel.as = code;
  document.querySelectorAll('[data-wiz-as]').forEach(el =>
    el.classList.toggle('selected', el.dataset.wizAs === code));
}

function wizSelectCL(code) {
  _wiz.sel.cl = code;
  document.querySelectorAll('[data-wiz-cl]').forEach(el =>
    el.classList.toggle('selected', el.dataset.wizCl === code));
}

function wizNext() {
  const steps  = _wizSteps();
  const stepId = steps[_wizCurrentIndex()];
  const msg    = _wizValidateStep(stepId);
  if (msg) { showToast(msg, 'error'); return; }

  if (_wiz.step < _wiz.totalSteps) {
    _wiz.step++;
    _wizRender();
  } else {
    _wizFinish();
  }
}

function wizBack() {
  if (_wiz.step > 1) { _wiz.step--; _wizRender(); }
}

function _wizValidateStep(stepId) {
  const s = _wiz.sel;
  if (stepId === 1 && !s.pr) return 'Select a cabinet type';
  if (stepId === 2 && !s.he) return 'Select a height';
  if (stepId === 3 && !s.de) return 'Select a design';
  if (stepId === 6 && !s.as) return 'Select assembly type';
  if (stepId === 6 && s.as === 'E' && !s.de?.startsWith('15')) return 'Assembly E is only valid for 1500mm width designs';
  if (stepId === 6 && s.as !== 'E' && s.de?.startsWith('15')) return '1500mm design requires Assembly E (Two-box)';
  if (stepId === 7 && !s.cl) return 'Select a colour';
  if (stepId === 7 && s.cl && (s.pr === 'EZR_FR' || s.pr === 'EZR_OP') && s.cl !== 'GY')
    return 'Frame and Open types can only be Grey (GY)';
  return null;
}

function _wizFinish() {
  const s = _wiz.sel;
  if (s.pr !== 'EZR_CL') s.cl = 'GY';
  if (s.pr === 'EZR_CL' && !s.cov) s.cov = { ld:'0', rd:'0', bw:'0', sw:'00', tc:'0' };
  Cabinet.wizardSelections = { ...s };
  const code = buildCode(s);
  if (!code) { showToast('Configuration incomplete', 'error'); return; }
  Cabinet.descriptionCode = code;
  Cabinet.isCodeValid     = true;
  _afterCodeComplete();
  closeModal('wizardModal');
  useEZRConfig();
}

window._wizSelectDE = _wizSelectDE;
window._wizSetCov   = _wizSetCov;

/* ══════════════════════════════════════════════════════
   STEP 2 — COVERING
══════════════════════════════════════════════════════ */
function _renderCovering() {
  const s  = Cabinet.wizardSelections;
  const pr = s.pr;

  const infoEl = document.getElementById('coveringInfo');
  const ctrlEl = document.getElementById('coveringControls');
  const autoEl = document.getElementById('coveringAuto');

  if (!pr) {
    infoEl.style.display = 'block';
    ctrlEl.style.display = 'none';
    autoEl.style.display = 'none';
    infoEl.textContent   = 'Complete Step 1 first.';
    return;
  }

  if (pr === 'EZR_FR' || pr === 'EZR_OP') {
    infoEl.style.display = 'block';
    ctrlEl.style.display = 'none';
    autoEl.style.display = 'block';
    infoEl.textContent   = `Covering not available for ${PR_TYPES[pr].label} type.`;
    return;
  }

  infoEl.style.display = 'none';
  autoEl.style.display = 'none';
  ctrlEl.style.display = 'block';
  _renderCoveringControls(s.cov || {});
}

function _renderCoveringControls(cov) {
  const swOpts = [
    { code:'00', label:'None' }, { code:'10', label:'Left' },
    { code:'01', label:'Right' }, { code:'11', label:'Both' }
  ];
  const tcOpts = [{ code:'0', label:'None' }, { code:'1', label:'Brush top + solid floor' }];

  const mkRow = (label, key, opts) => `
    <div class="cov-row">
      <span class="cov-label">${label}</span>
      <div class="cov-options">
        ${opts.map(o => `<button class="cov-opt ${(cov[key]||opts[0].code)===o.code?'active':''}"
          onclick="setCovering('${key}','${o.code}')">${o.label}</button>`).join('')}
      </div>
    </div>`;

  document.getElementById('coveringControls').innerHTML =
    mkRow('Left Door',   'ld', DOOR_OPTS) +
    mkRow('Right Door',  'rd', DOOR_OPTS) +
    mkRow('Back Wall',   'bw', [{code:'0',label:'None'},{code:'1',label:'Yes'}]) +
    mkRow('Side Walls',  'sw', swOpts) +
    mkRow('Top & Floor', 'tc', tcOpts);
}

function setCovering(key, val) {
  if (!Cabinet.wizardSelections.cov) Cabinet.wizardSelections.cov = {};
  Cabinet.wizardSelections.cov[key] = val;
  _renderCoveringControls(Cabinet.wizardSelections.cov);
  _rebuildCodeFromSelections();
}

function _rebuildCodeFromSelections() {
  const s    = Cabinet.wizardSelections;
  const code = buildCode(s);
  if (!code) return;
  Cabinet.descriptionCode = code;
  _renderCurrentCodeRow(code);
  _renderCodeEditor();
  _rebuildBOM();
}

window.setCovering = setCovering;

/* ══════════════════════════════════════════════════════
   STEP ACCORDION
══════════════════════════════════════════════════════ */
function toggleStep(stepId) {
  const step = document.getElementById(stepId);
  if (!step || step.classList.contains('locked')) return;
  step.classList.toggle('collapsed');
}

function activateStep(stepId) {
  document.getElementById(stepId)?.classList.remove('locked','collapsed');
}

function unlockStep(stepId) {
  document.getElementById(stepId)?.classList.remove('locked');
}

function completeStep(stepId) {
  document.getElementById(stepId)?.classList.add('completed');
}

/* ══════════════════════════════════════════════════════
   STEP 3 — MOUNTING PLATES
══════════════════════════════════════════════════════ */
function openPlateConfigurator() {
  window.open('configurator.html', '_blank');
  showToast('Mounting plate configurator opened in new tab','info');
}

function _renderPlatesList() {
  const list = document.getElementById('platesList');
  if (!Cabinet.mountingPlates.length) {
    list.innerHTML = '<div class="plates-empty">No mounting plates configured yet.</div>';
    return;
  }
  list.innerHTML = Cabinet.mountingPlates.map((p, i) => `
    <div class="plate-item">
      <div class="plate-icon">🔧</div>
      <div class="plate-info">
        <div class="plate-name">${p.name || 'Mounting Plate ' + (i+1)}</div>
        <div class="plate-meta">${p.accessoryCount || 0} accessories</div>
      </div>
      <div class="plate-actions">
        <button class="icon-btn edit" onclick="editPlate(${i})" title="Edit">✎</button>
        <button class="icon-btn"     onclick="removePlate(${i})" title="Remove">✕</button>
      </div>
    </div>`).join('');
}

function removePlate(i) {
  Cabinet.mountingPlates.splice(i, 1);
  _renderPlatesList();
  _rebuildBOM();
}
function editPlate(_i) { window.open('configurator.html','_blank'); }

window.removePlate = removePlate;
window.editPlate   = editPlate;

/* ══════════════════════════════════════════════════════
   STEP 4 — BOM & EXPORT
══════════════════════════════════════════════════════ */
function _rebuildBOM() {
  // Aggregate cabinets by code, accessories by code across all cabinets
  const cabQty = {}, accQty = {};

  const allCabs = [
    ...Cabinet.cabinets.map((cab) => ({
      ...cab,
      placedAccessories: cab.placedAccessories || [],
    })),
  ];

  for (const cab of allCabs) {
    cabQty[cab.code] = (cabQty[cab.code] || 0) + 1;
    for (const a of (cab.placedAccessories || [])) {
      accQty[a.code] = (accQty[a.code] || 0) + 1;
    }
  }

  const items = [];
  for (const [code, qty] of Object.entries(cabQty)) {
    const p = CabinetBuilder.parseCode(code);
    const prInfo = PR_TYPES[p?.pr] || {};
    items.push({ name: `Cabinet (${prInfo.label || p?.pr || code})`, code, qty });
  }
  for (const [code, qty] of Object.entries(accQty)) {
    const cat = ACCESSORY_CATALOG.find(a => a.code === code);
    items.push({ name: cat?.label || code, code, qty });
  }

  Cabinet.mountingPlates.forEach((p, i) => {
    items.push({ name: p.name || `Mounting Plate ${i+1}`, code: p.code || '–', qty: 1 });
  });

  Cabinet.bom = items;
  _renderBOM();
  document.getElementById('bomCount').textContent = items.length;
}

window.CabinetUI = { rebuildBOM: _rebuildBOM };

function _renderBOM() {
  const tbody = document.getElementById('bomTableBody');
  if (!Cabinet.bom.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="bom-empty">Configure cabinet first</td></tr>';
    return;
  }
  tbody.innerHTML = Cabinet.bom.map(item => `
    <tr>
      <td>${item.name}</td>
      <td><code style="font-size:10px;letter-spacing:0.03em">${item.code}</code></td>
      <td style="text-align:right">${item.qty}</td>
    </tr>`).join('');
}

function saveConfig() {
  const ctrl = window.CabinetControls;
  const data = {
    projectName: Cabinet.projectName,
    savedAt:     new Date().toISOString(),
    camera: ctrl ? {
      theta:  ctrl.getTheta(),
      phi:    ctrl.getPhi(),
      radius: ctrl.getRadius(),
      target: { x: ctrl.getTarget().x, y: ctrl.getTarget().y, z: ctrl.getTarget().z },
    } : null,
    rows:     Cabinet.rows.map(r => ({ id: r.id, origin: { x: r.origin.x, z: r.origin.z }, angle: r.angle, flipped: r.flipped })),
    cabinets: Cabinet.cabinets.map(c => ({
      code:              c.code,
      xOffset:           c.xOffset,
      rowIdx:            c.rowIdx ?? 0,
      label:             c.label,
      cloneGroupId:      c.cloneGroupId,
      placedAccessories: (c.placedAccessories || []).map(a => ({ code: a.code, snapId: a.snapId, parentSnapId: a.parentSnapId ?? null, parentType: a.parentType ?? null, rotated: a.rotated ?? false })),
      placedChassis:     (c.placedChassis || []).map(ch => ({ code: ch.code, slotIdx: ch.slotIdx, heightU: ch.heightU })),
    })),
  };
  _downloadJSON(data, `${Cabinet.projectName.replace(/\s+/g,'-')}_config.json`);
  showToast('Configuration saved', 'success');
}

async function _applyConfig(data) {
  if (!Array.isArray(data.cabinets)) { showToast('Invalid config file', 'error'); return; }

  CabinetBuilder.clearAll({ noFade: true });
  if (window.CabinetDrag)    CabinetDrag.clearAll();
  if (window.CabinetChassis) CabinetChassis.clearAll();
  if (window.CabinetFloor)   CabinetFloor.clear?.();

  Cabinet.projectName           = data.projectName || 'Imported Project';
  Cabinet.rows                  = data.rows || [{ id: 0, origin: { x: 0, z: 0 }, angle: 0, flipped: false }];
  Cabinet.cabinets              = data.cabinets;
  Cabinet.activeRowIdx          = 0;
  Cabinet.editingIdx            = -1;
  Cabinet.descriptionCode       = '';
  Cabinet.isCodeValid           = false;
  Cabinet.placedAccessories     = [];
  Cabinet.placedChassis         = [];
  Cabinet.currentCabinetXOffset = 0;

  await CabinetBuilder.rebuildAllCabinetsFromState();
  if (window.CabinetArrow) CabinetArrow.rebuildAll?.();
  if (window.CabinetFloor) CabinetFloor.update?.();

  // Position next new cabinet after the rightmost existing one in row 0
  Cabinet.currentCabinetXOffset = _confirmedRightEdge();

  if (data.camera && window.CabinetControls) {
    const c = data.camera;
    CabinetControls.setView(c.theta, c.phi, c.radius);
    if (c.target) CabinetControls.setTarget(new THREE.Vector3(c.target.x, c.target.y, c.target.z));
  }

  _resetForNextCabinet();
  _rebuildBOM();
  if (window.CabinetUI) CabinetUI.updateCabinetList?.();
  showToast('Project loaded: ' + Cabinet.projectName, 'success');
}

function loadConfig() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      await _applyConfig(data);
    } catch (err) {
      showToast('Failed to load config: ' + err.message, 'error');
    }
  };
  input.click();
}

async function loadExample(path) {
  try {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    await _applyConfig(data);
  } catch (err) {
    showToast('Failed to load example: ' + err.message, 'error');
  }
}

function exportBOM() {
  if (!Cabinet.bom.length) { showToast('BOM is empty','error'); return; }
  const rows = ['Item,Code,Qty',
    ...Cabinet.bom.map(r => `"${r.name}","${r.code}",${r.qty}`)].join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([rows],{type:'text/csv'})),
    download: `${Cabinet.projectName.replace(/\s+/g,'-')}_BOM.csv`
  });
  a.click();
  showToast('BOM exported as CSV','success');
}

const ACCESSORY_CATALOG = [
  { code: 'EZR_CBFX',             label: 'Cable Fixator',         desc: 'Cable fixation plate' },
  { code: 'EZR_MDL-L87-NT',       label: 'Module 87 mm',          desc: 'Short mandrel' },
  { code: 'EZR_MDL-L224-NT',      label: 'Module 224 mm',         desc: 'Long mandrel' },
  { code: 'EZR_RET',              label: 'Retaining Clip',        desc: 'Cable retainer' },
  { code: 'EZR_ROUT-BRKT',        label: 'Routing Bracket',       desc: 'Cable routing bracket' },
  { code: 'EZR_ROUT-PLT',         label: 'Routing Plate',         desc: 'Attaches to Routing Bracket' },
  { code: 'EZR_SEP_PLT-4U-horiz', label: 'Separator Plate 4U H', desc: 'Separator plate, 4U' },
  { code: 'EZR_SEP_PLT-4U',       label: 'Separator Plate 4U',   desc: 'Separator plate, 4U' },
  { code: 'EZR_TBRKT',            label: 'EZR-TBRKT',            desc: 'Tie bracket' },
  { code: 'EZR_CAB_EXT',         label: 'Cabinet Extender',      desc: 'Cable exit' },
];

const _accThumbs      = {};   // code → dataURL cache
let _accThumbsActive  = false;

function _safeThumbId(code) { return 'accThumb_' + code.replace(/[^a-zA-Z0-9]/g, '_'); }

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
      s.mesh.geometry.setDrawRange(0, Math.floor(s.current));
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

  function buildCables(cables, anim = {}) {
    if (!_cableGroup) return;
    // Dispose existing cable meshes, sphere geometries and label textures
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
    _cableAnimMode  = anim.mode || 'sequential';

    const animated = anim.enabled !== false;
    const duration = anim.duration || 0.6; // seconds per cable (sequential) / total (parallel)
    const MM = 0.001;

    cables.forEach((cable, ci) => {
      if (!cable.points || cable.points.length < 2) return;
      const pts   = cable.points.map(p => new THREE.Vector3(p.x * MM, p.y * MM, p.z * MM));
      const curve = new THREE.CatmullRomCurve3(pts);
      const geom  = new THREE.TubeGeometry(
        curve,
        cable.tubularSegments || 48,
        (cable.radius || 4) * MM,
        cable.radialSegments  || 6,
        false
      );
      const mat  = new THREE.MeshStandardMaterial({ color: cable.color || '#222222' });
      const mesh = new THREE.Mesh(geom, mat);
      _cableGroup.add(mesh);

      const total = geom.index ? geom.index.count : 0;
      const speed = total / (duration * 60);
      if (animated && total > 0) geom.setDrawRange(0, 0);
      _cableAnimState.push({ mesh, total, current: animated ? 0 : total, speed,
                             active: false, done: !animated });

      // Red spheres + labels at each control point (only in edit mode)
      if (window.PreviewPointsEditVisible !== false) {
        const sr          = (cable.radius || 4) * 1.6 * MM;
        const labelSize   = sr * 5;
        const labelOffset = sr * 2.5;
        pts.forEach((pt, pi) => {
          const sg = new THREE.SphereGeometry(sr, 8, 6);
          const sm = new THREE.Mesh(sg, _sphereMat);
          sm.position.copy(pt);
          sm.renderOrder = 1;
          _cableGroup.add(sm);

          const sprite = _makeLabelSprite(`${ci}-${pi}`, labelSize);
          sprite.position.set(pt.x + labelOffset, pt.y + labelOffset, pt.z);
          _cableGroup.add(sprite);
        });
      }
    });

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
      s.mesh.geometry.setDrawRange(0, 0);
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

  return { start, stop, loadAccessory, loadPreset, buildCables, replayAnimation, applyCamera, getCamera };
})();

/* ══════════════════════════════════════════════════════
   CABLES EDITOR — live editing of cable paths in preview
════════════════════════════════════════════════════════ */
const _CablesEditor = (() => {
  let _code    = null;
  let _config  = null;   // working deep-copy of PreviewCablesConfig[code]

  function open(code) {
    _code = code;
    const src = window.PreviewCablesConfig && window.PreviewCablesConfig[code];
    if (!src) { _hide(); return; }
    _config = JSON.parse(JSON.stringify(src));
    _render();
    if (window.PreviewPointsEditVisible !== false)
      document.getElementById('cablesEditor').style.display = 'block';
    _apply();
  }

  function close() {
    _hide();
    _code = _config = null;
  }

  function _hide() {
    const el = document.getElementById('cablesEditor');
    if (el) el.style.display = 'none';
  }

  function _apply() {
    if (_config) _PreviewScene.buildCables(_config.cables, _config.animation || {});
  }

  function _render() {
    const el = document.getElementById('cablesEditor');
    if (!el || !_config) return;
    el.innerHTML =
      `<div class="ce-header">
        <span>Cables <span style="font-weight:400;font-size:10px;color:#aaa">(mm)</span></span>
        <button class="ce-btn" onclick="_CablesEditor.addCable()">+ Add</button>
      </div>` +
      _config.cables.map((cable, ci) =>
        `<div class="ce-cable">
          <div class="ce-cable-head">
            <span>Cable ${ci + 1}</span>
            <input type="color" value="${cable.color}"
              onchange="_CablesEditor.setCableColor(${ci}, this.value)" title="Color">
            <label style="font-size:11px">r mm<input type="number" value="${cable.radius}" step="0.5" min="0.5" style="width:48px;margin-left:3px"
              onchange="_CablesEditor.setCableRadius(${ci}, +this.value)"></label>
            <button class="ce-btn ce-btn-del" onclick="_CablesEditor.removeCable(${ci})">✕</button>
          </div>
          <table class="ce-table">
            <tr><th>#</th><th>X</th><th>Y</th><th>Z</th><th></th></tr>
            ${cable.points.map((pt, pi) =>
              `<tr>
                <td style="color:#aaa;font-size:10px">${pi + 1}</td>
                <td><input type="number" value="${+pt.x.toFixed(2)}" step="1"
                  onchange="_CablesEditor.setPoint(${ci},${pi},'x',+this.value)"></td>
                <td><input type="number" value="${+pt.y.toFixed(2)}" step="1"
                  onchange="_CablesEditor.setPoint(${ci},${pi},'y',+this.value)"></td>
                <td><input type="number" value="${+pt.z.toFixed(2)}" step="1"
                  onchange="_CablesEditor.setPoint(${ci},${pi},'z',+this.value)"></td>
                <td><button class="ce-btn ce-btn-del" onclick="_CablesEditor.removePoint(${ci},${pi})">−</button></td>
              </tr>`
            ).join('')}
          </table>
          <button class="ce-btn" onclick="_CablesEditor.addPoint(${ci})">+ Point</button>
        </div>`
      ).join('') +
      `<hr class="ce-divider">
      <button class="ce-btn" style="width:100%;margin-bottom:4px" onclick="_CablesEditor.replay()">▶ Replay animation</button>
      <button class="ce-btn ce-btn-export" onclick="_CablesEditor.exportConfig()">⬇ Copy config</button>`;
  }

  // ── Structural mutations (need full re-render) ──────
  function addCable() {
    const prev = _config.cables[_config.cables.length - 1];
    const base = prev
      ? JSON.parse(JSON.stringify(prev))
      : { color: '#333333', radius: 4, tubularSegments: 48, radialSegments: 6,
          points: [{ x: 0, y: 50, z: 0 }, { x: 0, y: -50, z: 0 }] };
    _config.cables.push(base);
    _render(); _apply();
  }
  function removeCable(ci) { _config.cables.splice(ci, 1); _render(); _apply(); }
  function addPoint(ci) {
    const pts = _config.cables[ci].points;
    const last = pts[pts.length - 1] || { x: 0, y: 0, z: 0 };
    pts.push({ x: last.x + 20, y: last.y, z: last.z });
    _render(); _apply();
  }
  function removePoint(ci, pi) { _config.cables[ci].points.splice(pi, 1); _render(); _apply(); }

  // ── Value mutations (no re-render needed) ──────────
  function setCableColor(ci, val)       { _config.cables[ci].color  = val; _apply(); }
  function setCableRadius(ci, val)      { _config.cables[ci].radius = val; _apply(); }
  function setPoint(ci, pi, axis, val)  { _config.cables[ci].points[pi][axis] = val; _apply(); }

  // ── Export ─────────────────────────────────────────
  function exportConfig() {
    const exported = {
      camera:    _PreviewScene.getCamera(),
      animation: _config.animation || { enabled: true, mode: 'sequential', duration: 0.6 },
      cables:    _config.cables,
    };
    const out = JSON.stringify(exported, null, 2);
    const block = `  '${_code}': ${out},`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(block).then(() => showToast('Config copied to clipboard', 'info'));
    }
  }

  function replay() { _PreviewScene.replayAnimation(); }

  return { open, close, addCable, removeCable, addPoint, removePoint,
           setCableColor, setCableRadius, setPoint, exportConfig, replay };
})();

window._CablesEditor = _CablesEditor;

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

function useEZRConfig() {
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

  return dataURL;
}

function renderSnapshot() {
  const rdr = Cabinet.renderer;
  if (!rdr) { showToast('Nothing to render', 'error'); return; }

  CabinetFloor.setVisible(false);
  if (window.CabinetArrow) CabinetArrow.setVisible(false);
  CabinetBuilder.setHighlightsVisible(false);

  rdr.render(Cabinet.scene, Cabinet.camera);
  const dataURL = rdr.domElement.toDataURL('image/png');

  CabinetFloor.setVisible(true);
  if (window.CabinetArrow) CabinetArrow.setVisible(true);
  CabinetBuilder.setHighlightsVisible(true);

  const a = Object.assign(document.createElement('a'), {
    href: dataURL,
    download: `${(Cabinet.projectName || 'Cabinet').replace(/\s+/g, '-')}_render.png`,
  });
  a.click();
  showToast('Render saved as PNG', 'success');
}

function _downloadJSON(data, filename) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),
    download: filename
  });
  a.click();
}

/* ══════════════════════════════════════════════════════
   MODALS & TOASTS
══════════════════════════════════════════════════════ */
function openModal(id)  { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    _closeSegmentPopover();
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
  }
});

// Close popover on outside click
document.addEventListener('click', e => {
  if (_activePopoverIndex >= 0) {
    const popover = document.getElementById('segmentPopover');
    if (popover && !popover.contains(e.target) && !e.target.closest('.code-segment')) {
      _closeSegmentPopover();
    }
  }
  if (e.target.classList.contains('modal')) e.target.classList.remove('active');
});

function showToast(message, type = 'info') {
  const t = Object.assign(document.createElement('div'), { className:`toast ${type}`, textContent: message });
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 3100);
}

/* ══════════════════════════════════════════════════════
   EDITABLE CURRENT-CODE INPUT
══════════════════════════════════════════════════════ */

/**
 * Extracts all 6 fields from any partially-typed code without rejecting it.
 * Returns a wizardSelections-shaped object. Sets _covInvalid=true when the
 * covering segment is present but doesn't match the required pattern.
 */
function _lenientParseCode(raw) {
  const parts = raw.toUpperCase().split('-');
  const s = {};
  if (parts[0]) s.pr = parts[0];
  if (parts[1]) s.he = parts[1];
  if (parts[2]) s.de = parts[2];
  if (parts[3]) {
    const seg = parts[3];
    // First 4 chars: doors
    // 15DAS has 3 doors: D{ld}{md}{rd}; all others: D{ld}0{rd}
    if (seg.length >= 4) {
      if (s.de === '15DAS') {
        const dm = seg.slice(0, 4).match(/^D(.)(.)(.)$/);
        if (dm) s.doors = { ld: dm[1], md: dm[2], rd: dm[3] };
        else    s._doorsInvalid = true;
      } else {
        const dm = seg.slice(0, 4).match(/^D(.)0(.)$/);
        if (dm) s.doors = { ld: dm[1], rd: dm[2] };
        else    s._doorsInvalid = true;
      }
    }
    // Remaining 7 chars: walls
    if (seg.length > 4) {
      const wm = seg.slice(4).match(/^B(.)S(..)T(.)$/);
      if (wm) s.cov = { bw: wm[1], sw: wm[2], tc: wm[3] };
      else    s._covInvalid = true;
    }
  }
  if (parts[4]) s.as = parts[4];
  if (parts[5]) s.cl = parts[5];
  return s;
}

let _codeInputDebounce = null;

function _initCodeValueInput() {
  const input = document.getElementById('currentCodeValue');
  if (!input) return;

  input.addEventListener('input', function () {
    const raw = this.value.trim();
    clearTimeout(_codeInputDebounce);

    if (!raw) {
      Cabinet.wizardSelections = {};
      Cabinet.descriptionCode  = '';
      Cabinet.isCodeValid      = false;
      _renderCodeEditor();
      input.classList.remove('valid', 'invalid');
      if (_lastBuiltCode && window.CabinetBuilder) {
        CabinetBuilder.clearAssembly();
        _lastBuiltCode = null;
      }
      return;
    }

    // Update segment chips immediately to show where errors are
    const parsed = _lenientParseCode(raw);
    Cabinet.wizardSelections = parsed;
    _renderCodeEditor();

    const code    = buildCode(parsed);
    const isValid = code ? validateCode(code).valid : false;
    input.classList.toggle('valid',   isValid);
    input.classList.toggle('invalid', !isValid);

    _codeInputDebounce = setTimeout(() => {
      if (isValid) {
        Cabinet.descriptionCode = code;
        Cabinet.isCodeValid     = true;
        completeStep('step1');
        _setUseConfigBtn(true);
        _rebuildBOM();
        if (window.CabinetBuilder) CabinetBuilder.build(code, { xOffset: Cabinet.currentCabinetXOffset, noFitCamera: true });
        _lastBuiltCode = code;
      } else {
        Cabinet.isCodeValid     = false;
        Cabinet.descriptionCode = '';
        _setUseConfigBtn(false);
        if (_lastBuiltCode && window.CabinetBuilder) {
          CabinetBuilder.clearAssembly();
          _lastBuiltCode = null;
        }
      }
    }, 600);
  });
}

/* ══════════════════════════════════════════════════════
   DOOR CONTROLS
══════════════════════════════════════════════════════ */
function _updateDoorControls() {
  let hasDoors = false;
  if (Cabinet.scene) {
    Cabinet.scene.traverse(obj => { if (obj.userData && obj.userData.isDoor) hasDoors = true; });
  }
  const panel = document.getElementById('doorControls');
  if (!panel) return;
  panel.style.display = hasDoors ? 'flex' : 'none';
  if (!hasDoors) {
    const opEl = document.getElementById('doorOpacity');
    const anEl = document.getElementById('doorAngle');
    if (opEl) opEl.value = 100;
    if (anEl) anEl.value = 0;
    document.getElementById('doorOpacityVal').textContent = '100%';
    document.getElementById('doorAngleVal').textContent   = '0°';
  }
}

function applyDoorOpacity(value) {
  const pct = Number(value);
  document.getElementById('doorOpacityVal').textContent = pct + '%';
  if (!Cabinet.scene) return;
  Cabinet.scene.traverse(obj => {
    if (!obj.userData || !obj.userData.isDoor) return;
    obj.traverse(child => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => {
        const transparent = pct < 100;
        m.transparent = transparent;
        m.opacity     = pct / 100;
        if (transparent) { m.alphaTest = 0; m.depthWrite = false; }
        else             { m.depthWrite = true; }
        m.needsUpdate = true;
      });
    });
  });
}

function applyDoorAngle(value) {
  const deg = Number(value);
  document.getElementById('doorAngleVal').textContent = deg + '°';
  if (!Cabinet.scene) return;
  const rad = deg * Math.PI / 180;
  Cabinet.scene.traverse(obj => {
    if (!obj.userData || !obj.userData.isDoor) return;
    // Left/middle hinge on left edge: negative Y rotation opens door outward (+Z forward)
    // Right hinge on right edge: positive Y rotation opens door outward
    obj.rotation.y = obj.userData.doorSide === 'right' ? rad : -rad;
  });
}

/* ── Camera status bar ─────────────────────────────── */
(function _cameraStatusLoop() {
  const bar = document.getElementById('cameraStatusbar');
  function fmt(n, dec) { return n.toFixed(dec); }
  function deg(r)       { return fmt(r * 180 / Math.PI, 1) + '°'; }

  function tick() {
    if (bar && window.CabinetControls) {
      try {
        const t = CabinetControls.getTarget();
        bar.innerHTML =
          `<span><span class="csb-key">θ</span><span class="csb-val">${deg(CabinetControls.getTheta())}</span></span>` +
          `<span><span class="csb-key">φ</span><span class="csb-val">${deg(CabinetControls.getPhi())}</span></span>` +
          `<span><span class="csb-key">r</span><span class="csb-val">${fmt(CabinetControls.getRadius(), 3)}</span></span>` +
          `<span><span class="csb-key">target</span><span class="csb-val">(${fmt(t.x,3)}, ${fmt(t.y,3)}, ${fmt(t.z,3)})</span></span>`;
      } catch (_) { /* CabinetControls not yet initialised */ }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

window.addEventListener('cabinetBuilt', () => {
  if (_presetsActive) return;
  _updateDoorControls();
  // Re-apply current door settings to the newly built cabinet
  const opEl = document.getElementById('doorOpacity');
  const anEl = document.getElementById('doorAngle');
  if (opEl) applyDoorOpacity(opEl.value);
  if (anEl) applyDoorAngle(anEl.value);
});

/* ══════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('projectName').addEventListener('input', e => {
    Cabinet.projectName = e.target.value;
  });
  setMode('wizard');
  _renderCodeEditor();
  _renderAccessoryCards();
  _renderBOM();
  _initCodeValueInput();
});

/** Returns the rightmost X edge (mm) across all confirmed cabinets. */
// Base state saved when entering edit mode — used to compute absolute shifts
let _editBaseOffsets = [];  // xOffset (mm) per cabinet at edit-start
let _editBaseWidth   = 0;   // width (mm) of the cabinet being edited at edit-start

/**
 * When editing an existing cabinet and its width changes,
 * reposition all cabinets to the right using absolute offsets (not incremental delta).
 * Safe to call on every keystroke.
 */
function _shiftCabinetsIfWidthChanged(newCode) {
  const idx = Cabinet.editingIdx;
  if (idx < 0 || !_editBaseOffsets.length) return;
  const newP = CabinetBuilder.parseCode(newCode);
  if (!newP) return;
  const delta = newP.widthMM - _editBaseWidth; // always relative to edit-start

  console.group('[Cabinet shift] editingIdx=%d  baseWidth=%d  newWidth=%d  delta=%d',
    idx, _editBaseWidth, newP.widthMM, delta);
  console.log('baseOffsets:', [..._editBaseOffsets]);
  console.log('cabinets before:', Cabinet.cabinets.map((c,i) => `[${i}] ${c.code} x=${c.xOffset}`));

  const editingRowIdx = Cabinet.cabinets[idx]?.rowIdx ?? 0;

  for (let i = idx + 1; i < Cabinet.cabinets.length; i++) {
    // Only shift cabinets in the same row as the one being edited
    if ((Cabinet.cabinets[i].rowIdx ?? 0) !== editingRowIdx) continue;

    const targetOffset = (_editBaseOffsets[i] ?? 0) + delta;
    const currentOffset = Cabinet.cabinets[i].xOffset;
    const diff = targetOffset - currentOffset;
    if (diff === 0) continue;

    Cabinet.cabinets[i].xOffset = targetOffset;
    // After unlockAssembly(idx), _lockedAssemblies has one fewer entry —
    // cabinet at cabinets[i] (i > idx) sits at position i-1 in _lockedAssemblies.
    const grp = CabinetBuilder.getLockedAssembly(i - 1);
    if (grp) {
      const { x, z } = CabinetBuilder.rowWorldPos(targetOffset, editingRowIdx);
      grp.position.x = x;
      grp.position.z = z;
    }
    if (window.CabinetDrag) CabinetDrag.shiftLockedPlaced(i, diff, true);

    // Rebuild highlight mat for this cabinet
    CabinetBuilder.removeLockedHighlight(i);
    const p = CabinetBuilder.parseCode(Cabinet.cabinets[i].code);
    if (p) CabinetBuilder.showLockedHighlight(targetOffset, p.widthMM, i, editingRowIdx);
  }
  console.log('cabinets after:', Cabinet.cabinets.map((c,i) => `[${i}] ${c.code} x=${c.xOffset}`));
  console.groupEnd();
  CabinetFloor.update();
}

function _confirmedRightEdge() {
  const activeRow = Cabinet.activeRowIdx ?? 0;
  let maxX = 0;
  for (const cab of Cabinet.cabinets) {
    if ((cab.rowIdx ?? 0) !== activeRow) continue;
    const p = CabinetBuilder.parseCode(cab.code);
    if (p) maxX = Math.max(maxX, cab.xOffset + p.widthMM);
  }
  return maxX;
}

/** Returns true if [x, x+w] overlaps any confirmed cabinet except skipIdx (tolerance 1 mm). */
function _overlapsConfirmed(xMM, widthMM, skipIdx = -1) {
  const TOL = 1;
  const a0 = xMM + TOL, a1 = xMM + widthMM - TOL;
  const activeRow = Cabinet.activeRowIdx ?? 0;
  for (let i = 0; i < Cabinet.cabinets.length; i++) {
    if (i === skipIdx) continue;
    const cab = Cabinet.cabinets[i];
    if ((cab.rowIdx ?? 0) !== activeRow) continue;
    const p = CabinetBuilder.parseCode(cab.code);
    if (!p) continue;
    const b0 = cab.xOffset + TOL, b1 = cab.xOffset + p.widthMM - TOL;
    if (a0 < b1 && a1 > b0) return true;
  }
  return false;
}

/* ── Accessories → Chassis transition ──────────────────────────────── */
function onGoToChassisStep() {
  if (!Cabinet.isCodeValid || !Cabinet.descriptionCode || Cabinet.editingIdx < 0) {
    showToast('Configure a cabinet first', 'error');
    return;
  }

  activateStep('step3');
  completeStep('step2');
  document.getElementById('step2')?.classList.add('collapsed');

  const el = document.getElementById('step3');
  if (el) el.scrollIntoView({ behavior: 'smooth' });

  if (window.CabinetChassis) {
    CabinetChassis.renderCards();
    CabinetChassis.renderThumbs();
  }
}

/* ── Clone group sync ───────────────────────────────────────────────────
 * After a cabinet is confirmed, copy its code/accessories/chassis to
 * every other cabinet that shares the same cloneGroupId.
 * Called with the index of the just-confirmed cabinet.
 */
function _syncCloneGroup(sourceIdx) {
  const source = Cabinet.cabinets[sourceIdx];
  if (!source?.cloneGroupId) return;

  const targets = Cabinet.cabinets.filter(
    (c, i) => i !== sourceIdx && c.cloneGroupId === source.cloneGroupId
  );
  if (!targets.length) return;

  for (const target of targets) {
    target.code              = source.code;
    target.placedAccessories = source.placedAccessories.map(a => ({ ...a }));
    target.placedChassis     = source.placedChassis.map(c => ({ ...c }));
  }

  // Full clear + rebuild so orphaned meshes from old clone state are removed.
  // This is called only after editingIdx is set to -1, so clearAll is safe.
  if (window.CabinetDrag)    CabinetDrag.clearAll();
  if (window.CabinetChassis) CabinetChassis.clearAll();
  if (window.CabinetBuilder?.rebuildAllCabinetsFromState) {
    CabinetBuilder.rebuildAllCabinetsFromState();
  }

  showToast(`${targets.length} clone${targets.length > 1 ? 's' : ''} updated`, 'info');
}

function onReadyClick() {
  if (!Cabinet.isCodeValid || !Cabinet.descriptionCode || Cabinet.editingIdx < 0) {
    showToast('Configure a cabinet first', 'error'); return;
  }

  const idx = Cabinet.editingIdx;
  const p   = CabinetBuilder.parseCode(Cabinet.descriptionCode);

  if (p && _overlapsConfirmed(Cabinet.cabinets[idx].xOffset, p.widthMM, idx)) {
    showToast('Cabinet overlaps an existing cabinet — cannot place here', 'error');
    return;
  }

  // Save accessory/chassis state into the cabinet object before finalizing
  Cabinet.cabinets[idx].placedAccessories = [...(Cabinet.placedAccessories || [])];
  Cabinet.cabinets[idx].placedChassis     = [...(Cabinet.placedChassis || [])];

  // Finalize chassis and accessories
  if (window.CabinetChassis) CabinetChassis.finalizeCurrent();
  if (window.CabinetDrag) CabinetDrag.finalizeCurrent();

  // Advance currentCabinetXOffset to right edge of the whole row
  Cabinet.currentCabinetXOffset = _confirmedRightEdge();

  // Lock assembly in scene
  CabinetBuilder.lockAssembly();

  // Show locked (dim) highlight
  if (p) CabinetBuilder.showLockedHighlight(Cabinet.cabinets[idx].xOffset, p.widthMM, idx, Cabinet.cabinets[idx].rowIdx ?? 0);

  CabinetFloor.update();

  // Reset active state — ready for new cabinet
  Cabinet.editingIdx        = -1;
  _editBaseOffsets          = [];
  _editBaseWidth            = 0;
  Cabinet.descriptionCode   = '';
  Cabinet.isCodeValid       = false;
  Cabinet.wizardSelections  = {};
  _lastBuiltCode            = null;

  // Propagate changes to all clones (after editingIdx reset, so clearAll is safe)
  _syncCloneGroup(idx);

  _rebuildBOM();
  _resetForNextCabinet();

  const n = Cabinet.cabinets.length;
  showToast(`Cabinet ${n} confirmed — configure cabinet ${n + 1}`, 'success');
}


async function switchToCabinetEdit(idx) {
  if (idx < 0 || idx >= Cabinet.cabinets.length) return;
  if (idx === Cabinet.editingIdx) return; // already editing this one

  /* ── Finalize (lock) whichever cabinet is currently active ── */
  if (Cabinet.editingIdx >= 0) {
    const prevIdx = Cabinet.editingIdx;
    // State is already up to date (accessories synced on every add/remove)
    if (window.CabinetDrag)    CabinetDrag.saveEditBack(prevIdx);
    if (window.CabinetChassis) CabinetChassis.saveEditBack(prevIdx);
    CabinetBuilder.lockAssembly();
    const pp = CabinetBuilder.parseCode(Cabinet.cabinets[prevIdx].code);
    if (pp) CabinetBuilder.showLockedHighlight(Cabinet.cabinets[prevIdx].xOffset, pp.widthMM, prevIdx, Cabinet.cabinets[prevIdx].rowIdx ?? 0);
    // Reset active cabinet state
    Cabinet.editingIdx        = -1;
    _editBaseOffsets          = [];
    _editBaseWidth            = 0;
    Cabinet.descriptionCode   = '';
    Cabinet.isCodeValid       = false;
    Cabinet.wizardSelections  = {};
    _lastBuiltCode            = null;
  }

  /* ── Switch to cabinet idx ── */
  Cabinet.editingIdx = idx;
  // Snapshot base xOffsets for all cabinets so width-change shifts are absolute
  _editBaseOffsets = Cabinet.cabinets.map(c => c.xOffset);
  _editBaseWidth   = CabinetBuilder.parseCode(Cabinet.cabinets[idx].code)?.widthMM ?? 0;
  const cab = Cabinet.cabinets[idx];

  // Switch active row to match the cabinet being edited
  Cabinet.activeRowIdx = cab.rowIdx ?? 0;

  // Move accessories/chassis from _lockedPlaced → _placed, restore green material
  if (window.CabinetDrag)    CabinetDrag.loadForEdit(idx);
  if (window.CabinetChassis) CabinetChassis.loadForEdit(idx);

  // Remove locked assembly and highlight from scene — build() will create a fresh one
  CabinetBuilder.unlockAssembly(idx);
  CabinetBuilder.removeLockedHighlight(idx);

  // Rebuild assembly
  Cabinet.descriptionCode        = cab.code;
  Cabinet.isCodeValid            = true;
  Cabinet.currentCabinetXOffset  = cab.xOffset;
  Cabinet.wizardSelections       = parseCode(cab.code) || {};
  _lastBuiltCode                 = cab.code;

  await CabinetBuilder.build(cab.code, { xOffset: cab.xOffset, rowIdx: cab.rowIdx ?? 0, noFitCamera: true });

  _renderCurrentCodeRow(cab.code);
  _renderCodeEditor();
  _collapseStep1ToCode();
  completeStep('step1');
  activateStep('step2');
  activateStep('step3');
  const btnGoToStep3 = document.getElementById('btnGoToStep3');
  if (btnGoToStep3) btnGoToStep3.style.display = 'none';
  if (window.CabinetChassis) {
    CabinetChassis.renderCards();
    CabinetChassis.renderThumbs();
  }
  unlockStep('step4');
  _setUseConfigBtn(true);
  _rebuildBOM();
  useEZRConfig();
  showToast('Editing cabinet — ' + cab.code, 'info');
}

function _resetForNextCabinet() {
  ['step1','step2','step3'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('completed');
    if (id !== 'step1') el.classList.add('locked', 'collapsed');
  });
  const btnGoToStep3 = document.getElementById('btnGoToStep3');
  if (btnGoToStep3) btnGoToStep3.style.display = '';
  if (window.CabinetChassis) CabinetChassis.clear();
  _resetCodeState();
  _expandStep1?.();
}

/* ══════════════════════════════════════════════════════
   ROW MANAGEMENT
══════════════════════════════════════════════════════ */

/**
 * Switch the active row. New cabinets will be added to this row.
 * Resets currentCabinetXOffset to the right edge of that row.
 */
function switchActiveRow(rowIdx) {
  if (rowIdx < 0 || rowIdx >= Cabinet.rows.length) return;
  Cabinet.activeRowIdx = rowIdx;
  Cabinet.currentCabinetXOffset = _confirmedRightEdge();
  if (window.CabinetArrow) CabinetArrow.refreshActiveIndicators();
}

/**
 * Delete a row and all its cabinets.
 * If it was the last row, keep one empty row.
 * Never called with a row that has an active editingIdx cabinet — caller
 * must ensure the cabinet is cancelled/confirmed first.
 */
async function deleteRow(rowIdx) {
  // Cancel any active edit if it belongs to this row
  if (Cabinet.editingIdx >= 0 && (Cabinet.cabinets[Cabinet.editingIdx]?.rowIdx ?? 0) === rowIdx) {
    CabinetBuilder.clearAssembly({ noFade: true });
    Cabinet.editingIdx        = -1;
    Cabinet.descriptionCode   = '';
    Cabinet.isCodeValid       = false;
    _resetForNextCabinet();
  }

  // Remove all cabinets of this row from state
  Cabinet.cabinets = Cabinet.cabinets.filter(c => (c.rowIdx ?? 0) !== rowIdx);

  // Rebuild scene from remaining state
  await CabinetBuilder.rebuildAllCabinetsFromState();
  if (window.CabinetDrag) CabinetDrag.rebuildLockedFromState();

  // Remove the row config
  if (Cabinet.rows.length > 1) {
    Cabinet.rows.splice(rowIdx, 1);
    // Fix rowIdx references in remaining cabinets
    for (const cab of Cabinet.cabinets) {
      if ((cab.rowIdx ?? 0) > rowIdx) cab.rowIdx--;
    }
    // Clamp activeRowIdx
    Cabinet.activeRowIdx = Math.min(Cabinet.activeRowIdx ?? 0, Cabinet.rows.length - 1);
  } else {
    // Last row — reset to empty
    Cabinet.rows[0] = { id: 0, origin: { x: 0, z: 0 }, angle: 0 };
    Cabinet.activeRowIdx = 0;
  }

  Cabinet.currentCabinetXOffset = _confirmedRightEdge();
  _rebuildBOM();
  CabinetFloor.update();
  showToast('Row deleted', 'info');
}

/* ══════════════════════════════════════════════════════
   DEV — THUMBNAIL EXPORT  (used by generate-thumbs.js)
══════════════════════════════════════════════════════ */
window.exportAllThumbs = async function (cam = {}) {
  const results = [];

  // ── Preset cabinet thumbnails ───────────────────────
  console.log('[exportAllThumbs] Presets…');
  for (const p of PRESET_CONFIGS) {
    try {
      console.log(`  preset: ${p.code}`);
      const dataURL = await _capturePresetThumb(p.code, cam);
      results.push({ type: 'preset', code: p.code, dataURL });
    } catch (e) {
      console.warn(`  FAILED preset: ${p.code}`, e.message);
    }
  }

  // ── Accessory thumbnails ────────────────────────────
  console.log('[exportAllThumbs] Accessories…');
  CabinetBuilder.clearAssembly({ noFade: true });
  for (const a of ACCESSORY_CATALOG) {
    try {
      console.log(`  accessory: ${a.code}`);
      const dataURL = await _captureAccThumb(a.code, cam);
      results.push({ type: 'accessory', code: a.code, dataURL });
    } catch (e) {
      console.warn(`  FAILED accessory: ${a.code}`, e.message);
    }
  }

  // ── Chassis thumbnails ──────────────────────────────
  console.log('[exportAllThumbs] Chassis…');
  if (window.CabinetChassis) {
    for (const c of CabinetChassis.CHASSIS_CATALOG) {
      try {
        console.log(`  chassis: ${c.code}`);
        const dataURL = await CabinetChassis.captureThumb(c.code, cam);
        results.push({ type: 'chassis', code: c.code, dataURL });
      } catch (e) {
        console.warn(`  FAILED chassis: ${c.code}`, e.message);
      }
    }
  }

  CabinetBuilder.clearAssembly({ noFade: true });
  console.log(`[exportAllThumbs] Done — ${results.length} thumbnails`);
  return results;
};

/* Expose to HTML onclick */
Object.assign(window, {
  toggleStep,
  setMode, openWizard,
  wizSelectPR, wizSelectHE, wizSelectAS, wizSelectCL, wizNext, wizBack,
  openPlateConfigurator, saveConfig, loadConfig, loadExample, exportBOM, renderSnapshot, switchToCabinetEdit,
  openModal, closeModal, showToast,
  // Presets
  togglePresetGallery, selectPreset,
  // Accessories & Chassis
  useEZRConfig, onGoToChassisStep, onReadyClick,
  // Preview modal
  openPreview, closePreview,
  // Door controls
  applyDoorOpacity, applyDoorAngle,
  // Segment editor
  segmentClick,
  _segSet, _segSetPR, _segSetCov, _segSetDoor, _closeSegmentPopover,
});
