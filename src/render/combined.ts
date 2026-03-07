import { resolveTheme, type ThemeColors } from "./themes.js";
import { esc, fmt, lerp, platformUrl } from "./utils.js";
import { renderStarEffect, renderTitleGlow } from "./titleEffects.js";

const W = 650;
const H = 300;
const HEADER_H = 58;
const DIVIDER_X = 210;
const CP_L = DIVIDER_X + 10;
const CP_R = W - 12;
const CP_T = HEADER_H + 9;
const CP_B = H - 30;
const LEGEND_Y = H - 13;
const FOOTER_Y = H - 13;
const ROW_TOP = 76;
const ROW_STEP = 22;
const WLD_SEP_Y = ROW_TOP + 5 * ROW_STEP + 2;
const WLD_Y = WLD_SEP_Y + 17;
const WINPCT_Y = WLD_Y + 25;

function ratingRow({
  label,
  value,
  color,
  y,
  C,
}: {
  label: string;
  value: number | null;
  color: string;
  y: number;
  C: ThemeColors;
}): string {
  const hasVal = value != null;

  return `
  <circle cx="17" cy="${y - 5}" r="4" fill="${hasVal ? color : C.border}"/>

  <text x="26" y="${y}" fill="${C.muted}" font-size="11" font-family="sans-serif">${label}</text>

  <text x="${label.length}" y="${y}" text-anchor="end" fill="${hasVal ? color : C.border}" font-size="15" font-family="monospace" font-weight="${hasVal ? "bold" : "normal"}">${fmt(value)}</text>`;
}

function buildMiniChart({
  series,
  C,
}: {
  series: Array<{
    mode: string;
    points: Array<{ date: Date; rating: number }>;
  }>;
  C: ThemeColors;
}): string {
  const valid = series.filter((s) => s.points && s.points.length >= 2);
  const midX = (CP_L + CP_R) / 2;
  const midY = (CP_T + CP_B) / 2;

  if (valid.length === 0) {
    return `<text x="${midX}" y="${midY + 4}" text-anchor="middle"
      fill="${C.muted}" font-size="11" font-family="monospace">no data</text>`;
  }

  const multi = valid.length > 1;
  const allRatings = valid.flatMap((s) => s.points.map((p) => p.rating));
  const allDates = valid.flatMap((s) => s.points.map((p) => p.date.getTime()));
  const minR = Math.min(...allRatings);
  const maxR = Math.max(...allRatings);
  const minT = Math.min(...allDates);
  const maxT = Math.max(...allDates);
  const rPad = Math.max(10, Math.round((maxR - minR) * 0.18));
  const rMin = minR - rPad;
  const rMax = maxR + rPad;

  const toX = (t: number) => lerp(t, minT, maxT, CP_L, CP_R);
  const toY = (r: number) => lerp(r, rMin, rMax, CP_B, CP_T);

  const gridFracs = multi ? [0.5] : [0.25, 0.5, 0.75];
  const grid = gridFracs
    .map((f) => {
      const gy = lerp(f, 0, 1, CP_B, CP_T);
      const gVal = Math.round(lerp(f, 0, 1, rMin, rMax));
      return `
    <line x1="${CP_L}" y1="${gy.toFixed(1)}" x2="${CP_R}" y2="${gy.toFixed(1)}"
      stroke="${C.border}" stroke-width="1" stroke-dasharray="3 3" opacity="0.4"/>
    <text x="${CP_L - 3}" y="${(gy + 3.5).toFixed(1)}" text-anchor="end"
      fill="${C.muted}" font-size="9" font-family="monospace" opacity="0.7">${gVal}</text>`;
    })
    .join("");

  const paths = valid
    .map(({ mode, points }) => {
      const color = (C as any)[mode] ?? "#58a6ff";
      const pts = points
        .map(
          (p) =>
            `${toX(p.date.getTime()).toFixed(1)},${toY(p.rating).toFixed(1)}`,
        )
        .join(" ");
      const fX = toX(points[0].date.getTime()).toFixed(1);
      const lX = toX(points[points.length - 1].date.getTime()).toFixed(1);
      const area = `M${fX},${CP_B} L${pts.replace(/ /g, " L")} L${lX},${CP_B} Z`;
      const endX = toX(points[points.length - 1].date.getTime()).toFixed(1);
      const endY = toY(points[points.length - 1].rating).toFixed(1);
      return `
    <path d="${area}" fill="${color}" opacity="${multi ? 0.07 : 0.14}"/>
    <polyline points="${pts}" fill="none" stroke="${color}"
      stroke-width="${multi ? 1.5 : 2}" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${endX}" cy="${endY}" r="${multi ? 2.5 : 3.5}"
      fill="${color}" stroke="${C.bg}" stroke-width="1.5"/>`;
    })
    .join("");

  return `
  ${grid}
  <clipPath id="miniClip">
    <rect x="${CP_L}" y="${CP_T}" width="${CP_R - CP_L}" height="${CP_B - CP_T}"/>
  </clipPath>
  <g clip-path="url(#miniClip)">${paths}</g>`;
}

