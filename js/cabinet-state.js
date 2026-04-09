/**
 * cabinet-state.js
 * Global state object for the cabinet configurator.
 *
 */
window.Cabinet = {

  /* ── Project ──────────────────────────────────────── */
  projectName: 'New Project',

  /* ── Step 1: Cabinet ──────────────────────────────── */
  inputMode: 'wizard',          // 'wizard' | 'code'
  descriptionCode: '',          // Full code string, e.g. "EZR-42U-800W-600D-IP54"
  wizardSelections: {},         // { height: '42U', width: '800W', depth: '600D', ... }
  isCodeValid: false,

  /* ── Step 2: Frame ────────────────────────────────── */
  selectedFrameId: null,        // ID from FRAME_CATALOG

  /* ── Step 3: Mounting Plates ──────────────────────── */
  mountingPlates: [],
  // Each entry: { id, name, accessoryCount, exportedConfig: {...} }

  /* ── Rows (groups of cabinets, each with its own arrow) ── */
  rows: [
    { id: 0, origin: { x: 0, z: 0 }, angle: 0, flipped: false }
  ],
  // Each entry: { id, origin: {x, z} (mm), angle: 0|1 }
  activeRowIdx: 0,             // index into rows[] — new cabinets go into this row

  /* ── Multi-cabinet row ────────────────────────────── */
  cabinets: [],
  // Each confirmed entry: { code, xOffset, rowIdx, placedAccessories: [{code, snapId}], placedChassis: [{code, slotIdx, heightU}] }
  currentCabinetXOffset: 0,  // mm, X start of cabinet being configured (for active row)
  editingIdx: -1,            // index of cabinet being edited, or -1 for new cabinet

  /* ── BOM ──────────────────────────────────────────── */
  bom: [],
  // Each entry: { name, code, qty }

  /* ── User-placed accessories (via drag) ───────────── */
  placedAccessories: [],
  // Each entry: { code, snapId }

  /* ── User-placed chassis (via drag) ────────────────── */
  placedChassis: [],
  // Each entry: { code, slotIdx, heightU }

  /* ── Three.js objects (set by cabinet-main.js) ────── */
  scene:      null,
  camera:     null,
  renderer:   null,
  controls:   null,
  gridHelper: null,
  gizmoScene:    null,
  gizmoCamera:   null,
  gizmoRenderer: null,

  /* ── UI ───────────────────────────────────────────── */
  activeStep: 'step1',

  /* ── Rendering hints ──────────────────────────────── */
  noFadeNext: false,   // set to true to skip fade on next build() call
};
