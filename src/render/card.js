const { resolveTheme } = require("./themes");
const { esc, fmt } = require("./utils");
const { renderStarEffect, renderTitleGlow } = require("./titleEffects");

// ── Canvas ────────────────────────────────────────────────────────────────────
const W = 550;
const H = 250;

// ── Layout ────────────────────────────────────────────────────────────────────
const HEADER_H = 52;
const DIVIDER_X = 330;
const BAR_X = 150;
const BAR_W = DIVIDER_X - BAR_X - 40; // ~132 px
const RATINGS_X = 22;

// ── Donut ─────────────────────────────────────────────────────────────────────
const DONUT_CX = 440;
const DONUT_CY = 135;
const DONUT_R = 44;
const DONUT_SW = 15;

// Ceiling rating used to scale the progress bars
const RATING_REF = 3200;

// ── Font sizes ───────────────────────────────────────────────────────────────
const FS_USERNAME = 19; // header username
const FS_TITLE_BADGE = 12; // title badge (e.g. GM, IM)
const FS_COUNTRY = 10; // country text
const FS_PLATFORM = 12; // platform pill
const FS_SECTION_LBL = 14; // "RATINGS" / "RECORD" labels
const FS_ROW_LABEL = 16; // rating row label (Bullet, Blitz …)
const FS_ROW_VALUE = 16; // rating row numeric value
const FS_STAT_VALUE = 18; // W/L/D stat number
const FS_STAT_LABEL = 12; // W/L/D stat caption
const FS_DONUT_PCT = 22; // donut centre win-rate percentage
const FS_DONUT_LBL = 10; // donut centre "WIN RATE" caption
const FS_SECTION_GAMES = 12; // footer game-count text

// ── Recent games row ────────────────────────────────────────────────────────
// Renders up to 5 coloured result indicators (W/L/D) with game type label.
function recentGamesRow(recentGames, C) {
  const TYPE_LABEL = { bullet: "bul", blitz: "blz", rapid: "rap" };

  if (!recentGames || recentGames.length === 0) return "";
  const DOT_R = 13;
  const DOT_SPACING = 30;
  const startX = RATINGS_X + 10;
  const y = 210;

  const dots = recentGames
    .map((game, i) => {
      const { result, type } =
        typeof game === "string" ? { result: game, type: "blitz" } : game;
      const cx = startX + i * DOT_SPACING;
      const color =
        result === "win" ? C.win : result === "loss" ? C.loss : C.draw;
      const letter = result === "win" ? "W" : result === "loss" ? "L" : "D";
      const typeLabel = TYPE_LABEL[type] ?? type.slice(0, 3);

      return `
        <rect rx="3" ry="3" x="${cx - DOT_R}" y="${y - DOT_R}" width="${DOT_R * 2}" height="${DOT_R * 2}" fill="${color}" opacity="0.85"/>

        <text x="${cx}" y="${y + 4}" text-anchor="middle"
        fill="${C.bg}" font-size="9" font-family="monospace" font-weight="bold">${letter}</text>
        
        <text x="${cx}" y="${y + DOT_R + 10}" text-anchor="middle"
        fill="${C.muted}" font-size="8" font-family="sans-serif" opacity="0.8">${typeLabel}</text>`;
    })
    .join("");

  return `${dots}`;
}