function buildLegend({
  series,
  C,
}: {
  series: Array<{
    mode: string;
    points: Array<{ date: Date; rating: number }>;
  }>;
  C: ThemeColors;
}): string {
  const valid = series.filter((s) => s.points && s.points.length >= 2);
  const CHIP_W = (CP_R - CP_L) / Math.max(valid.length, 1);

  return valid
    .map(({ mode, points }, i) => {
      const color = (C as any)[mode] ?? "#58a6ff";
      const last = points[points.length - 1].rating;
      const delta = last - points[0].rating;
      const dStr = (delta >= 0 ? "+" : "") + delta;
      const dCol = delta >= 0 ? C.win : C.loss;
      const chipX = CP_L + i * CHIP_W;
      return `
    <circle cx="${(chipX + 6).toFixed(1)}" cy="${(LEGEND_Y - 5).toFixed(1)}" r="4" fill="${color}"/>
    <text x="${(chipX + 13).toFixed(1)}" y="${LEGEND_Y}" fill="${C.muted}" font-size="11" font-family="monospace">${mode.toUpperCase()}</text>
    <text x="${(chipX + 13 + mode.length * 7.0 + 3).toFixed(1)}" y="${LEGEND_Y}" fill="${C.text}" font-size="11" font-family="monospace" font-weight="bold">${last}</text>
    <text x="${(chipX + 13 + mode.length * 7.0 + 3 + String(last).length * 7.0 + 2).toFixed(1)}" y="${LEGEND_Y}" fill="${dCol}" font-size="9" font-family="monospace"> ${dStr}</text>`;
    })
    .join("");
}

