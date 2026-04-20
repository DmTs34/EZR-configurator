/**
 * cabinet-config.js
 * Save / load project JSON, append config to scene, export BOM as CSV.
 */

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
    doorAngle:   Number(document.getElementById('doorAngle')?.value ?? 0),
    doorOpacity: Number(document.getElementById('doorOpacity')?.value ?? 100),
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
  _downloadJSON(data, `${Cabinet.projectName.replace(/\s+/g,'-')}.json`);
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
  // Inject preset accessories for cabinets that have none yet
  Cabinet.cabinets.forEach(cab => CabinetBuilder.injectPresetAccessories?.(cab));
  Cabinet.activeRowIdx          = 0;
  Cabinet.editingIdx            = -1;
  Cabinet.descriptionCode       = '';
  Cabinet.isCodeValid           = false;
  Cabinet.placedAccessories     = [];
  Cabinet.placedChassis         = [];
  Cabinet.currentCabinetXOffset = 0;

  await CabinetBuilder.rebuildAllCabinetsFromState();
  if (window.CabinetDrag)  await CabinetDrag.rebuildFromState();
  if (window.CabinetArrow) CabinetArrow.rebuildAll?.();
  if (window.CabinetFloor) CabinetFloor.update?.();

  // Apply door angle and opacity from the config file
  const anEl = document.getElementById('doorAngle');
  const opEl = document.getElementById('doorOpacity');
  if (anEl) { anEl.value = data.doorAngle ?? 0;   applyDoorAngle(anEl.value); }
  if (opEl) { opEl.value = data.doorOpacity ?? 100; applyDoorOpacity(opEl.value); }
  _updateDoorControls();

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
    console.error('[loadExample] Error:', err);
    showToast('Failed to load example: ' + err.message, 'error');
  }
}

/**
 * Append all cabinets from a config file to the current active row,
 * starting right after the rightmost existing cabinet.
 * Unlike loadExample / _applyConfig, this does NOT clear the existing scene.
 */
async function appendConfigToScene(path) {
  try {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (!Array.isArray(data.cabinets) || !data.cabinets.length) return;

    const baseOffset = _confirmedRightEdge();
    const activeRow  = Cabinet.activeRowIdx ?? 0;
    // Normalise so the first cabinet in the loaded config starts at baseOffset
    const minX = Math.min(...data.cabinets.map(c => c.xOffset ?? 0));

    for (const cab of data.cabinets) {
      const newIdx = Cabinet.cabinets.length;  // index this cabinet will occupy
      const entry = Object.assign({}, cab, {
        xOffset: baseOffset + (cab.xOffset ?? 0) - minX,
        rowIdx:  activeRow,
        label:  `ODF #${newIdx + 1}`,          // sequential across the whole row
      });
      CabinetBuilder.injectPresetAccessories?.(entry);
      Cabinet.cabinets.push(entry);
    }

    // Clear existing meshes before full rebuild to avoid duplicates in scene.
    // Also remove any orphaned placed-accessory / chassis meshes that were left
    // behind when the preview scene swap emptied _lockedPlaced/_lockedChassis
    // without being able to remove them from the main scene.
    const _orphaned = Cabinet.scene.children.filter(
      o => o.userData.isPlaced || o.userData.isPlacedChassis
    );
    _orphaned.forEach(o => Cabinet.scene.remove(o));

    CabinetBuilder.clearAll({ noFade: true });
    if (window.CabinetDrag)    CabinetDrag.clearAll();
    if (window.CabinetChassis) CabinetChassis.clearAll();

    await CabinetBuilder.rebuildAllCabinetsFromState();
    if (window.CabinetDrag)  await CabinetDrag.rebuildFromState();
    if (window.CabinetArrow) CabinetArrow.rebuildAll?.();
    if (window.CabinetFloor) CabinetFloor.update?.();

    // Re-apply user's current door settings to all newly built meshes
    const anEl = document.getElementById('doorAngle');
    const opEl = document.getElementById('doorOpacity');
    if (anEl) applyDoorAngle(anEl.value);
    if (opEl) applyDoorOpacity(opEl.value);

    Cabinet.currentCabinetXOffset = _confirmedRightEdge();
    _resetForNextCabinet();
    _rebuildBOM();
    if (window.CabinetUI) CabinetUI.updateCabinetList?.();
    showToast('Configuration appended', 'success');
  } catch (err) {
    showToast('Failed to append config: ' + err.message, 'error');
  }
}
window.appendConfigToScene = appendConfigToScene;

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
