const { sparkle, burst, zigzag, xmark, check, curvedArrow, bookmark } = require('./shapes');

const COLORS = { orange: '#F1481F', blue: '#4A4FF0', green: '#14A863', yellow: '#F4C430', ink: '#14140F' };

function nl2br(text) {
  return String(text).replace(/\n/g, '<br>');
}

function page(inner) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="base.css">
</head>
<body>
<div class="slide">
${inner}
</div>
<script src="fit.js"></script>
</body>
</html>`;
}

function highlight(text, { color = COLORS.green, rotate = -4, filled = false, size = 72 } = {}) {
  if (filled) {
    return `<span class="highlight-box" style="transform:rotate(${rotate}deg)">
      <span class="frame"><i class="handle-tl"></i><i class="handle-tr"></i><i class="handle-bl"></i><i class="handle-br"></i></span>
      <span style="background:${color};color:#fff;padding:6px 22px;font-family:'Baloo 2';font-weight:800;font-size:${size}px;display:inline-block;">${text}</span>
    </span>`;
  }
  return `<span class="highlight-box" style="transform:rotate(${rotate}deg);color:${color};font-family:'Baloo 2';font-weight:800;font-size:${size}px;">
    ${text}
    <span class="frame"><i class="handle-tl"></i><i class="handle-tr"></i><i class="handle-bl"></i><i class="handle-br"></i></span>
  </span>`;
}

// --- Slide type A: title -------------------------------------------------
function slideTitle({ lineTop, highlightWord, lineBottom, badge, body }) {
  return page(`
    <div class="deco" style="top:55px;left:50px;">${sparkle({ size: 92, color: COLORS.orange, rotate: -12 })}</div>
    <div class="deco" style="top:40px;left:180px;">${sparkle({ size: 44, color: COLORS.blue, rotate: 10 })}</div>
    <div class="deco" style="top:-40px;right:-50px;">${burst({ size: 210, color: COLORS.blue, petals: 8, rotate: 12 })}</div>

    <div style="position:absolute;top:300px;left:64px;width:940px;" data-fit-scale="900">
      <div style="margin-bottom:18px;">${highlight(highlightWord, { color: COLORS.green, rotate: -4, size: 76 })}</div>
      <h1 style="font-size:76px;color:${COLORS.ink};" data-fit-shrink="260" data-fit-min="40">${lineBottom}</h1>
      <div style="margin-top:26px;">${`<span class="pill" style="font-size:52px;">${badge}</span>`}</div>
      <p style="margin-top:44px;font-size:26px;font-weight:600;max-width:600px;line-height:1.5;" data-fit-shrink="220" data-fit-min="18">${body}</p>
    </div>

    <div class="deco" style="bottom:90px;left:50px;">${zigzag({ width: 150, height: 90, color: COLORS.blue, arrowHead: true })}</div>
    <div class="deco" style="bottom:70px;right:70px;display:flex;gap:14px;">
      ${xmark({ size: 46, color: COLORS.orange, rotate: -6 })}${xmark({ size: 46, color: COLORS.blue, rotate: 4 })}${xmark({ size: 46, color: COLORS.orange, rotate: -8 })}
    </div>
  `);
}

// --- Slide type B: browser quote ------------------------------------------
function slideBrowserQuote({ headlinePlain, headlineHighlight, quote, subtext }) {
  return page(`
    <div class="deco" style="top:50px;left:50px;">${sparkle({ size: 54, color: COLORS.orange, rotate: -10 })}</div>
    <div class="deco" style="top:55px;right:-5px;">${zigzag({ width: 190, height: 100, color: COLORS.blue })}</div>

    <div style="position:absolute;top:190px;left:0;width:1080px;text-align:center;" data-fit-scale="210">
      <h1 style="font-size:66px;color:${COLORS.ink};">${headlinePlain}</h1>
      <div style="margin-top:6px;">${highlight(headlineHighlight, { color: COLORS.orange, rotate: 5, size: 64 })}</div>
    </div>

    <div class="browser-card" style="position:absolute;top:420px;left:70px;width:940px;">
      <div class="bar" style="background:${COLORS.orange};">
        <span class="dot" style="background:${COLORS.cream || '#F5F0E4'};"></span>
        <span class="dot" style="background:${COLORS.cream || '#F5F0E4'};"></span>
        <span class="dot" style="background:${COLORS.green};border-color:${COLORS.ink};"></span>
      </div>
      <div class="body" style="text-align:center;">
        <div style="font-family:'Baloo 2';font-size:56px;color:${COLORS.orange};line-height:0.6;">&ldquo;</div>
        <p style="font-family:'Baloo 2';font-weight:700;font-size:36px;line-height:1.25;margin-top:10px;" data-fit-shrink="220" data-fit-min="24">${quote}</p>
        <p style="font-size:22px;font-weight:500;margin-top:22px;line-height:1.5;color:#3a382f;" data-fit-shrink="140" data-fit-min="16">${subtext}</p>
      </div>
    </div>

    <div class="deco" style="bottom:-70px;left:-70px;">${burst({ size: 240, color: COLORS.blue, petals: 8, rotate: -8 })}</div>
    <div class="deco" style="bottom:150px;right:70px;">${sparkle({ size: 66, color: COLORS.orange, rotate: 8 })}</div>
  `);
}

// --- Slide type C: checklist ------------------------------------------
function slideChecklist({ headlinePlain, headlineHighlight, items, body }) {
  const dotColors = [COLORS.blue, COLORS.orange, COLORS.yellow];
  const n = items.length;

  // Scale row height, bullet size and text size to the number of items so
  // 2 items and 6 items both fill the same vertical budget without gaps
  // or overflow, and reflow everything below the list accordingly.
  const rowGap = n <= 3 ? 90 : n <= 5 ? 66 : 50;
  const bulletSize = n <= 3 ? 52 : n <= 5 ? 44 : 36;
  const itemFontSize = n <= 3 ? 36 : n <= 5 ? 30 : 24;
  const checklistTop = 400;
  const xmarksTop = checklistTop + n * rowGap + 40;
  const bodyTop = xmarksTop + 90;

  const itemsHtml = items.map((t, i) => `
    <div class="checklist-item" style="height:${rowGap}px;">
      <span class="bullet" style="background:${dotColors[i % 3]};width:${bulletSize}px;height:${bulletSize}px;">${check({ size: Math.round(bulletSize * 0.5), color: '#fff' })}</span>
      <span style="font-family:'Baloo 2';font-weight:700;font-size:${itemFontSize}px;" data-fit-shrink="${rowGap - 6}" data-fit-min="18">${t}</span>
    </div>`).join('');

  return page(`
    <div class="deco" style="top:50px;left:56px;">${sparkle({ size: 60, color: COLORS.green, rotate: -12 })}</div>
    <div class="deco" style="top:55px;right:-5px;">${zigzag({ width: 190, height: 100, color: COLORS.blue })}</div>

    <div style="position:absolute;top:180px;left:0;width:1080px;text-align:center;" data-fit-scale="200">
      <h1 style="font-size:66px;color:${COLORS.ink};">${headlinePlain}</h1>
      <div style="margin-top:18px;">${highlight(headlineHighlight, { color: COLORS.orange, rotate: -3, size: 50, filled: true })}</div>
    </div>

    <div style="position:absolute;top:${checklistTop}px;left:150px;width:780px;">
      ${itemsHtml}
    </div>

    <div style="position:absolute;top:${xmarksTop}px;left:0;width:1080px;text-align:center;display:flex;justify-content:center;gap:16px;">
      ${xmark({ size: 42, color: COLORS.orange, rotate: -6 })}${xmark({ size: 42, color: COLORS.blue, rotate: 4 })}${xmark({ size: 42, color: COLORS.orange, rotate: -8 })}
    </div>

    <div style="position:absolute;top:${bodyTop}px;left:0;width:1080px;text-align:center;">
      <p style="font-size:26px;font-weight:600;line-height:1.6;" data-fit-shrink="220" data-fit-min="18">${nl2br(body)}</p>
    </div>

    <div class="deco" style="bottom:60px;left:60px;">${sparkle({ size: 46, color: COLORS.orange, rotate: 10 })}</div>
    <div class="deco" style="bottom:-60px;right:-60px;">${burst({ size: 220, color: COLORS.blue, petals: 8, rotate: 10 })}</div>
  `);
}

// --- Slide type D: browser statement ------------------------------------
function slideBrowserStatement({ headlinePlain, headlineHighlight, statement, subtextTop, subtextBottom }) {
  return page(`
    <div class="deco" style="top:-40px;right:-40px;">${burst({ size: 200, color: COLORS.blue, petals: 8, rotate: 18 })}</div>
    <div class="deco" style="top:60px;left:60px;">${sparkle({ size: 48, color: COLORS.orange, rotate: -10 })}</div>

    <div style="position:absolute;top:110px;left:0;width:1080px;text-align:center;" data-fit-scale="250">
      <h1 style="font-size:66px;color:${COLORS.ink};">${headlinePlain}</h1>
      <div style="margin-top:10px;">${highlight(headlineHighlight, { color: COLORS.green, rotate: -3, size: 60 })}</div>
    </div>

    <div class="browser-card" style="position:absolute;top:380px;left:80px;width:920px;">
      <div class="bar" style="background:${COLORS.blue};justify-content:space-between;">
        <span class="dot" style="background:${COLORS.orange};"></span>
        ${xmark({ size: 26, color: '#fff', rotate: 0 })}
      </div>
      <div class="body" style="text-align:center;">
        <p style="font-family:'Baloo 2';font-weight:700;font-size:34px;line-height:1.3;" data-fit-shrink="240" data-fit-min="22">${statement}</p>
        <div style="width:180px;height:5px;background:${COLORS.orange};margin:24px auto 0;border-radius:4px;"></div>
      </div>
    </div>

    <div style="position:absolute;top:850px;left:0;width:1080px;text-align:center;">
      <p style="font-size:26px;font-weight:600;" data-fit-shrink="70" data-fit-min="18">${subtextTop}</p>
      <p style="font-size:26px;font-weight:700;margin-top:6px;" data-fit-shrink="70" data-fit-min="18">${subtextBottom}</p>
    </div>

    <div class="deco" style="bottom:70px;left:50px;">${zigzag({ width: 140, height: 80, color: COLORS.blue })}</div>
    <div class="deco" style="bottom:80px;right:70px;">${sparkle({ size: 52, color: COLORS.orange, rotate: 8 })}</div>
  `);
}

// --- Slide type E: CTA / outro ------------------------------------
function slideCTA({ lineTop, badge, lineMid, highlightWord, body, ctaLine, ctaSub }) {
  return page(`
    <div class="deco" style="top:40px;left:-10px;">${zigzag({ width: 190, height: 110, color: COLORS.blue })}</div>
    <div class="deco" style="top:55px;right:60px;">${sparkle({ size: 50, color: COLORS.orange, rotate: 10 })}</div>

    <div style="position:absolute;top:150px;left:0;width:1080px;text-align:center;" data-fit-scale="820">
      <h1 style="font-size:60px;color:${COLORS.ink};">${lineTop}</h1>
      <div style="margin:14px 0;">${`<span class="pill" style="font-size:48px;">${badge}</span>`}</div>
      <h1 style="font-size:60px;color:${COLORS.ink};">${lineMid}</h1>
      <div style="margin-top:14px;">${highlight(highlightWord, { color: COLORS.blue, rotate: -3, size: 58 })}</div>
      <p style="margin-top:36px;font-size:26px;font-weight:600;max-width:680px;margin-left:auto;margin-right:auto;line-height:1.5;" data-fit-shrink="220" data-fit-min="18">${body}</p>
      <div style="width:260px;height:2px;background:${COLORS.ink};margin:34px auto;"></div>
    </div>

    <div style="position:absolute;top:1010px;left:120px;width:640px;">
      <p style="font-size:30px;font-weight:700;" data-fit-shrink="80" data-fit-min="20">${ctaLine}</p>
      <p style="font-size:24px;font-weight:500;margin-top:6px;line-height:1.5;" data-fit-shrink="90" data-fit-min="16">${ctaSub}</p>
    </div>
    <div class="deco" style="top:990px;left:660px;">${curvedArrow({ width: 140, height: 110, color: COLORS.orange })}</div>
    <div class="deco" style="bottom:70px;right:80px;">${bookmark({ size: 54 })}</div>

    <div class="deco" style="bottom:-70px;left:-70px;">${burst({ size: 230, color: COLORS.blue, petals: 8, rotate: -10 })}</div>
  `);
}

module.exports = { slideTitle, slideBrowserQuote, slideChecklist, slideBrowserStatement, slideCTA, COLORS };