export function renderCombined(
  stats: any,
  historySeries: Array<{
    mode: string;
    points: Array<{ date: Date; rating: number }>;
  }>,
  themeName?: string,
): string {
  const { colors: C } = resolveTheme(themeName);

  const wins = stats.wins ?? 0;
  const losses = stats.losses ?? 0;
  const draws = stats.draws ?? 0;
  const total = wins + losses + draws;
  const winPct = total > 0 ? Math.round((wins / total) * 100) : null;

  const usernameW = esc(stats.username).length * 9.5;
  const titleBadgeW = stats.title ? stats.title.length * 7 + 12 : 0;
  const titleBadgeX = 28 + usernameW + 8;
  const countryX = titleBadgeX + (stats.title ? titleBadgeW + 6 : 0);
  const profileHref = platformUrl(stats.platform, stats.username);

  const chartSvg = buildMiniChart({ series: historySeries, C });
  const legendSvg = buildLegend({ series: historySeries, C });

  const snow = renderStarEffect({
    title: stats.title,
    width: W,
    height: H,
    count: 12,
    clipId: "starClipC",
  });
  const glow = renderTitleGlow({ title: stats.title, width: W, height: H });

  const ratingRows = [
    { label: "Bullet", value: stats.bullet, color: C.bullet },
    { label: "Blitz", value: stats.blitz, color: C.blitz },
    { label: "Rapid", value: stats.rapid, color: C.rapid },
    { label: "Puzzle", value: stats.puzzle, color: C.puzzle },
  ]
    .map((r, i) => ratingRow({ ...r, y: ROW_TOP + 12 + i * ROW_STEP, C }))
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
  role="img" aria-label="Chess stats for ${esc(stats.username)}">

  <title>Chess Stats – ${esc(stats.username)}</title>

  <defs>
    ${snow.defs}
    ${glow.defs}
    <linearGradient id="hdrGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"  stop-color="${C.accent}" stop-opacity="0.12"/>
      <stop offset="60%" stop-color="${C.accent}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="divGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${C.border}" stop-opacity="0"/>
      <stop offset="30%"  stop-color="${C.border}" stop-opacity="1"/>
      <stop offset="70%"  stop-color="${C.border}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${C.border}" stop-opacity="0"/>
    </linearGradient>
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
    <clipPath id="hdrClip"><rect width="${W}" height="${HEADER_H}" rx="12"/></clipPath>
  </defs>

  <rect width="${W}" height="${H}" rx="12" fill="${C.bg}" stroke="${C.border}" stroke-width="1"/>
  <rect clip-path="url(#hdrClip)" width="${W}" height="${HEADER_H}" fill="url(#hdrGrad)"/>
  <rect x="0" y="12" width="3" height="${HEADER_H - 24}" rx="1.5" fill="${C.accent}"/>
  <line x1="0" y1="${HEADER_H}" x2="${W}" y2="${HEADER_H}" stroke="${C.border}" stroke-width="1"/>

  <a href="${profileHref}" target="_blank" rel="noopener noreferrer">
    <text x="28" y="39" fill="${C.accent}" font-size="17" font-family="monospace"
          font-weight="bold" letter-spacing="0.3" text-decoration="none">${esc(stats.username)}</text>
  </a>

  ${
    stats.title
      ? `
  <rect x="${titleBadgeX}" y="23" width="${titleBadgeW}" height="18" rx="3"
        fill="${C.titleBadgeBg}" stroke="${C.titleBadgeBorder}" stroke-width="1"/>
  <text x="${titleBadgeX + titleBadgeW / 2}" y="36" text-anchor="middle"
        fill="${C.titleBadgeText}" font-size="9" font-family="monospace" font-weight="bold">${esc(stats.title)}</text>`
      : ""
  }

  ${
    stats.country
      ? `
  <text x="${countryX}" y="39" fill="${C.muted}" font-size="11" font-family="sans-serif">${esc(stats.country)}</text>`
      : ""
  }

  <rect x="${W - 104}" y="21" width="88" height="20" rx="10" fill="${C.platform}" stroke="${C.border}" stroke-width="1"/>
  <text x="${W - 60}" y="35" text-anchor="middle" fill="${C.muted}" font-size="10" font-family="sans-serif">${esc(stats.platform)}</text>

  <text x="16" y="${ROW_TOP}" fill="${C.muted}" font-size="9" font-family="sans-serif" letter-spacing="1.3" opacity="0.7">RATINGS</text>
  ${ratingRows}

  <line x1="12" y1="${WLD_SEP_Y}" x2="${DIVIDER_X - 10}" y2="${WLD_SEP_Y}" stroke="${C.border}" stroke-width="1" opacity="0.5"/>

  <text x="38"  y="${WLD_Y}" text-anchor="middle" fill="${C.win}"  font-size="18" font-family="monospace" font-weight="bold">${wins.toLocaleString()}</text>
  <text x="38"  y="${WLD_Y + 14}" text-anchor="middle" fill="${C.muted}" font-size="9" font-family="sans-serif">W</text>
  <text x="107" y="${WLD_Y}" text-anchor="middle" fill="${C.loss}" font-size="18" font-family="monospace" font-weight="bold">${losses.toLocaleString()}</text>
  <text x="107" y="${WLD_Y + 14}" text-anchor="middle" fill="${C.muted}" font-size="9" font-family="sans-serif">L</text>
  <text x="176" y="${WLD_Y}" text-anchor="middle" fill="${C.draw}" font-size="18" font-family="monospace" font-weight="bold">${draws.toLocaleString()}</text>
  <text x="176" y="${WLD_Y + 14}" text-anchor="middle" fill="${C.muted}" font-size="9" font-family="sans-serif">D</text>

  ${
    winPct != null
      ? `
  <text x="16" y="${WINPCT_Y}" fill="${C.muted}" font-size="10" font-family="sans-serif">
    <tspan fill="${C.win}" font-weight="bold" font-family="monospace">${winPct}%</tspan>
    <tspan dx="2" font-size="9">win rate</tspan>
  </text>`
      : ""
  }

  <text x="16" y="${FOOTER_Y}" fill="${C.border}" font-size="9" font-family="monospace">${total > 0 ? `${total.toLocaleString()} games` : ""}</text>

  <line x1="${DIVIDER_X}" y1="${HEADER_H + 10}" x2="${DIVIDER_X}" y2="${H - 10}" stroke="url(#divGrad)" stroke-width="1"/>

  <line x1="${CP_L}" y1="${CP_T}" x2="${CP_L}" y2="${CP_B}" stroke="${C.border}" stroke-width="1" opacity="0.4"/>
  <line x1="${CP_L}" y1="${CP_B}" x2="${CP_R}" y2="${CP_B}" stroke="${C.border}" stroke-width="1" opacity="0.4"/>

  ${chartSvg}
  ${legendSvg}

  <text x="${W - 14}" y="${FOOTER_Y}" text-anchor="end" fill="${C.border}" font-size="20" font-family="serif">♟</text>

  ${glow.markup}
  ${snow.markup}

</svg>`;
}
