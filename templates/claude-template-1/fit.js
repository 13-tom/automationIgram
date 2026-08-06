// Client-side auto-fit, run in the headless browser before each screenshot.
// Two strategies:
//  - data-fit-shrink="<maxHeightPx>": reduce font-size in place until the
//    element's own scrollHeight fits (used for single text blocks — the
//    element's real layout size changes, so parents like the browser-card
//    still hug the content correctly).
//  - data-fit-scale="<maxHeightPx>": uniformly transform:scale() a whole
//    multi-element block down until it fits (used for headline groups where
//    several differently-sized lines need to shrink together).
(function () {
  function shrinkToFit(el) {
    const maxH = parseFloat(el.dataset.fitShrink);
    const minSize = parseFloat(el.dataset.fitMin || '16');
    let size = parseFloat(getComputedStyle(el).fontSize);
    let guard = 0;
    while (el.scrollHeight > maxH && size > minSize && guard < 60) {
      size -= 1;
      el.style.fontSize = size + 'px';
      guard++;
    }
  }

  function scaleBlock(el) {
    const maxH = parseFloat(el.dataset.fitScale);
    el.style.transformOrigin = 'top left';
    el.style.transform = 'scale(1)';
    const natural = el.scrollHeight;
    if (natural > maxH) {
      const scale = Math.max(0.55, maxH / natural);
      el.style.transform = `scale(${scale})`;
    }
  }

  function run() {
    document.querySelectorAll('[data-fit-shrink]').forEach(shrinkToFit);
    document.querySelectorAll('[data-fit-scale]').forEach(scaleBlock);
    window.__fitDone = true;
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(run);
  } else {
    window.addEventListener('load', run);
  }
})();
