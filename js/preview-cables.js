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
 *   cables    — array of { color, radius (mm), tubularSegments, radialSegments, points: [{x,y,z}] }
 *
 * Use the live editor in the preview modal for real-time adjustment,
 * then use "Copy config" and replace the matching block below.
 */

// Set to false to hide the points editor panel and camera statusbar,
// showing only the 3D scene in the preview modal.
window.PreviewPointsEditVisible = false;

window.PreviewCablesConfig = {

  'EZR_CBFX': {
    camera:    { theta: 65.3, phi: 74.7, radius: 0.212, target: { x: -0.015, y: 0.030, z: 0.128 } },
    animation: { enabled: true, mode: 'sequential', duration: 0.2 },
    cables: [
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -6, y:  125, z:  18 }, { x: -6, y: -100, z:  18 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -6, y:  125, z:  36 }, { x: -6, y: -100, z:  36 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -6, y:  125, z:  53 }, { x: -6, y: -100, z:  53 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -6, y:  125, z:  71 }, { x: -6, y: -100, z:  71 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -6, y:  125, z:  89 }, { x: -6, y: -100, z:  89 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -6, y:  125, z: 106 }, { x: -6, y: -100, z: 106 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -6, y:  125, z: 123 }, { x: -6, y: -100, z: 123 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -6, y:  125, z: 141 }, { x: -6, y: -100, z: 141 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -6, y:  125, z: 158 }, { x: -6, y: -100, z: 158 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -6, y:  125, z: 176 }, { x: -6, y: -100, z: 176 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -6, y:  125, z: 194 }, { x: -8, y: -100, z: 194 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -6, y:  125, z: 211 }, { x: -6, y: -100, z: 211 } ] },
    ],
  },

  'EZR_RET': {
    camera:    { theta: 52.92, phi: 78.37, radius: 0.1938, target: { x: -0.0205, y: 0.0207, z: 0.138 } },
    animation: { enabled: true, mode: 'sequential', duration: 0.2 },
    cables: [
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: 0, y:  125, z:  18 }, { x:  0, y: -100, z:  18 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: 0, y:  125, z:  36 }, { x:  0, y: -100, z:  36 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: 0, y:  125, z:  53 }, { x:  0, y: -100, z:  53 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: 0, y:  125, z:  71 }, { x:  0, y: -100, z:  71 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: 0, y:  125, z:  89 }, { x:  0, y: -100, z:  89 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: 0, y:  125, z: 106 }, { x:  0, y: -100, z: 106 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: 0, y:  125, z: 123 }, { x:  0, y: -100, z: 123 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: 0, y:  125, z: 141 }, { x:  0, y: -100, z: 141 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: 0, y:  125, z: 158 }, { x:  0, y: -100, z: 158 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: 0, y:  125, z: 176 }, { x:  0, y: -100, z: 176 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: 0, y:  125, z: 194 }, { x:  0, y: -100, z: 194 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: 0, y:  125, z: 211 }, { x: -1, y: -100, z: 211 } ] },
    ],
  },

  'EZR_MDL-L87-NT': {
    camera:    { theta: 55.63, phi: 80.67, radius: 0.1649, target: { x: -0.003, y: -0.0173, z: 0.0472 } },
    animation: { enabled: true, mode: 'parallel', duration: 0.4 },
    cables: [
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -32, y: -120, z: 60 }, { x: -32, y: -27, z: 60 }, { x: -24, y: -13, z: 60 }, { x: -2, y: -3, z: 60 }, { x: 26, y: -13, z: 60 }, { x: 30, y: -120, z: 60 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -32, y: -120, z: 40 }, { x: -32, y: -29, z: 40 }, { x: -24, y: -13, z: 40 }, { x: -2, y: -3, z: 40 }, { x: 26, y: -13, z: 40 }, { x: 30, y: -120, z: 40 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -32, y: -120, z: 20 }, { x: -32, y: -27, z: 20 }, { x: -24, y: -13, z: 20 }, { x: -2, y: -3, z: 20 }, { x: 26, y: -13, z: 20 }, { x: 30, y: -120, z: 20 } ] },
    ],
  },

  'EZR_MDL-L224-NT': {
    camera:    { theta: 63.42, phi: 74.72, radius: 0.2737, target: { x: -0.0469, y: -0.0492, z: 0.1125 } },
    animation: { enabled: true, mode: 'parallel', duration: 0.4 },
    cables: [
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -32, y: -200, z:  20 }, { x: -32, y: -27, z:  20 }, { x: -24, y: -13, z:  20 }, { x: -2, y: -3, z:  20 }, { x: 26, y: -13, z:  20 }, { x: 30, y: -200, z:  18 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -32, y: -200, z:  35 }, { x: -32, y: -27, z:  35 }, { x: -24, y: -13, z:  35 }, { x: -2, y: -3, z:  35 }, { x: 26, y: -13, z:  35 }, { x: 30, y: -200, z:  35 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -32, y: -200, z:  50 }, { x: -32, y: -27, z:  50 }, { x: -24, y: -13, z:  50 }, { x: -2, y: -3, z:  50 }, { x: 26, y: -13, z:  50 }, { x: 30, y: -200, z:  50 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -32, y: -200, z:  75 }, { x: -32, y: -27, z:  75 }, { x: -24, y: -13, z:  75 }, { x: -2, y: -3, z:  75 }, { x: 26, y: -13, z:  75 }, { x: 30, y: -200, z:  75 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -32, y: -199, z:  90 }, { x: -32, y: -27, z:  90 }, { x: -24, y: -13, z:  90 }, { x: -2, y: -3, z:  90 }, { x: 26, y: -13, z:  90 }, { x: 30, y: -200, z:  90 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -32, y: -200, z: 105 }, { x: -32, y: -27, z: 105 }, { x: -24, y: -13, z: 105 }, { x: -2, y: -3, z: 105 }, { x: 26, y: -13, z: 105 }, { x: 30, y: -200, z: 105 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -32, y: -200, z: 130 }, { x: -32, y: -27, z: 130 }, { x: -24, y: -13, z: 130 }, { x: -2, y: -3, z: 130 }, { x: 26, y: -13, z: 130 }, { x: 30, y: -200, z: 130 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -32, y: -200, z: 145 }, { x: -32, y: -27, z: 145 }, { x: -24, y: -13, z: 145 }, { x: -2, y: -3, z: 145 }, { x: 26, y: -13, z: 145 }, { x: 30, y: -200, z: 145 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -32, y: -200, z: 160 }, { x: -32, y: -27, z: 160 }, { x: -24, y: -13, z: 160 }, { x: -2, y: -3, z: 160 }, { x: 26, y: -13, z: 160 }, { x: 30, y: -200, z: 160 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -32, y: -200, z: 190 }, { x: -32, y: -27, z: 190 }, { x: -24, y: -13, z: 190 }, { x: -2, y: -3, z: 190 }, { x: 26, y: -13, z: 190 }, { x: 30, y: -199, z: 190 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -32, y: -200, z: 205 }, { x: -32, y: -27, z: 205 }, { x: -24, y: -13, z: 205 }, { x: -2, y: -3, z: 205 }, { x: 26, y: -13, z: 205 }, { x: 30, y: -200, z: 205 } ] },
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: -32, y: -200, z: 220 }, { x: -32, y: -27, z: 220 }, { x: -24, y: -13, z: 220 }, { x: -2, y: -3, z: 220 }, { x: 26, y: -13, z: 220 }, { x: 30, y: -200, z: 220 } ] },
    ],
  },

  // ── Preset DE cable configs ─────────────────────────────────────────────
  // Keys: 'preset_' + DE code. Camera is not set — _autoFit() handles framing.

  'preset_06LR0': {
    animation: { enabled: true, mode: 'sequential', duration: 0.5 },
    cables: [
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: 0, y: 2100, z: 18 }, { x: 0, y: 50, z: 18 } ] },
    ],
  },

  'preset_09STL': {
    camera:    { theta: 29.05, phi: 75.18, radius: 2.8228, target: { x: 0.5855, y: 1.1318, z: 0.2575 } },
    animation: { enabled: true, mode: 'sequential', duration: 0.3 },
    cables: [
      { color: '#65b8a5', radius: 10, tubularSegments: 48, radialSegments: 6, points: [ { x: 60, y: 2500, z: 100 }, { x: 60, y: 2100, z: 100 }, { x: 30, y: 2000, z: 100 }, { x: 30, y: 1500, z: 100 }, { x: 30, y: 1400, z: 100 }, { x: 60, y: 1380, z: 100 }, { x: 120, y: 1380, z: 100 } ] },
      { color: '#65b8a5', radius: 10, tubularSegments: 48, radialSegments: 6, points: [ { x: 30, y: 1500, z: 100 }, { x: 30, y: 700, z: 100 }, { x: 60, y: 680, z: 100 }, { x: 120, y: 680, z: 100 } ] },
      { color: '#65b8a5', radius: 10, tubularSegments: 48, radialSegments: 6, points: [ { x: 30, y: 700, z: 100 }, { x: 30, y: 150, z: 100 }, { x: 60, y: 130, z: 100 }, { x: 120, y: 130, z: 100 } ] },
      { color: '#34655a', radius: 10, tubularSegments: 48, radialSegments: 6, points: [ { x: 550, y: 1700, z: 200 }, { x: 600, y: 1700, z: 200 }, { x: 600, y: 1120, z: 200 }, { x: 610, y: 1080, z: 200 }, { x: 630, y: 1050, z: 200 }, { x: 670, y: 1050, z: 200 }, { x: 700, y: 1080, z: 200 }, { x: 720, y: 1170, z: 200 }, { x: 750, y: 1190, z: 200 }, { x: 781, y: 1165, z: 200 }, { x: 774, y: 1122, z: 200 }, { x: 728, y: 1064, z: 200 }, { x: 671, y: 1027, z: 200 }, { x: 626, y: 1035, z: 200 }, { x: 601, y: 1058, z: 200 }, { x: 600, y: 1120, z: 220 }, { x: 602, y: 1800, z: 220 }, { x: 550, y: 1800, z: 220 } ] },
    ],
  },

  'preset_09STR': {
    animation: { enabled: true, mode: 'sequential', duration: 0.5 },
    cables: [
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: 0, y: 2100, z: 18 }, { x: 0, y: 50, z: 18 } ] },
    ],
  },

  'preset_12IFA': {
    animation: { enabled: true, mode: 'sequential', duration: 0.5 },
    cables: [
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: 0, y: 2100, z: 18 }, { x: 0, y: 50, z: 18 } ] },
    ],
  },

  'preset_15DAS': {
    animation: { enabled: true, mode: 'sequential', duration: 0.5 },
    cables: [
      { color: '#65b8a5', radius: 4, tubularSegments: 48, radialSegments: 6, points: [ { x: 0, y: 2100, z: 18 }, { x: 0, y: 50, z: 18 } ] },
    ],
  },

};
