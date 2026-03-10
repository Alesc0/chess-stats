import { MODE } from "../types.js";
import { buildMiniChart } from "./chart.js";
import { renderHeader } from "./header.js";
import { resolveTheme, type ThemeColors } from "./themes.js";
import { renderStarEffect, renderTitleGlow } from "./titleEffects.js";
import { esc, fmt, platformUrl, sortedRatingRows } from "./utils.js";

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
const RATINGS_ROW_STEP = 25;
const RATINGS_X = 22;
const RATINGS_Y = 70;
const WLD_SEP_Y = ROW_TOP + 5 * RATINGS_ROW_STEP + 2;
const WLD_Y = WLD_SEP_Y + 17;
const WINPCT_Y = WLD_Y + 25;
const FS_SECTION_GAMES = 12;
const FS_SECTION_LBL = 14;
const COL_W = (W - DIVIDER_X - 16) / 3;
const FS_ROW_LABEL = 16;
const FS_ROW_VALUE = 16;

function ratingRow({
  label,
  value,
  color,
  y,
  x,
  C,
}: {
  label: string;
  value: number | null;
  color: string;
  y: number;
  x: number;
  C: ThemeColors;
}): string {
  const hasVal = value != null;
  return `
  <circle cx="${RATINGS_X}" cy="${y - 4}" r="3" fill="${hasVal ? color : C.border}"/>

  <text x="${RATINGS_X + 10}" y="${y}" fill="${C.muted}" font-size="${FS_ROW_LABEL}" font-family="sans-serif">${label}</text>
  
  <text x="${RATINGS_X + 80}" y="${y}" fill="${hasVal ? color : C.muted}" font-size="${FS_ROW_VALUE}" font-family="monospace" font-weight="${hasVal ? "bold" : "normal"}">${fmt(value)}</text>
  
  `;
}

export function renderCombined(
  stats: any,
  historySeries: Array<{
    mode: string;
    points: Array<{ date: Date; rating: number }>;
  }>,
  modes: MODE[],
  themeName?: string,
): string {
  const { colors: C } = resolveTheme(themeName);

  const wins = stats.wins ?? 0;
  const losses = stats.losses ?? 0;
  const draws = stats.draws ?? 0;
  const total = wins + losses + draws;
  const winPct = total > 0 ? Math.round((wins / total) * 100) : null;

  const { svg: chartSvg } = buildMiniChart({
    series: historySeries,
    C,
    bounds: { left: CP_L, right: CP_R, top: CP_T, bottom: CP_B },
    clipId: "miniClip",
  });

  const star = renderStarEffect({
    title: stats.title,
    width: W,
    height: H,
    count: 12,
    clipId: "starClipC",
  });

  const glow = renderTitleGlow({ title: stats.title, width: W, height: H });

  const renderRatingRows = sortedRatingRows(modes, stats).map(
    ({ mode, value }, i) => {
      return ratingRow({
        label: mode.toUpperCase(),
        value: value ?? null,
        color: C[mode] ?? C.text,
        y: RATINGS_Y + 30 + i * RATINGS_ROW_STEP,
        x: RATINGS_X,
        C,
      });
    },
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
  role="img" aria-label="Chess stats for ${esc(stats.username)}">

  <title>Chess Stats – ${esc(stats.username)}</title>

  <defs>
    ${star.defs}
    ${glow.defs}
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

  ${renderHeader({ ...stats, themeName, width: W })}

  <text x="22" y="${RATINGS_Y}" fill="${C.muted}" font-size="${FS_SECTION_LBL}" font-family="sans-serif" letter-spacing="1.5" opacity="0.8">RATINGS</text>

  ${renderRatingRows}
  
  <line x1="10" y1="78" x2="${DIVIDER_X - 5}" y2="78" stroke="${C.border}" stroke-width="1" opacity="0.6"/>
  
  <text x="${DIVIDER_X + 10}" y="${RATINGS_Y}" fill="${C.muted}" font-size="${FS_SECTION_LBL}" font-family="sans-serif" letter-spacing="1.5" opacity="0.8">RECORD</text>

  <text x="${W - (total.toLocaleString().length + "games".length) * 9}" y="${RATINGS_Y}" fill="${C.muted}" font-size="${FS_SECTION_GAMES}" font-family="monospace">${total > 0 ? `${total.toLocaleString()} games` : ""}</text>

  
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

  ${glow.markup}
  ${star.markup}

</svg>`;
}
