/**
 * cabinet-code-editor.js
 * Step wizard UI: code segment editor, door/covering selectors, Q&A wizard.
 * Steps 1, 2, 3. Depends on cabinet-code.js for catalog data.
 */

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

  // Only clear accessories when DE changes (different rail/snap layout).
  // Changing PR (EZR_OP ↔ EZR_CL) or other non-DE parts keeps accessories intact.
  const prevDE  = CabinetBuilder.parseCode?.(_lastBuiltCode)?.de ?? null;
  const nextDE  = CabinetBuilder.parseCode?.(code)?.de ?? null;
  const deChanged = prevDE !== null && nextDE !== null && prevDE !== nextDE;
  if (deChanged && window.CabinetDrag && Cabinet.placedAccessories?.length) {
    const confirmed = window.confirm(
      'Changing the cabinet design will remove all placed accessories.\n\nContinue?'
    );
    if (!confirmed) {
      // Revert wizard selections back to previous code
      const prev = CabinetBuilder.parseCode(_lastBuiltCode);
      if (prev) {
        Cabinet.wizardSelections = {
          pr: prev.pr, he: prev.he, de: prev.de, as: prev.as, cl: prev.cl,
          doors: prev.doors, cov: prev.cov,
        };
        Cabinet.descriptionCode = _lastBuiltCode;
        _renderCodeEditor();
        _renderCurrentCodeRow(_lastBuiltCode);
      }
      return;
    }
    CabinetDrag.clear();
  } else if (deChanged && window.CabinetDrag) {
    CabinetDrag.clear();
  }

  _rebuildBOM();
  // Skip build while preset gallery is rendering — gallery cleanup will build after abort
  if (window.CabinetBuilder && !_presetsActive) CabinetBuilder.build(code, { xOffset: Cabinet.currentCabinetXOffset, noFitCamera: true });
  // Reposition active chassis to match new cabinet geometry
  if (window.CabinetChassis && CabinetChassis.repositionPlaced) {
    CabinetChassis.repositionPlaced(code, Cabinet.currentCabinetXOffset, Cabinet.activeRowIdx ?? 0);
  }
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