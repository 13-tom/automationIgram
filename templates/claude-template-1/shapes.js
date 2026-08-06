// Reusable decorative SVG pieces for Claude Template 1.
// Hand-built shapes matching the reference style (sticker sparkles, ink
// splat bursts, zigzag squiggles, X marks, curved arrow, bookmark) —
// not traced from any source image.

const INK = '#14140F';

const SPARKLE_PATH =
  'M50 2 C56 40 60 44 98 50 C60 56 56 60 50 98 C44 60 40 56 2 50 C40 44 44 40 50 2 Z';

function sparkle({ size = 80, color = '#F1481F', rotate = 0 } = {}) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" style="transform:rotate(${rotate}deg)">
    <path d="${SPARKLE_PATH}" transform="translate(7,8)" fill="${INK}"/>
    <path d="${SPARKLE_PATH}" fill="${color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  </svg>`;
}

function burst({ size = 140, color = '#4A4FF0', petals = 7, rotate = 0 } = {}) {
  let shapes = '';
  for (let i = 0; i < petals; i++) {
    const angle = (360 / petals) * i;
    shapes += `<ellipse cx="50" cy="16" rx="8.5" ry="21" fill="${color}" transform="rotate(${angle} 50 50)"/>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" style="transform:rotate(${rotate}deg)">
    ${shapes}<circle cx="50" cy="50" r="9" fill="${color}"/>
  </svg>`;
}

function zigzag({ width = 170, height = 90, color = '#4A4FF0', arrowHead = false } = {}) {
  const path = 'M6 72 L46 30 L76 56 L150 12';
  return `<svg width="${width}" height="${height}" viewBox="0 0 170 90">
    <path d="${path}" stroke="${INK}" stroke-width="15" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(3,3)"/>
    <path d="${path}" stroke="${color}" stroke-width="15" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    ${arrowHead ? `<path d="M138 10 L158 10 L158 30" stroke="${color}" stroke-width="15" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
  </svg>`;
}

function xmark({ size = 46, color = '#F1481F', rotate = 0 } = {}) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" style="transform:rotate(${rotate}deg)">
    <g stroke="${INK}" stroke-width="26" stroke-linecap="round" transform="translate(4,4)">
      <line x1="15" y1="15" x2="85" y2="85"/><line x1="85" y1="15" x2="15" y2="85"/>
    </g>
    <g stroke="${color}" stroke-width="19" stroke-linecap="round">
      <line x1="15" y1="15" x2="85" y2="85"/><line x1="85" y1="15" x2="15" y2="85"/>
    </g>
  </svg>`;
}

function check({ size = 26, color = '#14140F' } = {}) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path d="M4 13 L9.5 18.5 L20 6" stroke="${color}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function curvedArrow({ width = 150, height = 120, color = '#F1481F', rotate = 0 } = {}) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 150 120" style="transform:rotate(${rotate}deg)">
    <path d="M12 18 C 78 12 108 40 100 84" stroke="${color}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M78 70 L102 92 L120 64" stroke="${color}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function bookmark({ size = 50, color = INK } = {}) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path d="M6 3 H18 V21 L12 16 L6 21 Z" fill="none" stroke="${color}" stroke-width="2.2"/></svg>`;
}

module.exports = { sparkle, burst, zigzag, xmark, check, curvedArrow, bookmark, INK };
