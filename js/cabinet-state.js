/**
 * cabinet-state.js
 * Global state object for the cabinet configurator.
 * Kept separate from window.App (mounting plate configurator state).
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

  /* ── Multi-cabinet row ────────────────────────────── */
  cabinets: [],
  // Each confirmed entry: { code, xOffset, placedAccessories: [{code, snapId}] }
  currentCabinetXOffset: 0,  // mm, X start of cabinet being configured

  /* ── BOM ──────────────────────────────────────────── */
  bom: [],
  // Each entry: { name, code, qty }

  /* ── User-placed accessories (via drag) ───────────── */
  placedAccessories: [],
  // Each entry: { code, snapId }

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
