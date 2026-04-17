'use strict';

/**
 * preview-cables.js
 * Cable path definitions for 3D model previews.
 *
 * All coordinates (x, y, z) and radius are in MILLIMETRES.
 * The renderer converts to Three.js units automatically (1 mm = 0.001).
 *
 * Structure per code:
 *   camera    — { theta (deg), phi (deg), radius, target: {x,y,z} }
 *   animation — { enabled, mode: 'sequential'|'parallel', duration (sec) }
 *   waypoints — array of { id, x, y, z }  — named anchor points, shared across cables
 *   cables    — array of { type, radius (mm), tubularSegments, radialSegments, path: [id,...] }
 *
 * Use the live editor in the preview modal for real-time adjustment,
 * then use "Copy config" and replace the matching block below.
 */

// Set to false to hide the points editor panel and camera statusbar,
// showing only the 3D scene in the preview modal.
window.PreviewPointsEditVisible = false;

// Standard cable type colours.
// Use the 'type' field in a cable object instead of a free-form 'color'.
window.CableTypes = {
  optipack:   { label: 'Optipack / MTP trunks', color: '#1e6e3a' },
  protective: { label: 'Protective tubes',       color: '#333333' },
  cross:      { label: 'Cross-connections',      color: '#e07020' },
  patchout:   { label: 'Patching out',           color: '#8b1a1a' },
  cable:      { label: 'Cable',                  color: '#888888' },
};

