/**
 * cabinet-ui.js
 * UI interactions — step wizard, modals, accessories/chassis navigation.
 * Catalog data, code builder/parser: cabinet-code.js
 */



const ACCESSORY_CATALOG = [
  { code: 'EZR_CBFX',             label: 'Cable Fixator',         desc: 'Cable fixation plate' },
  { code: 'EZR_MDL-L87-NT',       label: 'Module 87 mm',          desc: 'Short mandrel' },
  { code: 'EZR_MDL-L224-NT',      label: 'Module 224 mm',         desc: 'Long mandrel' },
  { code: 'EZR_RET',              label: 'Retaining Clip',        desc: 'Cable retainer' },
  { code: 'EZR_ROUT-BRKT',        label: 'Routing Bracket',       desc: 'Cable routing bracket' },
  { code: 'EZR_ROUT-PLT',         label: 'Routing Plate',         desc: 'Attaches to Routing Bracket' },
  { code: 'EZR_SEP_PLT-4U-horiz', label: 'Separator Plate 4U H', desc: 'Separator plate, 4U' },
  { code: 'EZR_SEP_PLT-4U',       label: 'Separator Plate 4U',   desc: 'Separator plate, 4U' },
  { code: 'EZR_TBRKT',            label: 'EZR-TBRKT',            desc: 'Cable tie fixation bracket' },
  { code: 'EZR_CAB_EXT',         label: 'Cabinet Extender',      desc: 'Cable exit' },
];

const _accThumbs      = {};   // code → dataURL cache
let _accThumbsActive  = false;

function _safeThumbId(code) { return 'accThumb_' + code.replace(/[^a-zA-Z0-9]/g, '_'); }

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
  // Do NOT reset slider values here — values are preserved across cabinet rebuilds.
  // Only reset when the full scene is cleared (_resetDoorControls).
}

function _resetDoorControls() {
  const opEl = document.getElementById('doorOpacity');
  const anEl = document.getElementById('doorAngle');
  if (opEl) opEl.value = 100;
  if (anEl) anEl.value = 0;
  const opVal = document.getElementById('doorOpacityVal');
  const anVal = document.getElementById('doorAngleVal');
  if (opVal) opVal.textContent = '100%';
  if (anVal) anVal.textContent = '0°';
  _updateDoorControls();
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

  // ── Ready-configuration thumbnails ─────────────────
  console.log('[exportAllThumbs] Configurations…');
  if (window.CONFIGURATIONS_CATALOG && CONFIGURATIONS_CATALOG.length) {
    for (const cfg of CONFIGURATIONS_CATALOG) {
      try {
        console.log(`  config: ${cfg.id}`);
        const dataURL = await _captureConfigThumb(cfg.file, cam);
        results.push({ type: 'config', code: cfg.id, imageFile: cfg.image, dataURL });
      } catch (e) {
        console.warn(`  FAILED config: ${cfg.id}`, e.message);
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
