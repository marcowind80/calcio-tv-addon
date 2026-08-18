// Generazione locandine PNG per le schede del catalogo.
// Stremio/Nuvio mostra solo il poster nella griglia: incidendo le info
// sull'immagine (squadre, data/ora, canale) diventano leggibili senza
// dover aprire ogni singola scheda.
const sharp = require('sharp');

const W = 300;
const H = 450;

// Colori per le principali piattaforme italiane, così il canale è
// riconoscibile a colpo d'occhio nella griglia.
const CHANNEL_COLORS = [
  { match: /dazn/i, color: '#00d95f' },
  { match: /sky/i, color: '#0072ce' },
  { match: /amazon|prime/i, color: '#00a8e1' },
  { match: /now/i, color: '#7b3fe4' },
  { match: /rai/i, color: '#0066b3' },
  { match: /italia\s*1|canale\s*20|mediaset|20/i, color: '#e4002b' },
  { match: /sportitalia/i, color: '#f5a623' },
  { match: /onefootball/i, color: '#00e5a0' },
  { match: /como tv/i, color: '#1e88e5' },
  { match: /apple/i, color: '#a2aaad' },
];

function channelColor(channel) {
  if (!channel) return '#64748b';
  const hit = CHANNEL_COLORS.find((c) => c.match.test(channel));
  return hit ? hit.color : '#38bdf8';
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Spezza il testo su più righe in base a una lunghezza massima approssimata
// in caratteri (sufficiente: i nomi squadra sono corti).
function wrap(text, maxChars) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) {
      cur = w;
    } else if ((cur + ' ' + w).length <= maxChars) {
      cur += ' ' + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function teamBlock(name, yStart, maxChars, fontSize) {
  const lines = wrap(name, maxChars);
  return lines
    .map(
      (ln, i) =>
        `<text x="${W / 2}" y="${yStart + i * (fontSize + 4)}" fill="#f8fafc" font-size="${fontSize}" font-weight="700" text-anchor="middle" font-family="DejaVu Sans, sans-serif">${esc(ln)}</text>`
    )
    .join('');
}

function formatDateIt(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  const mesi = [
    'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
    'lug', 'ago', 'set', 'ott', 'nov', 'dic',
  ];
  const mi = parseInt(m, 10) - 1;
  return `${parseInt(d, 10)} ${mesi[mi] || m}`;
}

function buildSvg(ev) {
  const accent = channelColor(ev.channel);
  const homeLines = wrap(ev.home, 16).length;
  const homeY = 150;
  const vsY = homeY + homeLines * 26 + 14;
  const awayY = vsY + 34;

  const dataTxt = [formatDateIt(ev.date), ev.time].filter(Boolean).join('  ·  ');
  const canale = ev.channel || 'canale non disponibile';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${W}" height="6" fill="${accent}"/>

  <rect x="16" y="26" width="${W - 32}" height="30" rx="15" fill="${accent}" fill-opacity="0.16"/>
  <text x="${W / 2}" y="46" fill="${accent}" font-size="15" font-weight="700" text-anchor="middle" font-family="DejaVu Sans, sans-serif">${esc((ev.competition || 'CALCIO').toUpperCase())}</text>

  ${teamBlock(ev.home, homeY, 16, 24)}
  <text x="${W / 2}" y="${vsY}" fill="#94a3b8" font-size="15" font-weight="700" text-anchor="middle" font-family="DejaVu Sans, sans-serif">VS</text>
  ${teamBlock(ev.away, awayY, 16, 24)}

  <text x="${W / 2}" y="${H - 116}" fill="#cbd5e1" font-size="17" font-weight="600" text-anchor="middle" font-family="DejaVu Sans, sans-serif">${esc(dataTxt)}</text>

  <rect x="16" y="${H - 92}" width="${W - 32}" height="54" rx="10" fill="${accent}" fill-opacity="0.18" stroke="${accent}" stroke-opacity="0.5"/>
  ${wrap(canale, 20)
    .slice(0, 2)
    .map(
      (ln, i, arr) =>
        `<text x="${W / 2}" y="${H - 92 + (arr.length === 1 ? 34 : 24 + i * 21)}" fill="${accent}" font-size="${arr.length === 1 ? 20 : 17}" font-weight="700" text-anchor="middle" font-family="DejaVu Sans, sans-serif">${esc(ln)}</text>`
    )
    .join('')}

  <text x="${W / 2}" y="${H - 14}" fill="#475569" font-size="11" text-anchor="middle" font-family="DejaVu Sans, sans-serif">calciointv.com</text>
</svg>`;
}

async function renderPoster(ev) {
  const svg = buildSvg(ev);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { renderPoster, buildSvg };
