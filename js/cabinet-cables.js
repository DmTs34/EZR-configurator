/**
 * cabinet-cables.js
 * Cables Editor — live editing of cable paths in the preview modal.
 * Exposes window._CablesEditor.
 */

/* CABLES EDITOR — live editing of cable paths in preview
════════════════════════════════════════════════════════ */
const _CablesEditor = (() => {
  let _code       = null;
  let _config     = null;   // working deep-copy of PreviewCablesConfig[code]
  let _provider   = null;   // scene provider: must have buildCables/replayAnimation/getCamera
  let _editorElId = 'cablesEditor';

  function setProvider(p, elId) {
    _provider   = p;
    _editorElId = elId || 'cablesEditor';
  }

  function open(code) {
    _code = code;
    const src = window.PreviewCablesConfig && window.PreviewCablesConfig[code];
    if (!src) { _hide(); return; }
    _config = JSON.parse(JSON.stringify(src));
    _migrate();  // convert legacy cable.points → waypoints + path
    _render();
    if (window.PreviewPointsEditVisible !== false)
      document.getElementById(_editorElId).style.display = 'block';
    _apply();
  }

  function close() {
    _hide();
    _code = _config = null;
  }

  function _hide() {
    const el = document.getElementById(_editorElId);
    if (el) el.style.display = 'none';
  }

  function _apply() {
    if (_config && _provider)
      _provider.buildCables(_config.cables, _config.animation || {}, _config.waypointGroups || []);
  }

  // ── Migrate legacy formats ──────────────────────────
  function _migrate() {
    // 1. flat waypoints[] → waypointGroups
    if (_config.waypoints && !_config.waypointGroups) {
      _config.waypointGroups = [{ id: 'default', waypoints: _config.waypoints }];
      delete _config.waypoints;
    }
    if (!_config.waypointGroups) _config.waypointGroups = [{ id: 'default', waypoints: [] }];
    _config.waypointGroups.forEach(g => { if (!g.waypoints) g.waypoints = []; });

    const defaultId = _config.waypointGroups[0].id;

    // 2. per-cable: ensure group, migrate legacy cable.points
    _config.cables.forEach(cable => {
      if (!cable.group) cable.group = defaultId;
      if (cable.points && !cable.path) {
        const group = _config.waypointGroups.find(g => g.id === cable.group)
                   || _config.waypointGroups[0];
        const existing = new Map();
        group.waypoints.forEach(wp => existing.set(`${wp.x},${wp.y},${wp.z}`, wp.id));
        let nextId = group.waypoints.length > 0
          ? Math.max(...group.waypoints.map(w => w.id)) + 1 : 1;
        cable.path = cable.points.map(p => {
          const key = `${p.x},${p.y},${p.z}`;
          if (!existing.has(key)) {
            existing.set(key, nextId);
            group.waypoints.push({ id: nextId, x: p.x, y: p.y, z: p.z });
            nextId++;
          }
          return existing.get(key);
        });
        delete cable.points;
      }
    });
  }

  // ── Render ─────────────────────────────────────────
  function _render() {
    const el = document.getElementById(_editorElId);
    if (!el || !_config) return;
    const groups = _config.waypointGroups || [];

    el.innerHTML =
      // ── Waypoint Groups section ──
      `<div class="ce-header">
        <span>Waypoints <span class="ce-unit">(mm)</span></span>
        <button class="ce-btn" onclick="_CablesEditor.addGroup()">+ Group</button>
      </div>
      ${groups.map((g, gi) => `
        <div class="ce-group">
          <div class="ce-group-head">
            <input class="ce-group-name" value="${g.id}"
              onchange="_CablesEditor.renameGroup(${gi}, this.value)">
            <button class="ce-btn ce-btn-del" title="Remove group"
              onclick="_CablesEditor.removeGroup(${gi})">×</button>
          </div>
          <table class="ce-table">
            <tr><th>ID</th><th>X</th><th>Y</th><th>Z</th><th></th></tr>
            ${g.waypoints.map((wp, wi) => `
              <tr>
                <td class="ce-wp-id">${wp.id}</td>
                <td><input type="number" value="${+wp.x.toFixed(1)}" step="1"
                  onchange="_CablesEditor.setWaypoint(${gi},${wi},'x',+this.value)"></td>
                <td><input type="number" value="${+wp.y.toFixed(1)}" step="1"
                  onchange="_CablesEditor.setWaypoint(${gi},${wi},'y',+this.value)"></td>
                <td><input type="number" value="${+wp.z.toFixed(1)}" step="1"
                  onchange="_CablesEditor.setWaypoint(${gi},${wi},'z',+this.value)"></td>
                <td><button class="ce-btn ce-btn-del"
                  onclick="_CablesEditor.removeWaypoint(${gi},${wi})">−</button></td>
              </tr>`
            ).join('')}
          </table>
          <button class="ce-btn ce-btn-add-pt"
            onclick="_CablesEditor.addWaypoint(${gi})">+ Point</button>
        </div>`
      ).join('')}
      <hr class="ce-divider">` +
      // ── Cables section ──
      `<div class="ce-header">
        <span>Cables</span>
        <button class="ce-btn" onclick="_CablesEditor.addCable()">+ Add</button>
      </div>
      ${_config.cables.map((cable, ci) => {
        const cg  = groups.find(g => g.id === cable.group) || groups[0];
        const wps = cg ? cg.waypoints : [];
        return `
        <div class="ce-cable">
          <div class="ce-cable-head">
            <span>Cable ${ci + 1}</span>
            <select class="ce-type-select" title="Cable type"
              onchange="_CablesEditor.setCableType(${ci}, this.value)">${
              Object.keys(window.CableTypes || {}).map(k =>
                `<option value="${k}"${(cable.type || 'optipack') === k ? ' selected' : ''}>${window.CableTypes[k].label}</option>`
              ).join('')
            }</select>
            <label class="ce-num-label">r<input type="number" value="${cable.radius || 4}" step="0.5" min="0.5"
              onchange="_CablesEditor.setCableRadius(${ci}, +this.value)"></label>
            <label class="ce-num-label">t<input type="number" value="${cable.tension ?? 0.5}" step="0.05" min="0" max="1"
              title="Tension (0=loose, 1=sharp)"
              onchange="_CablesEditor.setCableTension(${ci}, +this.value)"></label>
            <select class="ce-group-select" title="Waypoint group"
              onchange="_CablesEditor.setCableGroup(${ci}, this.value)">${
              groups.map(g =>
                `<option value="${g.id}"${cable.group === g.id ? ' selected' : ''}>${g.id}</option>`
              ).join('')
            }</select>
            <button class="ce-btn ce-btn-del" onclick="_CablesEditor.removeCable(${ci})">✕</button>
          </div>
          <div class="ce-path-row">
            ${(cable.path || []).map((id, pi) =>
              `<span class="ce-wp-tag">${id}<button onclick="_CablesEditor.removeFromPath(${ci},${pi})">×</button></span>`
            ).join('<span class="ce-path-arrow">→</span>')}
            <select class="ce-path-add" onchange="_CablesEditor.addToPath(${ci},+this.value);this.selectedIndex=0">
              <option value="">＋</option>
              ${wps.map(wp => `<option value="${wp.id}">${wp.id}</option>`).join('')}
            </select>
          </div>
        </div>`;
      }).join('')}
      <hr class="ce-divider">
      <button class="ce-btn" style="width:100%;margin-bottom:4px" onclick="_CablesEditor.replay()">▶ Replay animation</button>
      <button class="ce-btn ce-btn-export" onclick="_CablesEditor.exportConfig()">⬇ Copy config</button>`;
  }

  // ── Group mutations ─────────────────────────────────
  function addGroup() {
    const ids = _config.waypointGroups.map(g => g.id);
    let name = 'group', n = 2;
    while (ids.includes(name)) { name = 'group' + n++; }
    _config.waypointGroups.push({ id: name, waypoints: [] });
    _render();
  }
  function removeGroup(gi) {
    if (_config.waypointGroups.length <= 1) return;
    const oldId   = _config.waypointGroups[gi].id;
    _config.waypointGroups.splice(gi, 1);
    const fallback = _config.waypointGroups[0].id;
    _config.cables.forEach(c => { if (c.group === oldId) { c.group = fallback; c.path = []; } });
    _render(); _apply();
  }
  function renameGroup(gi, newId) {
    newId = newId.trim();
    if (!newId) return;
    const oldId = _config.waypointGroups[gi].id;
    _config.waypointGroups[gi].id = newId;
    _config.cables.forEach(c => { if (c.group === oldId) c.group = newId; });
    _apply();
  }

  // ── Waypoint mutations ──────────────────────────────
  function addWaypoint(gi) {
    const wps  = _config.waypointGroups[gi].waypoints;
    const last  = wps[wps.length - 1];
    const nextId = wps.length > 0 ? Math.max(...wps.map(w => w.id)) + 1 : 1;
    wps.push({ id: nextId, x: last ? last.x : 0, y: last ? last.y + 100 : 0, z: last ? last.z : 0 });
    _render(); _apply();
  }
  function removeWaypoint(gi, wi) {
    const id      = _config.waypointGroups[gi].waypoints[wi].id;
    const groupId = _config.waypointGroups[gi].id;
    _config.waypointGroups[gi].waypoints.splice(wi, 1);
    _config.cables.forEach(c => {
      if (c.group === groupId) c.path = (c.path || []).filter(pid => pid !== id);
    });
    _render(); _apply();
  }
  function setWaypoint(gi, wi, axis, val) {
    _config.waypointGroups[gi].waypoints[wi][axis] = val; _apply();
  }

  // ── Cable mutations ─────────────────────────────────
  function addCable() {
    const g    = _config.waypointGroups[0] || { id: 'default', waypoints: [] };
    const wps  = g.waypoints;
    const path = wps.length >= 2 ? [wps[0].id, wps[1].id] : wps.length === 1 ? [wps[0].id] : [];
    _config.cables.push({ type: 'optipack', radius: 10, group: g.id, path });
    _render(); _apply();
  }
  function removeCable(ci) { _config.cables.splice(ci, 1); _render(); _apply(); }

  function addToPath(ci, id) {
    if (!id) return;
    (_config.cables[ci].path = _config.cables[ci].path || []).push(id);
    _render(); _apply();
  }
  function removeFromPath(ci, pi) {
    _config.cables[ci].path.splice(pi, 1);
    _render(); _apply();
  }

  // ── Value mutations (no re-render) ──────────────────
  function setCableType(ci, type) {
    _config.cables[ci].type = type;
    if (window.CableTypes && window.CableTypes[type])
      _config.cables[ci].color = window.CableTypes[type].color;
    _apply();
  }
  function setCableRadius(ci, val)   { _config.cables[ci].radius  = val; _apply(); }
  function setCableTension(ci, val)  { _config.cables[ci].tension = val; _apply(); }
  function setCableGroup(ci, groupId) {
    _config.cables[ci].group = groupId;
    _config.cables[ci].path  = [];
    _render(); _apply();
  }

  // ── Export ──────────────────────────────────────────
  function _formatCompact(code, cam, anim, waypointGroups, cables) {
    const lines = [`  '${code}': {`];
    if (cam) {
      const t = cam.target;
      lines.push(`    camera:    { theta: ${cam.theta}, phi: ${cam.phi}, radius: ${cam.radius}, target: { x: ${t.x}, y: ${t.y}, z: ${t.z} } },`);
    }
    lines.push(`    animation: { enabled: ${anim.enabled}, mode: '${anim.mode}', duration: ${anim.duration} },`);
    lines.push(`    waypointGroups: [`);
    waypointGroups.forEach(g => {
      lines.push(`      { id: '${g.id}', waypoints: [`);
      (g.waypoints || []).forEach(wp => {
        lines.push(`        { id: ${wp.id}, x: ${wp.x}, y: ${wp.y}, z: ${wp.z} },`);
      });
      lines.push(`      ] },`);
    });
    lines.push(`    ],`);
    lines.push(`    cables: [`);
    cables.forEach(cable => {
      const typeStr    = cable.type ? `type: '${cable.type}'` : `color: '${cable.color || '#888888'}'`;
      const groupStr   = cable.group && cable.group !== 'default' ? `, group: '${cable.group}'` : '';
      const tensionStr = cable.tension !== undefined && cable.tension !== 0.5 ? `, tension: ${cable.tension}` : '';
      const path       = `[${(cable.path || []).join(', ')}]`;
      lines.push(`      { ${typeStr}, radius: ${cable.radius || 4}${tensionStr}${groupStr}, path: ${path} },`);
    });
    lines.push(`    ],`);
    lines.push(`  },`);
    return lines.join('\n');
  }

  function exportConfig() {
    const cam  = _provider ? _provider.getCamera() : null;
    const anim = _config.animation || { enabled: true, mode: 'sequential', duration: 0.6 };
    const cables = _config.cables.map(c => { const o = Object.assign({}, c); if (o.type) delete o.color; return o; });
    const block = _formatCompact(_code, cam, anim, _config.waypointGroups || [], cables);
    if (navigator.clipboard)
      navigator.clipboard.writeText(block).then(() => showToast('Config copied to clipboard', 'info'));
  }

  function replay() { if (_provider) _provider.replayAnimation(); }

  return { open, close, setProvider,
           addGroup, removeGroup, renameGroup,
           addWaypoint, removeWaypoint, setWaypoint,
           addCable, removeCable, addToPath, removeFromPath,
           setCableType, setCableRadius, setCableTension, setCableGroup,
           exportConfig, replay };
})();

window._CablesEditor      = _CablesEditor;
window._PreviewScene      = _PreviewScene;
window._makeLabelSprite   = _PreviewScene._makeLabelSprite;
// Default provider is _PreviewScene (set after both are defined)
_CablesEditor.setProvider(_PreviewScene, 'cablesEditor');