// ── Rating row modes ──────────────────────────────────────────────────────────
const ALL_RATING_ROWS = [
  { label: "Bullet", key: "bullet" },
  { label: "Blitz", key: "blitz" },
  { label: "Rapid", key: "rapid" },
  { label: "Puzzle", key: "puzzle" },
];
const RATING_Y_START = 100;
const RATING_Y_END = 168;

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
  <circle cx="${RATINGS_X}" cy="${y - 4}" r="3" fill="${hasVal ? color : C.border}"/>

  <text x="${RATINGS_X + 10}" y="${y}" fill="${C.muted}" font-size="${FS_ROW_LABEL}" font-family="sans-serif">${label}</text>

  <text x="${BAR_X - 8}" y="${y}" text-anchor="end"
        fill="${hasVal ? color : C.muted}" font-size="${FS_ROW_VALUE}" font-family="monospace"
        font-weight="${hasVal ? "bold" : "normal"}">${fmt(value)}</text>

  <rect x="${BAR_X}" y="${y - 7}" width="${BAR_W}" height="5" rx="2" fill="${C.border}" opacity="0.35"/>
  ${hasVal ? `<rect x="${BAR_X}" y="${y - 7}" width="${fillW}" height="5" rx="2" fill="url(#${gradId})"/>` : ""}`;
}

// ── W/L/D stat column ────────────────────────────────────────────────────────
function statCol(label, value, color, cx, y, C) {
  return `
  <text x="${cx}" y="${y}" text-anchor="middle"
        fill="${color}" font-size="${FS_STAT_VALUE}" font-family="monospace" font-weight="bold">${value != null ? Number(value).toLocaleString() : "N/A"}</text>
  <text x="${cx}" y="${y + 14}" text-anchor="middle"
        fill="${C.muted}" font-size="${FS_STAT_LABEL}" font-family="sans-serif" letter-spacing="0.5">${label}</text>`;
}

/**
 * Generates an SVG stats card.
 * @param {object} stats  Normalised stats from a provider
 * @param {string} [themeName]  Theme name (dark, light, monokai, nord, solarized, dracula)
 * @param {string[]} [modes]  Which rating rows to show, e.g. ["bullet","blitz"]
 * @returns {string} SVG markup
 */
function renderCard(stats, themeName, modes) {
  const { colors: C } = resolveTheme(themeName);

  // ── Filter and position rating rows ───────────────────────────────────────
  const selectedKeys =
    Array.isArray(modes) && modes.length > 0
      ? modes
      : ["bullet", "blitz", "rapid"];
  const RATING_ROWS = ALL_RATING_ROWS.filter((r) =>
    selectedKeys.includes(r.key),
  ).map((r, i, arr) => ({
    ...r,
    y:
      arr.length === 1
        ? Math.round((RATING_Y_START + RATING_Y_END) / 2)
        : Math.round(
            RATING_Y_START +
              (i * (RATING_Y_END - RATING_Y_START)) / (arr.length - 1),
          ),
  }));

  // ── Header measurements ──────────────────────────────────────────────────
  const usernameW = esc(stats.username).length * 8;
  const titleBadgeW = stats.title ? stats.title.length * 7 + 11 : 0;
  const titleBadgeX = 30 + usernameW + FS_USERNAME;
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
  const statY = DONUT_CY + DONUT_R + DONUT_SW + 25;
  const colX = (i) => DIVIDER_X + 8 + COL_W * i + COL_W / 2;

  // ── Title effects ──────────────────────────────────────────────────────
  const snow = renderStarEffect({
    title: stats.title,
    width: W,
    height: H,
    count: 14,
    clipId: "starClip",
  });
  const glow = renderTitleGlow({ title: stats.title, width: W, height: H });

  // Sort rating rows by value (descending)
  const sortedRatingRows = RATING_ROWS.sort((a, b) => {
    const aVal = stats[a.key] ?? 0;
    const bVal = stats[b.key] ?? 0;
    return bVal - aVal;
  }).map((r, i, arr) => ({
    ...r,
    y:
      arr.length === 1
        ? Math.round((RATING_Y_START + RATING_Y_END) / 2)
        : Math.round(
            RATING_Y_START +
              (i * (RATING_Y_END - RATING_Y_START)) / (arr.length - 1),
          ),
  }));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"
  viewBox="0 0 ${W} ${H}" role="img" aria-label="Chess stats for ${esc(stats.username)}">

  <title>Chess Stats – ${esc(stats.username)}</title>

  <defs>
    ${snow.defs}
    ${glow.defs}
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
  <rect x="0" y="9" width="3" height="${HEADER_H - 18}" rx="1.5" fill="${C.accent}"/>

  <!-- ── Header bottom border ── -->
  <line x1="0" y1="${HEADER_H}" x2="${W}" y2="${HEADER_H}" stroke="${C.border}" stroke-width="1"/>

  <!-- ── Username ── -->
  <text x="22" y="35" fill="${C.text}"
        font-size="${FS_USERNAME}" font-family="monospace" font-weight="bold" letter-spacing="0.3">${esc(stats.username)}</text>

  ${
    stats.title
      ? `
  <!-- ── Title badge ── -->
  <rect x="${titleBadgeX}" y="19" width="${titleBadgeW}" height="18" rx="5"
        fill="${C.titleBadgeBg}" stroke="${C.titleBadgeBorder}" stroke-width="1"/>
  <text x="${titleBadgeX + titleBadgeW / 2}" y="32" text-anchor="middle"
        fill="${C.titleBadgeText}" font-size="${FS_TITLE_BADGE}" font-family="monospace" font-weight="bold">${esc(stats.title)}</text>`
      : ""
  }

  ${
    stats.country
      ? `
  <!-- ── Country ── -->
  <text x="${countryX}" y="33" fill="${C.muted}" font-size="${FS_COUNTRY}" font-family="sans-serif">${esc(stats.country)}</text>`
      : "Unknown country"
  }

  <!-- ── Platform pill ── -->
  <rect x="${W - 92}" y="19" width="${stats.platform.length * 8}" height="18" rx="9" fill="${C.platform}" stroke="${C.border}" stroke-width="1"/>
  <text x="${W - 55}" y="32" text-anchor="middle" fill="${C.muted}" font-size="${FS_PLATFORM}" font-family="sans-serif">${esc(stats.platform)}</text>

  <!-- ── Section labels ── -->
  <text x="22" y="70" fill="${C.muted}" font-size="${FS_SECTION_LBL}" font-family="sans-serif" letter-spacing="1.5" opacity="0.8">RATINGS</text>

  <text x="${DIVIDER_X + 10}" y="70" fill="${C.muted}" font-size="${FS_SECTION_LBL}" font-family="sans-serif" letter-spacing="1.5" opacity="0.8">RECORD</text>

  <text x="${DIVIDER_X + COL_W * 2}" y="70" fill="${C.muted}" font-size="${FS_SECTION_GAMES}" font-family="monospace">${total > 0 ? `${total.toLocaleString()} games` : ""}</text>

  <!-- ── Horizontal divider ── -->
  <line x1="10" y1="78" x2="${DIVIDER_X - 10}" y2="75"
        stroke="${C.border}" stroke-width="1" opacity="0.6"/>

  <!-- ── Rating rows ── -->
  ${sortedRatingRows
    .map((r) =>
      ratingRow({
        label: r.label,
        value: stats[r.key],
        color: C[r.key],
        y: r.y,
        C,
      }),
    )
    .join("")}

  <!-- ── Recent games ── -->
  ${recentGamesRow(stats.recentGames, C)}

  <!-- ── Vertical divider ── -->
  <line x1="${DIVIDER_X}" y1="${HEADER_H + 10}" x2="${DIVIDER_X}" y2="${H - 14}"
        stroke="${C.border}" stroke-width="1" opacity="0.6"/>

  <!-- ── Donut chart ── -->
  ${bgRing}
  ${winArc}
  ${lossArc}
  ${drawArc}

  <!-- Donut center labels -->
  <text x="${DONUT_CX}" y="${DONUT_CY + 4}" text-anchor="middle"
        fill="${C.text}" font-size="${FS_DONUT_PCT}" font-family="monospace" font-weight="bold">${winPct}%</text>
  <text x="${DONUT_CX}" y="${DONUT_CY + 18}" text-anchor="middle"
        fill="${C.muted}" font-size="${FS_DONUT_LBL}" font-family="sans-serif" letter-spacing="0.6">WR</text>

  <!-- ── W / L / D columns ── -->
  ${statCol("WINS", wins, C.win, colX(0), statY, C)}

  <line x1="${colX(0) + COL_W / 2}" y1="${statY - 20}" x2="${colX(0) + COL_W / 2}" y2="${statY + 15}"
        stroke="${C.border}" stroke-width="1" opacity="0.6"/>

  ${statCol("LOSSES", losses, C.loss, colX(1), statY, C)}

   <line x1="${colX(1) + COL_W / 2}" y1="${statY - 20}" x2="${colX(1) + COL_W / 2}" y2="${statY + 15}"
        stroke="${C.border}" stroke-width="1" opacity="0.6"/>
        
  ${statCol("DRAWS", draws, C.draw, colX(2), statY, C)}

  ${glow.markup}
  ${snow.markup}
</svg>`;
}

module.exports = { renderCard };
