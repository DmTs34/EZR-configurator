/**
 * configurations-catalog.js
 * Catalog of ready-made ODF configurations.
 *
 * Each entry:
 *   id        — unique identifier (used as DOM key)
 *   name      — short display name shown on the gallery card
 *   file      — path to the saved JSON configuration
 *   image     — path to the static preview image (jpg/png)
 *   shortDesc — 1–2 sentence description shown on the gallery card
 *   specs     — object with characteristics shown as a table in the preview modal.
 *               Keys are characteristic names, values are data strings.
 *               Omit a key to hide that row. Use null for "—".
 *
 * How to add a new configuration:
 *   1. Save the project JSON from the configurator (Export Project).
 *   2. Place the JSON in  examples/configurations/
 *   3. Place the preview image in  examples/configurations/images/
 *   4. Add an entry below.
 */

var CONFIGURATIONS_CATALOG = [

  {
    id:        'odf-lisa-600-max-left',
    name:      'ODF 46U LISA 600 MAX LEFT',
    file:      'examples/configurations/ODF-LISA-600-MAX-LEFT.json',
    image:     'examples/configurations/images/odf-lisa-600-max-left.jpg',
    shortDesc: 'EZR_CL 46U cabinet, 600 mm wide, maximum number of cassettes',
    specs: {
      'Base rack':               'EZR_CL 46U, 300 mm deep, 600 mm wide',
      'Chassis':                 '6× LISA 7U LEFT\n2× LISA 2U LEFT',
      'Number of cassettes':     '98',
      'LCd capacity 12-way':     '1176 LC duplex',
      'LCd capacity 18-way (HD)':'1764 LC duplex',
      'Transition':              null,
      'Splicing':                null,
      'Cable entry':             'Top or bottom',
      'Patch cord management':   '—',
      'Footprint':               '600 × 300 mm',
      'Footprint with service':  '600 × 900 mm',
      'Patch cord types':        null,
    },
  },

  {
    id:        'odf-lisa-600-splice-left-top',
    name:      'ODF 46U LISA 600 SPLICE LEFT TOP',
    file:      'examples/configurations/ODF-LISA-600-SPLICE-LEFT-TOP.json',
    image:     'examples/configurations/images/odf-lisa-600-splice-left-top.jpg',
    shortDesc: 'EZR_CL 46U cabinet, 600 mm wide, with large breakout plate, cable entry top',
    specs: {
      'Base rack':               'EZR_CL 46U, 300 mm deep, 600 mm wide',
      'Chassis':                 '6× LISA 7U LEFT',
      'Number of cassettes':     '90',
      'LCd capacity 12-way':     '1080 LC duplex',
      'LCd capacity 18-way (HD)':'1620 LC duplex',
      'Transition':              null,
      'Splicing':                'OptiPack via breakout plate',
      'Cable entry':             'Top',
      'Patch cord management':   '—',
      'Footprint':               '600 × 300 mm',
      'Footprint with service':  '600 × 900 mm',
      'Patch cord types':        null,
    },
  },

  {
    id:        'odf-lisa-600-splice-left-bottom',
    name:      'ODF 46U LISA 600 SPLICE LEFT BOTTOM',
    file:      'examples/configurations/ODF-LISA-600-SPLICE-LEFT-BOTTOM.json',
    image:     'examples/configurations/images/odf-lisa-600-splice-left-bottom.jpg',
    shortDesc: 'EZR_CL 46U cabinet, 600 mm wide, with large breakout plate, cable entry bottom',
    specs: {
      'Base rack':               'EZR_CL 46U, 300 mm deep, 600 mm wide',
      'Chassis':                 '6× LISA 7U LEFT',
      'Number of cassettes':     '90',
      'LCd capacity 12-way':     '1080 LC duplex',
      'LCd capacity 18-way (HD)':'1620 LC duplex',
      'Transition':              null,
      'Splicing':                'OptiPack via breakout plate',
      'Cable entry':             'Bottom',
      'Patch cord management':   '—',
      'Footprint':               '600 × 300 mm',
      'Footprint with service':  '600 × 900 mm',
      'Patch cord types':        null,
    },
  },

  {
    id:        'odf-lisa-900-max-left',
    name:      'ODF 46U LISA 900 MAX LEFT',
    file:      'examples/configurations/ODF-LISA-900-MAX-LEFT.json',
    image:     'examples/configurations/images/odf-lisa-900-max-left.jpg',
    shortDesc: 'EZR_CL 46U cabinet, 900 mm wide, maximum cassettes, MTP transition, splicing',
    specs: {
      'Base rack':               'EZR_CL-46U-09STL-DB02B1S11T1-A-BK',
      'Chassis':                 '6× LISA 7U LEFT<br>2× LISA 2U LEFT',
      'Number of cassettes':     '98',
      'LCd capacity 12-way':     '1176 LC duplex',
      'LCd capacity 18-way (HD)':'1764 LC duplex',
      'Transition':              'Possible',
      'Splicing':                'OptiPack cables only',
      'Cable entry':             'Top or bottom',
      'Patch cord management':   'Right side',
      'Footprint':               '900 × 300 mm',
      'Footprint with service':  '900 × 900 mm',
      'Patch cord types':        '3.5 m and 5.0 m',
    },
  },

];
