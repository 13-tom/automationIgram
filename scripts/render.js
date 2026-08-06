#!/usr/bin/env node
// Renders a carousel template's slides (HTML/CSS) to PNG via headless Chromium.
// Usage: node scripts/render.js <templateDir> [contentJson] [outDir]

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const WIDTH = 1080;
const HEIGHT = 1350;

async function main() {
  const templateDir = path.resolve(process.argv[2] || 'templates/claude-template-1');
  const contentPath = path.resolve(process.argv[3] || path.join(templateDir, 'content.sample.json'));
  const outDir = path.resolve(process.argv[4] || path.join('output', path.basename(templateDir)));

  const layouts = require(path.join(templateDir, 'layouts.js'));
  const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));

  const builders = {
    title: layouts.slideTitle,
    browserQuote: layouts.slideBrowserQuote,
    checklist: layouts.slideChecklist,
    browserStatement: layouts.slideBrowserStatement,
    cta: layouts.slideCTA,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(path.join(templateDir, 'base.css'), path.join(outDir, 'base.css'));
  fs.copyFileSync(path.join(templateDir, 'fit.js'), path.join(outDir, 'fit.js'));
  fs.cpSync(path.join(templateDir, 'fonts'), path.join(outDir, 'fonts'), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });

  for (let i = 0; i < content.slides.length; i++) {
    const slide = content.slides[i];
    const builder = builders[slide.type];
    if (!builder) throw new Error(`Unknown slide type: ${slide.type}`);

    const html = builder(slide);
    const htmlPath = path.join(outDir, `slide-${i + 1}.html`);
    fs.writeFileSync(htmlPath, html);

    await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__fitDone === true, { timeout: 5000 });

    const pngPath = path.join(outDir, `slide-${i + 1}.png`);
    await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
    console.log('rendered', pngPath);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
