const { resolveTheme } = require("./themes");
const { esc, fmt } = require("./utils");

// ── Canvas ────────────────────────────────────────────────────────────────────
const W = 480;
const H = 250;

// ── Layout ────────────────────────────────────────────────────────────────────
const HEADER_H = 52;
const DIVIDER_X = 288;
const BAR_X = 166;
const BAR_W = DIVIDER_X - BAR_X - 14; // ~108 px

// ── Donut ─────────────────────────────────────────────────────────────────────
const DONUT_CX = 370;
const DONUT_CY = 147;
const DONUT_R = 37;
const DONUT_SW = 15;

// Ceiling rating used to scale the progress bars
const RATING_REF = 3200;

// ── Font sizes ───────────────────────────────────────────────────────────────
const FS_USERNAME = 29; // header username
const FS_TITLE_BADGE = 17; // title badge (e.g. GM, IM)
const FS_COUNTRY = 18; // country text
const FS_PLATFORM = 17; // platform pill
const FS_SECTION_LBL = 15; // "RATINGS" / "RECORD" labels
const FS_ROW_LABEL = 18; // rating row label (Bullet, Blitz …)
const FS_ROW_VALUE = 20; // rating row numeric value
const FS_STAT_VALUE = 21; // W/L/D stat number
const FS_STAT_LABEL = 15; // W/L/D stat caption
const FS_DONUT_PCT = 29; // donut centre win-rate percentage
const FS_DONUT_LBL = 15; // donut centre "WIN RATE" caption
const FS_FOOTER = 15; // footer game-count text
const FS_FOOTER_ICON = 30; // footer chess-piece glyph

// ── Rating row modes ──────────────────────────────────────────────────────────
const RATING_ROWS = [
  { label: "Bullet", key: "bullet", y: 88 },
  { label: "Blitz", key: "blitz", y: 113 },
  { label: "Rapid", key: "rapid", y: 138 },
  { label: "Puzzle", key: "puzzle", y: 163 },
];