window.PreviewCablesConfig = {

  // ── Accessories ─────────────────────────────────────────────────────────────

  'EZR_CBFX': {
    camera:    { theta: 65.3, phi: 74.7, radius: 0.212, target: { x: -0.015, y: 0.030, z: 0.128 } },
    animation: { enabled: true, mode: 'sequential', duration: 0.2 },
    waypoints: [
      { id:  1, x: -6, y:  125, z:  18 }, { id:  2, x: -6, y: -100, z:  18 },
      { id:  3, x: -6, y:  125, z:  36 }, { id:  4, x: -6, y: -100, z:  36 },
      { id:  5, x: -6, y:  125, z:  53 }, { id:  6, x: -6, y: -100, z:  53 },
      { id:  7, x: -6, y:  125, z:  71 }, { id:  8, x: -6, y: -100, z:  71 },
      { id:  9, x: -6, y:  125, z:  89 }, { id: 10, x: -6, y: -100, z:  89 },
      { id: 11, x: -6, y:  125, z: 106 }, { id: 12, x: -6, y: -100, z: 106 },
      { id: 13, x: -6, y:  125, z: 123 }, { id: 14, x: -6, y: -100, z: 123 },
      { id: 15, x: -6, y:  125, z: 141 }, { id: 16, x: -6, y: -100, z: 141 },
      { id: 17, x: -6, y:  125, z: 158 }, { id: 18, x: -6, y: -100, z: 158 },
      { id: 19, x: -6, y:  125, z: 176 }, { id: 20, x: -6, y: -100, z: 176 },
      { id: 21, x: -6, y:  125, z: 194 }, { id: 22, x: -8, y: -100, z: 194 },
      { id: 23, x: -6, y:  125, z: 211 }, { id: 24, x: -6, y: -100, z: 211 },
    ],
    cables: [
      { type: 'cable', radius: 4, path: [ 1,  2] },
      { type: 'cable', radius: 4, path: [ 3,  4] },
      { type: 'cable', radius: 4, path: [ 5,  6] },
      { type: 'cable', radius: 4, path: [ 7,  8] },
      { type: 'cable', radius: 4, path: [ 9, 10] },
      { type: 'cable', radius: 4, path: [11, 12] },
      { type: 'cable', radius: 4, path: [13, 14] },
      { type: 'cable', radius: 4, path: [15, 16] },
      { type: 'cable', radius: 4, path: [17, 18] },
      { type: 'cable', radius: 4, path: [19, 20] },
      { type: 'cable', radius: 4, path: [21, 22] },
      { type: 'cable', radius: 4, path: [23, 24] },
    ],
  },

  'EZR_RET': {
    camera:    { theta: 52.92, phi: 78.37, radius: 0.1938, target: { x: -0.0205, y: 0.0207, z: 0.138 } },
    animation: { enabled: true, mode: 'sequential', duration: 0.2 },
    waypoints: [
      { id:  1, x:  0, y:  125, z:  18 }, { id:  2, x:  0, y: -100, z:  18 },
      { id:  3, x:  0, y:  125, z:  36 }, { id:  4, x:  0, y: -100, z:  36 },
      { id:  5, x:  0, y:  125, z:  53 }, { id:  6, x:  0, y: -100, z:  53 },
      { id:  7, x:  0, y:  125, z:  71 }, { id:  8, x:  0, y: -100, z:  71 },
      { id:  9, x:  0, y:  125, z:  89 }, { id: 10, x:  0, y: -100, z:  89 },
      { id: 11, x:  0, y:  125, z: 106 }, { id: 12, x:  0, y: -100, z: 106 },
      { id: 13, x:  0, y:  125, z: 123 }, { id: 14, x:  0, y: -100, z: 123 },
      { id: 15, x:  0, y:  125, z: 141 }, { id: 16, x:  0, y: -100, z: 141 },
      { id: 17, x:  0, y:  125, z: 158 }, { id: 18, x:  0, y: -100, z: 158 },
      { id: 19, x:  0, y:  125, z: 176 }, { id: 20, x:  0, y: -100, z: 176 },
      { id: 21, x:  0, y:  125, z: 194 }, { id: 22, x:  0, y: -100, z: 194 },
      { id: 23, x:  0, y:  125, z: 211 }, { id: 24, x: -1, y: -100, z: 211 },
    ],
    cables: [
      { type: 'cable', radius: 4, path: [ 1,  2] },
      { type: 'cable', radius: 4, path: [ 3,  4] },
      { type: 'cable', radius: 4, path: [ 5,  6] },
      { type: 'cable', radius: 4, path: [ 7,  8] },
      { type: 'cable', radius: 4, path: [ 9, 10] },
      { type: 'cable', radius: 4, path: [11, 12] },
      { type: 'cable', radius: 4, path: [13, 14] },
      { type: 'cable', radius: 4, path: [15, 16] },
      { type: 'cable', radius: 4, path: [17, 18] },
      { type: 'cable', radius: 4, path: [19, 20] },
      { type: 'cable', radius: 4, path: [21, 22] },
      { type: 'cable', radius: 4, path: [23, 24] },
    ],
  },

  'EZR_MDL-L87-NT': {
    camera:    { theta: 55.63, phi: 80.67, radius: 0.1649, target: { x: -0.003, y: -0.0173, z: 0.0472 } },
    animation: { enabled: true, mode: 'parallel', duration: 0.4 },
    waypoints: [
      { id:  1, x: -32, y: -120, z: 60 }, { id:  2, x: -32, y:  -27, z: 60 }, { id:  3, x: -24, y: -13, z: 60 },
      { id:  4, x:  -2, y:   -3, z: 60 }, { id:  5, x:  26, y: -13, z: 60 },  { id:  6, x:  30, y: -120, z: 60 },
      { id:  7, x: -32, y: -120, z: 40 }, { id:  8, x: -32, y:  -29, z: 40 }, { id:  9, x: -24, y: -13, z: 40 },
      { id: 10, x:  -2, y:   -3, z: 40 }, { id: 11, x:  26, y: -13, z: 40 },  { id: 12, x:  30, y: -120, z: 40 },
      { id: 13, x: -32, y: -120, z: 20 }, { id: 14, x: -32, y:  -27, z: 20 }, { id: 15, x: -24, y: -13, z: 20 },
      { id: 16, x:  -2, y:   -3, z: 20 }, { id: 17, x:  26, y: -13, z: 20 },  { id: 18, x:  30, y: -120, z: 20 },
    ],
    cables: [
      { type: 'cable', radius: 4, path: [ 1,  2,  3,  4,  5,  6] },
      { type: 'cable', radius: 4, path: [ 7,  8,  9, 10, 11, 12] },
      { type: 'cable', radius: 4, path: [13, 14, 15, 16, 17, 18] },
    ],
  },

  'EZR_MDL-L224-NT': {
    camera:    { theta: 63.42, phi: 74.72, radius: 0.2737, target: { x: -0.0469, y: -0.0492, z: 0.1125 } },
    animation: { enabled: true, mode: 'parallel', duration: 0.4 },
    waypoints: [
      { id:  1, x: -32, y: -200, z:  20 }, { id:  2, x: -32, y: -27, z:  20 }, { id:  3, x: -24, y: -13, z:  20 }, { id:  4, x: -2, y: -3, z:  20 }, { id:  5, x: 26, y: -13, z:  20 }, { id:  6, x: 30, y: -200, z:  18 },
      { id:  7, x: -32, y: -200, z:  35 }, { id:  8, x: -32, y: -27, z:  35 }, { id:  9, x: -24, y: -13, z:  35 }, { id: 10, x: -2, y: -3, z:  35 }, { id: 11, x: 26, y: -13, z:  35 }, { id: 12, x: 30, y: -200, z:  35 },
      { id: 13, x: -32, y: -200, z:  50 }, { id: 14, x: -32, y: -27, z:  50 }, { id: 15, x: -24, y: -13, z:  50 }, { id: 16, x: -2, y: -3, z:  50 }, { id: 17, x: 26, y: -13, z:  50 }, { id: 18, x: 30, y: -200, z:  50 },
      { id: 19, x: -32, y: -200, z:  75 }, { id: 20, x: -32, y: -27, z:  75 }, { id: 21, x: -24, y: -13, z:  75 }, { id: 22, x: -2, y: -3, z:  75 }, { id: 23, x: 26, y: -13, z:  75 }, { id: 24, x: 30, y: -200, z:  75 },
      { id: 25, x: -32, y: -199, z:  90 }, { id: 26, x: -32, y: -27, z:  90 }, { id: 27, x: -24, y: -13, z:  90 }, { id: 28, x: -2, y: -3, z:  90 }, { id: 29, x: 26, y: -13, z:  90 }, { id: 30, x: 30, y: -200, z:  90 },
      { id: 31, x: -32, y: -200, z: 105 }, { id: 32, x: -32, y: -27, z: 105 }, { id: 33, x: -24, y: -13, z: 105 }, { id: 34, x: -2, y: -3, z: 105 }, { id: 35, x: 26, y: -13, z: 105 }, { id: 36, x: 30, y: -200, z: 105 },
      { id: 37, x: -32, y: -200, z: 130 }, { id: 38, x: -32, y: -27, z: 130 }, { id: 39, x: -24, y: -13, z: 130 }, { id: 40, x: -2, y: -3, z: 130 }, { id: 41, x: 26, y: -13, z: 130 }, { id: 42, x: 30, y: -200, z: 130 },
      { id: 43, x: -32, y: -200, z: 145 }, { id: 44, x: -32, y: -27, z: 145 }, { id: 45, x: -24, y: -13, z: 145 }, { id: 46, x: -2, y: -3, z: 145 }, { id: 47, x: 26, y: -13, z: 145 }, { id: 48, x: 30, y: -200, z: 145 },
      { id: 49, x: -32, y: -200, z: 160 }, { id: 50, x: -32, y: -27, z: 160 }, { id: 51, x: -24, y: -13, z: 160 }, { id: 52, x: -2, y: -3, z: 160 }, { id: 53, x: 26, y: -13, z: 160 }, { id: 54, x: 30, y: -200, z: 160 },
      { id: 55, x: -32, y: -200, z: 190 }, { id: 56, x: -32, y: -27, z: 190 }, { id: 57, x: -24, y: -13, z: 190 }, { id: 58, x: -2, y: -3, z: 190 }, { id: 59, x: 26, y: -13, z: 190 }, { id: 60, x: 30, y: -199, z: 190 },
      { id: 61, x: -32, y: -200, z: 205 }, { id: 62, x: -32, y: -27, z: 205 }, { id: 63, x: -24, y: -13, z: 205 }, { id: 64, x: -2, y: -3, z: 205 }, { id: 65, x: 26, y: -13, z: 205 }, { id: 66, x: 30, y: -200, z: 205 },
      { id: 67, x: -32, y: -200, z: 220 }, { id: 68, x: -32, y: -27, z: 220 }, { id: 69, x: -24, y: -13, z: 220 }, { id: 70, x: -2, y: -3, z: 220 }, { id: 71, x: 26, y: -13, z: 220 }, { id: 72, x: 30, y: -200, z: 220 },
    ],
    cables: [
      { type: 'cable', radius: 4, path: [ 1,  2,  3,  4,  5,  6] },
      { type: 'cable', radius: 4, path: [ 7,  8,  9, 10, 11, 12] },
      { type: 'cable', radius: 4, path: [13, 14, 15, 16, 17, 18] },
      { type: 'cable', radius: 4, path: [19, 20, 21, 22, 23, 24] },
      { type: 'cable', radius: 4, path: [25, 26, 27, 28, 29, 30] },
      { type: 'cable', radius: 4, path: [31, 32, 33, 34, 35, 36] },
      { type: 'cable', radius: 4, path: [37, 38, 39, 40, 41, 42] },
      { type: 'cable', radius: 4, path: [43, 44, 45, 46, 47, 48] },
      { type: 'cable', radius: 4, path: [49, 50, 51, 52, 53, 54] },
      { type: 'cable', radius: 4, path: [55, 56, 57, 58, 59, 60] },
      { type: 'cable', radius: 4, path: [61, 62, 63, 64, 65, 66] },
      { type: 'cable', radius: 4, path: [67, 68, 69, 70, 71, 72] },
    ],
  },

  // ── Preset DE cable configs ──────────────────────────────────────────────────
  // Keys: 'preset_' + DE code.

  'preset_06LR0': {
    camera:    { theta: 33.17, phi: 63.25, radius: 2.7616, target: { x: 0.3009, y: 1.1836, z: 0.1062 } },
    animation: { enabled: true, mode: 'sequential', duration: 0.5 },
    waypoints: [
      { id: 1, x: 0, y: 2100, z: 18 },
      { id: 2, x: 0, y:   50, z: 18 },
    ],
    cables: [
      { type: 'cable', radius: 4, path: [1, 2] },
    ],
  },

  'preset_09STL': {
    // Waypoints 4 and 8 are branch points shared between cables.
    camera:    { theta: 29.05, phi: 75.18, radius: 2.8228, target: { x: 0.5855, y: 1.1318, z: 0.2575 } },
    animation: { enabled: true, mode: 'sequential', duration: 0.3 },
    waypoints: [
      { id:  1, x:  60, y: 2500, z: 100 }, { id:  2, x:  60, y: 2100, z: 100 }, { id:  3, x:  30, y: 2000, z: 100 },
      { id:  4, x:  30, y: 1500, z: 100 }, { id:  5, x:  30, y: 1400, z: 100 }, { id:  6, x:  60, y: 1380, z: 100 }, { id:  7, x: 120, y: 1380, z: 100 },
      { id:  8, x:  30, y:  700, z: 100 }, { id:  9, x:  60, y:  680, z: 100 }, { id: 10, x: 120, y:  680, z: 100 },
      { id: 11, x:  30, y:  150, z: 100 }, { id: 12, x:  60, y:  130, z: 100 }, { id: 13, x: 120, y:  130, z: 100 },
      { id: 14, x: 550, y: 1700, z: 200 }, { id: 15, x: 600, y: 1700, z: 200 }, { id: 16, x: 600, y: 1120, z: 200 },
      { id: 17, x: 610, y: 1080, z: 200 }, { id: 18, x: 630, y: 1050, z: 200 }, { id: 19, x: 670, y: 1050, z: 200 },
      { id: 20, x: 700, y: 1080, z: 200 }, { id: 21, x: 720, y: 1170, z: 200 }, { id: 22, x: 750, y: 1190, z: 200 },
      { id: 23, x: 781, y: 1165, z: 200 }, { id: 24, x: 774, y: 1122, z: 200 }, { id: 25, x: 728, y: 1064, z: 200 },
      { id: 26, x: 671, y: 1027, z: 200 }, { id: 27, x: 626, y: 1035, z: 200 }, { id: 28, x: 601, y: 1058, z: 200 },
      { id: 29, x: 600, y: 1120, z: 220 }, { id: 30, x: 602, y: 1800, z: 220 }, { id: 31, x: 550, y: 1800, z: 220 },
    ],
    cables: [
      { type: 'cable', radius: 10, path: [1, 2, 3, 4, 5, 6, 7] },
      { type: 'cable', radius: 10, path: [4, 8, 9, 10] },
      { type: 'cable', radius: 10, path: [8, 11, 12, 13] },
      { type: 'cross', radius: 10, path: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31] },
    ],
  },

  'preset_09STR': {
    animation: { enabled: true, mode: 'sequential', duration: 0.5 },
    waypoints: [
      { id: 1, x: 0, y: 2100, z: 18 },
      { id: 2, x: 0, y:   50, z: 18 },
    ],
    cables: [
      { type: 'cable', radius: 4, path: [1, 2] },
    ],
  },

  'preset_12IFA': {
    animation: { enabled: true, mode: 'sequential', duration: 0.5 },
    waypoints: [
      { id: 1, x: 0, y: 2100, z: 18 },
      { id: 2, x: 0, y:   50, z: 18 },
    ],
    cables: [
      { type: 'cable', radius: 4, path: [1, 2] },
    ],
  },

  'preset_15DAS': {
    animation: { enabled: true, mode: 'sequential', duration: 0.5 },
    waypoints: [
      { id: 1, x: 0, y: 2100, z: 18 },
      { id: 2, x: 0, y:   50, z: 18 },
    ],
    cables: [
      { type: 'cable', radius: 4, path: [1, 2] },
    ],
  },

  // ── Ready ODF configuration cable configs ────────────────────────────────────
  // Keys: config id from CONFIGURATIONS_CATALOG.
  // Use the live editor in the config preview modal to adjust, then "Copy config".

  'odf-lisa-600-max-left': {
    animation: { enabled: true, mode: 'sequential', duration: 0.5 },
    waypoints: [],
    cables: [],
  },
  'example-1': {
    camera:    { theta: 0, phi: 85.94, radius: 7.208, target: { x: 3, y: 1.0919, z: 0.225 } },
    animation: { enabled: true, mode: 'sequential', duration: 0.5 },
    waypointGroups: [
      { id: 'default', waypoints: [
      ] },
    ],
    cables: [
    ],
  },

    'odf-lisa-600-splice-left-top': {
    camera:    { theta: 21.2, phi: 71.05, radius: 3.1313, target: { x: 0.1973, y: 1.2482, z: 0.2372 } },
    animation: { enabled: true, mode: 'sequential', duration: 0.5 },
    waypointGroups: [
      { id: 'default', waypoints: [
        { id: 1, x: 100, y: 2400, z: 100 },
        { id: 2, x: 100, y: 2200, z: 100 },
        { id: 3, x: 100, y: 2145, z: 100 },
        { id: 4, x: 100, y: 2013, z: 100 },
        { id: 5, x: 70, y: 1935, z: 100 },
        { id: 6, x: 70, y: 1800, z: 100 },
        { id: 7, x: 70, y: 1800, z: 200 },
        { id: 8, x: 95, y: 1900, z: 200 },
        { id: 9, x: 77, y: 1900, z: 275 },
        { id: 10, x: 110, y: 1900, z: 275 },
        { id: 11, x: 110, y: 1900, z: 100 },
      ] },
      { id: 'Patching out top 2 cassette', waypoints: [
        { id: 1, x: 300, y: 1905, z: 200 },
        { id: 2, x: 320, y: 1905, z: 176 },
        { id: 3, x: 320, y: 1905, z: 60 },
        { id: 4, x: 450, y: 1905, z: 60 },
        { id: 5, x: 450, y: 1905, z: 220 },
        { id: 6, x: 475, y: 1905, z: 260 },
        { id: 7, x: 509, y: 1905, z: 220 },
        { id: 8, x: 501, y: 1905, z: 140 },
        { id: 9, x: 501, y: 1800, z: 140 },
        { id: 10, x: 550, y: 1800, z: 140 },
        { id: 11, x: 550, y: 2400, z: 140 },

      ] },
            { id: 'Patching out top 10 cassette', waypoints: [
       { id: 1, x: 300, y: 1705, z: 200 },
        { id: 2, x: 320, y: 1705, z: 176 },
        { id: 3, x: 320, y: 1705, z: 60 },
        { id: 4, x: 450, y: 1705, z: 60 },
        { id: 5, x: 450, y: 1705, z: 220 },
        { id: 6, x: 475, y: 1705, z: 260 },
        { id: 7, x: 509, y: 1705, z: 220 },
        { id: 8, x: 501, y: 1705, z: 140 },
        { id: 9, x: 501, y: 1600, z: 140 },
        { id: 10, x: 550, y: 1600, z: 140 },
        { id: 11, x: 550, y: 2400, z: 140 },
        
      ] },
    ],
    cables: [
      { type: 'cable', radius: 10, tension: 0, path: [1, 2] },
      { type: 'protective', radius: 10, tension: 0.8, path: [3, 4, 5, 6, 7, 8, 9, 10, 11] },
      { type: 'patchout', radius: 10, tension: 0.8, group: 'Patching out top 2 cassette', path: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
      { type: 'patchout', radius: 10, tension: 0.8, group: 'Patching out top 10 cassette', path: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10,11] },
],
  },

  'odf-lisa-600-splice-left-bottom': {
    animation: { enabled: true, mode: 'sequential', duration: 0.5 },
    waypoints: [],
    cables: [],
  },

      'odf-lisa-900-max-left': {
    camera:    { theta: 16.05, phi: 71.62, radius: 2.5286, target: { x: 0.3706, y: 1.3349, z: 0.5856 } },
    animation: { enabled: false, mode: 'sequential', duration: 0.5 },
    waypoints: [
      { id: 1, x: 100, y: 2400, z: 200 },
      { id: 2, x: 100, y: 1700, z: 200 },
      { id: 3, x: 150, y: 1700, z: 200 },
      { id: 4, x: 100, y: 1200, z: 200 },
      { id: 5, x: 150, y: 1200, z: 200 },
      { id: 6, x: 100, y: -200, z: 200 },
      { id: 7, x: 100, y: 900, z: 200 },
      { id: 8, x: 150, y: 900, z: 200 },
      { id: 9, x: 100, y: 400, z: 200 },
      { id: 10, x: 150, y: 400, z: 200 },
      { id: 11, x: 550, y: 1700, z: 200 },
      { id: 12, x: 600, y: 1700, z: 200 },
      { id: 13, x: 600, y: 1120, z: 200 },
      { id: 14, x: 610, y: 1080, z: 200 },
      { id: 15, x: 630, y: 1050, z: 200 },
      { id: 16, x: 670, y: 1050, z: 200 },
      { id: 17, x: 700, y: 1080, z: 200 },
      { id: 18, x: 720, y: 1270, z: 200 },
      { id: 19, x: 750, y: 1290, z: 200 },
      { id: 20, x: 781, y: 1270, z: 200 },
      { id: 21, x: 774, y: 1150, z: 200 },
      { id: 22, x: 728, y: 1064, z: 200 },
      { id: 23, x: 671, y: 1027, z: 200 },
      { id: 24, x: 626, y: 1035, z: 200 },
      { id: 25, x: 601, y: 1058, z: 200 },
      { id: 26, x: 600, y: 1120, z: 220 },
      { id: 27, x: 602, y: 1800, z: 220 },
      { id: 28, x: 550, y: 1800, z: 220 },
      { id: 29, x: 550, y: 820, z: 200 },
      { id: 30, x: 600, y: 820, z: 200 },
      { id: 31, x: 600, y: 240, z: 200 },
      { id: 32, x: 610, y: 200, z: 200 },
      { id: 33, x: 630, y: 170, z: 200 },
      { id: 34, x: 670, y: 170, z: 200 },
      { id: 35, x: 700, y: 200, z: 200 },
      { id: 36, x: 720, y: 390, z: 200 },
      { id: 37, x: 750, y: 410, z: 200 },
      { id: 38, x: 781, y: 390, z: 200 },
      { id: 39, x: 774, y: 270, z: 200 },
      { id: 40, x: 728, y: 184, z: 200 },
      { id: 41, x: 671, y: 147, z: 200 },
      { id: 42, x: 626, y: 155, z: 200 },
      { id: 43, x: 601, y: 178, z: 200 },
      { id: 44, x: 600, y: 240, z: 220 },
      { id: 45, x: 602, y: 920, z: 220 },
      { id: 46, x: 550, y: 920, z: 220 },
      { id: 47, x: 880, y: 1088, z: 220 },
      { id: 48, x: 880, y: 118, z: 220 },
      { id: 49, x: 850, y: 98, z: 220 },
      { id: 50, x: 813, y: 118, z: 220 },
    ],
    cables: [
      { type: 'optipack', radius: 15, tension: 0, path: [1, 2, 3] },
      { type: 'optipack', radius: 15, tension: 0, path: [1, 4, 5] },
      { type: 'optipack', radius: 15, tension: 0, path: [6, 7, 8] },
      { type: 'optipack', radius: 15, tension: 0, path: [6, 9, 10] },
      { type: 'cross', radius: 15, tension: 0, path: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28] },
      { type: 'cross', radius: 15, tension: 0, path: [29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46] },
      { type: 'cross', radius: 15, tension: 0, path: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 47, 48, 49, 50, 37, 36, 35, 34, 33, 32, 31, 30, 29] },
    ],
  },

};
