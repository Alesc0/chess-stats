import { renderHeader } from "./header.js";
import { resolveTheme, type ThemeColors } from "./themes.js";
import { renderStarEffect, renderTitleGlow } from "./titleEffects.js";
import { esc, fmt } from "./utils.js";
import { ChessStats, MODE } from "../types.js";

const W = 550;
const H = 250;
const HEADER_H = 52;
const DIVIDER_X = 330;
const BAR_X = 150;
const BAR_W = DIVIDER_X - BAR_X - 40;
const RATINGS_X = 22;
const DONUT_CX = 440;
const DONUT_CY = 135;
const DONUT_R = 44;
const DONUT_SW = 15;
const RATING_REF = 3200;
const FS_SECTION_LBL = 14;
const FS_ROW_LABEL = 16;
const FS_ROW_VALUE = 16;
const FS_STAT_VALUE = 18;
const FS_STAT_LABEL = 12;
const FS_DONUT_PCT = 22;
const FS_DONUT_LBL = 10;
const FS_SECTION_GAMES = 12;
const RATING_Y_START = 100;
const RATING_Y_END = 168;

function recentGamesRow(recentGames: any[], C: ThemeColors): string {
  const TYPE_LABEL: Record<string, string> = {
    bullet: "bul",
    blitz: "blz",
    rapid: "rap",
  };
  if (!recentGames || recentGames.length === 0) return "";
  const DOT_R = 13;
  const DOT_SPACING = 30;
  const startX = RATINGS_X + 10;
  const y = 210;
  return recentGames
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
        <text x="${cx}" y="${y + 4}" text-anchor="middle" fill="${C.bg}" font-size="9" font-family="monospace" font-weight="bold">${letter}</text>
        <text x="${cx}" y="${y + DOT_R + 10}" text-anchor="middle" fill="${C.muted}" font-size="8" font-family="sans-serif" opacity="0.8">${typeLabel}</text>`;
    })
    .join("");
}

function donutArc(
  cx: number,
  cy: number,
  r: number,
  sw: number,
  total: number,
  count: number,
  startDeg: number,
  color: string,
): string {
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
  const fillW = hasVal
    ? Math.max(4, Math.round((value! / RATING_REF) * BAR_W))
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

function statCol(
  label: string,
  value: number,
  color: string,
  cx: number,
  y: number,
  C: ThemeColors,
): string {
  return `
  <text x="${cx}" y="${y}" text-anchor="middle"
        fill="${color}" font-size="${FS_STAT_VALUE}" font-family="monospace" font-weight="bold">${value != null ? Number(value).toLocaleString() : "N/A"}</text>
  <text x="${cx}" y="${y + 14}" text-anchor="middle"
        fill="${C.muted}" font-size="${FS_STAT_LABEL}" font-family="sans-serif" letter-spacing="0.5">${label}</text>`;
}

export function statsCard(
  stats: ChessStats,
  themeName?: string,
  modes: MODE[] = [MODE.bullet, MODE.blitz, MODE.rapid],
): string {
  const { colors: C } = resolveTheme(themeName);

  const sortedRatingRows = modes
    .map((mode: MODE, i: number) => {
      const key = mode.toLowerCase();
      const ySpan =
        modes.length > 1
          ? (RATING_Y_END - RATING_Y_START) / (modes.length - 1)
          : 0;
      return {
        key,
        label: mode.toUpperCase(),
        y:
          modes.length === 1
            ? (RATING_Y_START + RATING_Y_END) / 2
            : RATING_Y_START + i * ySpan,
      };
    })
    .filter((r) => r.key in stats);

  const wins = stats.wins ?? 0;
  const losses = stats.losses ?? 0;
  const draws = stats.draws ?? 0;
  const total = wins + losses + draws;
  const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;
  const winDeg = total > 0 ? (wins / total) * 360 : 0;
  const lossDeg = total > 0 ? (losses / total) * 360 : 0;

  const bgRing = `<circle cx="${DONUT_CX}" cy="${DONUT_CY}" r="${DONUT_R}" fill="none" stroke="${C.border}" stroke-width="${DONUT_SW}" opacity="0.4"/>`;
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

  const COL_W = (W - DIVIDER_X - 16) / 3;
  const statY = DONUT_CY + DONUT_R + DONUT_SW + 25;
  const colX = (i: number) => DIVIDER_X + 8 + COL_W * i + COL_W / 2;

  const snow = renderStarEffect({
    title: stats.title,
    width: W,
    height: H,
    count: 14,
    clipId: "starClip",
  });
  const glow = renderTitleGlow({ title: stats.title, width: W, height: H });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"
  viewBox="0 0 ${W} ${H}" role="img" aria-label="Chess stats for ${esc(stats.username)}">

  <title>Chess Stats – ${esc(stats.username)}</title>

  <defs>
    ${snow.defs}
    ${glow.defs}
    
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

  <rect width="${W}" height="${H}" rx="12" fill="${C.bg}" stroke="${C.border}" stroke-width="1"/>

  ${renderHeader({ ...stats, themeName, width: W })}

  <text x="22" y="70" fill="${C.muted}" font-size="${FS_SECTION_LBL}" font-family="sans-serif" letter-spacing="1.5" opacity="0.8">RATINGS</text>
  
  <text x="${DIVIDER_X + 10}" y="70" fill="${C.muted}" font-size="${FS_SECTION_LBL}" font-family="sans-serif" letter-spacing="1.5" opacity="0.8">RECORD</text>

  <text x="${DIVIDER_X + COL_W * 2}" y="70" fill="${C.muted}" font-size="${FS_SECTION_GAMES}" font-family="monospace">${total > 0 ? `${total.toLocaleString()} games` : ""}</text>

  <line x1="10" y1="78" x2="${DIVIDER_X - 10}" y2="75" stroke="${C.border}" stroke-width="1" opacity="0.6"/>

  ${sortedRatingRows.map((r) => ratingRow({ label: r.label, value: stats[r.key], color: (C as any)[r.key], y: r.y, C })).join("")}

  ${recentGamesRow(stats.recentGames, C)}

  <line x1="${DIVIDER_X}" y1="${HEADER_H + 10}" x2="${DIVIDER_X}" y2="${H - 14}" stroke="${C.border}" stroke-width="1" opacity="0.6"/>

  ${bgRing}
  ${winArc}
  ${lossArc}
  ${drawArc}

  <text x="${DONUT_CX}" y="${DONUT_CY + 4}" text-anchor="middle"
        fill="${C.text}" font-size="${FS_DONUT_PCT}" font-family="monospace" font-weight="bold">${winPct}%</text>
  <text x="${DONUT_CX}" y="${DONUT_CY + 18}" text-anchor="middle"
        fill="${C.muted}" font-size="${FS_DONUT_LBL}" font-family="sans-serif" letter-spacing="0.6">WR</text>

  ${statCol("WINS", wins, C.win, colX(0), statY, C)}
  <line x1="${colX(0) + COL_W / 2}" y1="${statY - 20}" x2="${colX(0) + COL_W / 2}" y2="${statY + 15}" stroke="${C.border}" stroke-width="1" opacity="0.6"/>
  ${statCol("LOSSES", losses, C.loss, colX(1), statY, C)}
  <line x1="${colX(1) + COL_W / 2}" y1="${statY - 20}" x2="${colX(1) + COL_W / 2}" y2="${statY + 15}" stroke="${C.border}" stroke-width="1" opacity="0.6"/>
  ${statCol("DRAWS", draws, C.draw, colX(2), statY, C)}

  ${glow.markup}
  ${snow.markup}
</svg>`;
}