// ── Donut arc segment ────────────────────────────────────────────────────────
// Draws one arc of a donut chart using stroke-dasharray on a full circle.
// startAngle is in degrees, 0 = 12 o'clock.
function donutArc(cx, cy, r, sw, total, count, startDeg, color) {
  if (total === 0 || count === 0) return "";
  const circ = 2 * Math.PI * r;
  const segLen = (count / total) * circ;
  const rotateDeg = startDeg - 90;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
    stroke="${color}" stroke-width="${sw}"
    stroke-dasharray="${segLen.toFixed(3)} ${circ.toFixed(3)}"
    stroke-linecap="butt"
    transform="rotate(${rotateDeg} ${cx} ${cy})"/>`;
}

/**
 * Rating row: indicator dot · label · value · gradient progress bar.
 * The bar fill references a per-mode gradient defined in <defs>.
 */
function ratingRow({ label, value, color, y, C }) {
  const hasVal = value != null;
  const fillW = hasVal
    ? Math.max(4, Math.round((value / RATING_REF) * BAR_W))
    : 0;
  const gradId = `ratingBarGrad_${label.toLowerCase()}`;
  return `
  <circle cx="28" cy="${y - 4}" r="4" fill="${hasVal ? color : C.border}"/>
  <text x="40" y="${y}" fill="${C.muted}" font-size="${FS_ROW_LABEL}" font-family="sans-serif">${label}</text>
  <text x="${BAR_X - 8}" y="${y}" text-anchor="end"
        fill="${hasVal ? color : C.muted}" font-size="${FS_ROW_VALUE}" font-family="monospace"
        font-weight="${hasVal ? "bold" : "normal"}">${fmt(value)}</text>
  <rect x="${BAR_X}" y="${y - 9}" width="${BAR_W}" height="6" rx="3" fill="${C.border}" opacity="0.35"/>
  ${hasVal ? `<rect x="${BAR_X}" y="${y - 9}" width="${fillW}" height="6" rx="3" fill="url(#${gradId})"/>` : ""}`;
}

// ── W/L/D stat column ────────────────────────────────────────────────────────
function statCol(label, value, color, cx, y, C) {
  return `
  <text x="${cx}" y="${y}" text-anchor="middle"
        fill="${color}" font-size="${FS_STAT_VALUE}" font-family="monospace" font-weight="bold">${value != null ? Number(value).toLocaleString() : "–"}</text>
  <text x="${cx}" y="${y + 13}" text-anchor="middle"
        fill="${C.muted}" font-size="${FS_STAT_LABEL}" font-family="sans-serif" letter-spacing="0.5">${label}</text>`;
}

/**
 * Generates an SVG stats card.
 * @param {object} stats  Normalised stats from a provider
 * @param {string} [themeName]  Theme name (dark, light, monokai, nord, solarized, dracula)
 * @returns {string} SVG markup
 */
function renderCard(stats, themeName) {
  const { colors: C } = resolveTheme(themeName);

  // ── Header measurements ──────────────────────────────────────────────────
  const usernameW = esc(stats.username).length * 10.5;
  const titleBadgeW = stats.title ? stats.title.length * 7.5 + 14 : 0;
  const titleBadgeX = 32 + usernameW + 8;
  const countryX = titleBadgeX + (stats.title ? titleBadgeW + 8 : 0);

  const wins = stats.wins ?? 0;
  const losses = stats.losses ?? 0;
  const draws = stats.draws ?? 0;
  const total = wins + losses + draws;
  const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;

  const winDeg = total > 0 ? (wins / total) * 360 : 0;
  const lossDeg = total > 0 ? (losses / total) * 360 : 0;

  const bgRing = `<circle cx="${DONUT_CX}" cy="${DONUT_CY}" r="${DONUT_R}"
    fill="none" stroke="${C.border}" stroke-width="${DONUT_SW}" opacity="0.4"/>`;
  const winArc = donutArc(
    DONUT_CX,
    DONUT_CY,
    DONUT_R,
    DONUT_SW,
    total,
    wins,
    0,
    C.win,
  );
  const lossArc = donutArc(
    DONUT_CX,
    DONUT_CY,
    DONUT_R,
    DONUT_SW,
    total,
    losses,
    winDeg,
    C.loss,
  );
  const drawArc = donutArc(
    DONUT_CX,
    DONUT_CY,
    DONUT_R,
    DONUT_SW,
    total,
    draws,
    winDeg + lossDeg,
    C.draw,
  );

  // ── W/L/D column positions ─────────────────────────────────────────────
  const COL_W = (W - DIVIDER_X - 16) / 3;
  const statY = DONUT_CY + DONUT_R + DONUT_SW / 2 + 18;
  const colX = (i) => DIVIDER_X + 8 + COL_W * i + COL_W / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"
  viewBox="0 0 ${W} ${H}" role="img" aria-label="Chess stats for ${esc(stats.username)}">

  <title>Chess Stats – ${esc(stats.username)}</title>

  <defs>
    <linearGradient id="hdrGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${C.accent}" stop-opacity="0.15"/>
      <stop offset="70%" stop-color="${C.accent}" stop-opacity="0"/>
    </linearGradient>
    <!-- Per-mode rating-bar gradients -->
    <linearGradient id="ratingBarGrad_bullet" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="${C.bullet}"/>
      <stop offset="100%" stop-color="${C.bullet}" stop-opacity="0.45"/>
    </linearGradient>
    <linearGradient id="ratingBarGrad_blitz" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="${C.blitz}"/>
      <stop offset="100%" stop-color="${C.blitz}" stop-opacity="0.45"/>
    </linearGradient>
    <linearGradient id="ratingBarGrad_rapid" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="${C.rapid}"/>
      <stop offset="100%" stop-color="${C.rapid}" stop-opacity="0.45"/>
    </linearGradient>
    <linearGradient id="ratingBarGrad_puzzle" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="${C.puzzle}"/>
      <stop offset="100%" stop-color="${C.puzzle}" stop-opacity="0.45"/>
    </linearGradient>
  </defs>

  <!-- ── Background ── -->
  <rect width="${W}" height="${H}" rx="12" fill="${C.bg}" stroke="${C.border}" stroke-width="1"/>

  <!-- ── Header gradient + left accent bar ── -->
  <clipPath id="hdrClip"><rect width="${W}" height="${HEADER_H}" rx="12"/></clipPath>
  <rect clip-path="url(#hdrClip)" width="${W}" height="${HEADER_H}" fill="url(#hdrGrad)"/>
  <rect x="0" y="10" width="3" height="${HEADER_H - 20}" rx="1.5" fill="${C.accent}"/>

  <!-- ── Header bottom border ── -->
  <line x1="0" y1="${HEADER_H}" x2="${W}" y2="${HEADER_H}" stroke="${C.border}" stroke-width="1"/>

  <!-- ── Username ── -->
  <text x="32" y="33" fill="${C.text}"
        font-size="${FS_USERNAME}" font-family="monospace" font-weight="bold" letter-spacing="0.3">${esc(stats.username)}</text>

  ${
    stats.title
      ? `
  <!-- ── Title badge ── -->
  <rect x="${titleBadgeX}" y="17" width="${titleBadgeW}" height="18" rx="4"
        fill="${C.titleBadgeBg}" stroke="${C.titleBadgeBorder}" stroke-width="1"/>
  <text x="${titleBadgeX + titleBadgeW / 2}" y="30" text-anchor="middle"
        fill="${C.titleBadgeText}" font-size="${FS_TITLE_BADGE}" font-family="monospace" font-weight="bold">${esc(stats.title)}</text>`
      : ""
  }

  ${
    stats.country
      ? `
  <!-- ── Country ── -->
  <text x="${countryX}" y="30" fill="${C.muted}" font-size="${FS_COUNTRY}" font-family="sans-serif">${esc(stats.country)}</text>`
      : ""
  }

  <!-- ── Platform pill ── -->
  <rect x="${W - 88}" y="17" width="74" height="18" rx="9" fill="${C.platform}" stroke="${C.border}" stroke-width="1"/>
  <text x="${W - 51}" y="30" text-anchor="middle" fill="${C.muted}" font-size="${FS_PLATFORM}" font-family="sans-serif">${esc(stats.platform)}</text>

  <!-- ── Section labels ── -->
  <text x="22" y="70" fill="${C.muted}" font-size="${FS_SECTION_LBL}" font-family="sans-serif" letter-spacing="1.5" opacity="0.8">RATINGS</text>
  <text x="${DIVIDER_X + 10}" y="70" fill="${C.muted}" font-size="${FS_SECTION_LBL}" font-family="sans-serif" letter-spacing="1.5" opacity="0.8">RECORD</text>

  <!-- ── Rating rows ── -->
  ${RATING_ROWS.map((r) =>
    ratingRow({
      label: r.label,
      value: stats[r.key],
      color: C[r.key],
      y: r.y,
      C,
    }),
  ).join("")}

  <!-- ── Vertical divider ── -->
  <line x1="${DIVIDER_X}" y1="${HEADER_H + 10}" x2="${DIVIDER_X}" y2="${H - 16}"
        stroke="${C.border}" stroke-width="1" opacity="0.6"/>

  <!-- ── Donut chart ── -->
  ${bgRing}
  ${winArc}
  ${lossArc}
  ${drawArc}

  <!-- Donut center labels -->
  <text x="${DONUT_CX}" y="${DONUT_CY - 4}" text-anchor="middle"
        fill="${C.text}" font-size="${FS_DONUT_PCT}" font-family="monospace" font-weight="bold">${winPct}%</text>
  <text x="${DONUT_CX}" y="${DONUT_CY + 12}" text-anchor="middle"
        fill="${C.muted}" font-size="${FS_DONUT_LBL}" font-family="sans-serif" letter-spacing="0.6">WIN RATE</text>

  <!-- ── W / L / D columns ── -->
  ${statCol("WINS", wins, C.win, colX(0), statY, C)}
  ${statCol("LOSSES", losses, C.loss, colX(1), statY, C)}
  ${statCol("DRAWS", draws, C.draw, colX(2), statY, C)}

  <!-- ── Footer ── -->
  <text x="22" y="${H - 10}" fill="${C.border}" font-size="${FS_FOOTER}" font-family="monospace">${total > 0 ? `${total.toLocaleString()} games` : ""}</text>
  <text x="${W - 18}" y="${H - 8}" text-anchor="end" fill="${C.border}" font-size="${FS_FOOTER_ICON}" font-family="serif">♟</text>
</svg>`;
}

module.exports = { renderCard };
