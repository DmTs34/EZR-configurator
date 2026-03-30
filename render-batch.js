/**
 * render-batch.js
 * Renders all GLB files in /components to PNG in /images.
 * Usage: node render-batch.js
 * Requires: npm install puppeteer
 */

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const ROOT       = __dirname;
const COMP_DIR   = path.join(ROOT, 'components');
const IMAGES_DIR = path.join(ROOT, 'images');
const VIEWER_URL = `file:///${ROOT.replace(/\\/g, '/')}/render-viewer.html`;

if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR);

const glbFiles = fs.readdirSync(COMP_DIR).filter(f => f.endsWith('.glb'));
console.log(`Found ${glbFiles.length} GLB files\n`);

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-web-security',
      '--allow-file-access-from-files',
      '--use-gl=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });

  for (const glb of glbFiles) {
    const name = path.basename(glb, '.glb');
    const url  = `${VIEWER_URL}?model=${encodeURIComponent(glb)}`;

    await page.goto(url, { waitUntil: 'networkidle0' });

    // Wait until the GLTFLoader signals render is done
    await page.waitForFunction(() => window._renderDone === true, { timeout: 15000 })
      .catch(() => {});

    // Small delay to let the renderer flush
    await new Promise(r => setTimeout(r, 300));

    // Screenshot the canvas element directly
    const canvasEl = await page.$('#c');
    if (canvasEl) {
      const outPath = path.join(IMAGES_DIR, name + '.png');
      await canvasEl.screenshot({ path: outPath });
      console.log(`  ✓  ${name}.png`);
    } else {
      console.warn(`  ✗  ${name} — canvas not found`);
    }
  }

  await browser.close();
  console.log(`\nDone. ${glbFiles.length} models rendered to /images`);
})();
