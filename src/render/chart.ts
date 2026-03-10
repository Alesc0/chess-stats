import { MODE } from "../types.js";
import { renderHeader } from "./header.js";
import { resolveTheme, type ThemeColors } from "./themes.js";
import { renderStarEffect, renderTitleGlow } from "./titleEffects.js";
import { esc, lerp } from "./utils.js";

const MODE_COLORS_FALLBACK: Record<string, string> = {
  bullet: "#f78166",
  blitz: "#ffa657",
  rapid: "#3fb950",
  puzzle: "#a371f7",
};

const W = 600;
const H = 250;
const PAD = { top: 58, right: 100, bottom: 40, left: 50 };
const CHART_W = W - PAD.left - PAD.right;
const CHART_H = H - PAD.top - PAD.bottom;

export function buildMiniChart({
  series,
  C,
  bounds: { left, right, top, bottom },
  clipId = "miniChartClip",
  showGrid = true,
  showEndDots = true,
}: {
  series: Array<{ mode: string; points: Array<{ date: Date; rating: number }> }>;
  C: ThemeColors;
  bounds: { left: number; right: number; top: number; bottom: number };
  clipId?: string;
  showGrid?: boolean;
  showEndDots?: boolean;
}): {
  svg: string;
  toX: (t: number) => number;
  toY: (r: number) => number;
  rMin: number;
  rMax: number;
  minT: number;
  maxT: number;
  multi: boolean;
} {
  const valid = series.filter((s) => s.points && s.points.length >= 2);
  const midX = (left + right) / 2;
  const midY = (top + bottom) / 2;
  const noopFn = (_: number) => 0;

  if (valid.length === 0) {
    return {
      svg: `<text x="${midX}" y="${midY + 4}" text-anchor="middle"
      fill="${C.muted}" font-size="11" font-family="monospace">no data</text>`,
      toX: noopFn,
      toY: noopFn,
      rMin: 0,
      rMax: 0,
      minT: 0,
      maxT: 0,
      multi: false,
    };
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

  const toX = (t: number) => lerp(t, minT, maxT, left, right);
  const toY = (r: number) => lerp(r, rMin, rMax, bottom, top);

  const gridFracs = multi ? [0.5] : [0.25, 0.5, 0.75];
  const grid = showGrid
    ? gridFracs
        .map((f) => {
          const gy = lerp(f, 0, 1, bottom, top);
          const gVal = Math.round(lerp(f, 0, 1, rMin, rMax));
          return `
    <line x1="${left}" y1="${gy.toFixed(1)}" x2="${right}" y2="${gy.toFixed(1)}"
      stroke="${C.border}" stroke-width="1" stroke-dasharray="3 3" opacity="0.4"/>
    <text x="${left - 3}" y="${(gy + 3.5).toFixed(1)}" text-anchor="end"
      fill="${C.muted}" font-size="9" font-family="monospace" opacity="0.7">${gVal}</text>`;
        })
        .join("")
    : "";

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
      const area = `M${fX},${bottom} L${pts.replace(/ /g, " L")} L${lX},${bottom} Z`;
      const endX = toX(points[points.length - 1].date.getTime()).toFixed(1);
      const endY = toY(points[points.length - 1].rating).toFixed(1);
      return `
    <path d="${area}" fill="${color}" opacity="${multi ? 0.07 : 0.14}"/>
    <polyline points="${pts}" fill="none" stroke="${color}"
      stroke-width="${multi ? 1.5 : 2}" stroke-linejoin="round" stroke-linecap="round"/>
    ${showEndDots ? `<circle cx="${endX}" cy="${endY}" r="${multi ? 2.5 : 3.5}"
      fill="${color}" stroke="${C.bg}" stroke-width="1.5"/>` : ""}`;
    })
    .join("");

  const svg = `
  ${grid}
  <clipPath id="${clipId}">
    <rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}"/>
  </clipPath>
  <g clip-path="url(#${clipId})">${paths}</g>`;

  return { svg, toX, toY, rMin, rMax, minT, maxT, multi };
}

function niceStep(range: number, targetTicks: number): number {
  const raw = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const nice = [1, 2, 2.5, 5, 10].find((f) => f * mag >= raw)! * mag;
  return nice;
}

function formatDate(date: Date, monthsSpan: number): string {
  if (monthsSpan <= 3)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function renderChart(opts: {
  username: string;
  platform: string;
  modes: MODE | MODE[];
  points: Array<{ date: Date; rating: number }>;
  months?: number;
  themeName?: string;
  title?: string | null;
}): string {
  const {
    username,
    platform,
    modes: mode,
    points,
    months = 6,
    themeName,
    title = null,
  } = opts;
  const { colors: COLORS } = resolveTheme(themeName);

  const modes = Array.isArray(mode) ? mode : [mode];
  const series = Array.isArray(points) ? points : [points];

  const allSeries = modes
    .map((m, i) => ({
      mode: m,
      points: (series[i] ?? []) as Array<{ date: Date; rating: number }>,
    }))
    .filter((s) => s.points && s.points.length >= 2);

  const modeColor = (m: string) =>
    (COLORS as any)[m] ?? MODE_COLORS_FALLBACK[m] ?? "#58a6ff";

  if (allSeries.length === 0) {
    const modesStr = modes.join(", ");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <rect width="${W}" height="${H}" rx="12" fill="${COLORS.bg}" stroke="${COLORS.border}" stroke-width="1"/>

      <text x="${W / 2}" y="${H / 2 - 10}" text-anchor="middle" fill="${COLORS.muted}" font-size="14" font-family="monospace">No data found for ${esc(username)} (${esc(modesStr)})</text>
      
      <text x="${W / 2}" y="${H / 2 + 14}" text-anchor="middle" fill="${COLORS.border}" font-size="11" font-family="sans-serif">Try a different mode or a longer time range</text>
    </svg>`;
  }

  const {
    svg: chartPaths,
    toX,
    toY,
    rMin,
    rMax,
    minT,
    maxT,
    multi: multiMode,
  } = buildMiniChart({
    series: allSeries,
    C: COLORS,
    bounds: { left: 0, right: CHART_W, top: 0, bottom: CHART_H },
    clipId: "chartClip",
    showGrid: false,
    showEndDots: false,
  });

  const yStep = niceStep(rMax - rMin, 5);
  const yStart = Math.ceil(rMin / yStep) * yStep;
  const yTicks: number[] = [];
  for (let v = yStart; v <= rMax; v += yStep) yTicks.push(v);

  const TARGET_X_TICKS = Math.min(
    6,
    Math.max(...allSeries.map((s) => s.points.length)),
  );
  const timeStep = (maxT - minT) / (TARGET_X_TICKS - 1 || 1);
  const xTicks = Array.from({ length: TARGET_X_TICKS }, (_, i) =>
    i === TARGET_X_TICKS - 1 ? maxT : minT + i * timeStep,
  );
  const spanMonths = (maxT - minT) / (30 * 24 * 3600 * 1000);

  const annotationsSVG = allSeries.map(({ mode: m, points: pts }) => {
    const color = modeColor(m);
    const ratings = pts.map((p) => p.rating);
    const dates = pts.map((p) => p.date.getTime());

    const currentRating = ratings[ratings.length - 1];
    const peakRating = Math.max(...ratings);
    const peakIdx = ratings.indexOf(peakRating);
    const currentX = toX(dates[dates.length - 1]);
    const currentY = toY(currentRating);
    const peakX = toX(dates[peakIdx]);
    const peakY = toY(peakRating);

    const delta = currentRating - ratings[0];
    const deltaStr = (delta >= 0 ? "+" : "") + delta;
    const deltaCol = delta >= 0 ? COLORS.win : COLORS.loss;

    return `
    <!-- Annotations: ${m} -->
    ${
      peakIdx !== ratings.length - 1 && !multiMode
        ? `<circle cx="${peakX.toFixed(1)}" cy="${peakY.toFixed(1)}" r="3.5"
           fill="${COLORS.bg}" stroke="${color}" stroke-width="1.5" opacity="0.8"/>
         <text x="${Math.min(peakX, CHART_W - 36).toFixed(1)}" y="${(peakY - 7).toFixed(1)}"
           fill="${color}" font-size="9" font-family="monospace" opacity="0.8">${peakRating}</text>`
        : ""
    }

    <circle cx="${currentX.toFixed(1)}" cy="${currentY.toFixed(1)}" r="${multiMode ? 4 : 5}"
      fill="${color}" stroke="${COLORS.bg}" stroke-width="2"/>
    ${
      !multiMode
        ? `<text x="${(currentX - 6).toFixed(1)}" y="${(currentY - 9).toFixed(1)}"
           text-anchor="end" fill="${color}" font-size="11" font-family="monospace" font-weight="bold">${currentRating}</text>`
        : ""
    }
    ${
      !multiMode
        ? `<text x="${W - PAD.right - PAD.left}" y="${-18}" text-anchor="end"
           fill="${deltaCol}" font-size="12" font-family="monospace" font-weight="bold">${deltaStr}</text>`
        : ""
    }`;
  });

  const LEGEND_X = W - PAD.right + 20;
  const legendItems = allSeries.map(({ mode: m, points: pts }, i) => {
    const color = modeColor(m);
    const current = pts[pts.length - 1]?.rating ?? "–";
    const delta =
      pts.length >= 2 ? pts[pts.length - 1].rating - pts[0].rating : 0;
    const dStr = (delta >= 0 ? "+" : "") + delta;
    const dCol = delta >= 0 ? COLORS.win : COLORS.loss;
    const y = PAD.top + 30 + i * 30;
    return `
    <circle cx="${LEGEND_X + 7}" cy="${y - 4}" r="5" fill="${color}"/>

    <text x="${LEGEND_X + 16}" y="${y}" fill="${COLORS.text}" font-size="11" font-family="monospace" font-weight="bold">${String(current)}</text>

    <text x="${LEGEND_X + 16 + String(current).length * 7 + 2}" y="${y}" fill="${dCol}" font-size="10" font-family="monospace">${dStr}</text>

    <text x="${LEGEND_X + 16}" y="${y + 12}" fill="${COLORS.muted}" font-size="9" font-family="sans-serif" letter-spacing="0.5">${m.toUpperCase()}</text>`;
  });

  const gradDefs = allSeries.map(({ mode: m }) => {
    const color = modeColor(m);
    return `<linearGradient id="areaGrad_${m}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${color}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.01"/>
    </linearGradient>`;
  });

  const modesLabel = allSeries.map((s) => s.mode).join(", ");
  const stars = renderStarEffect({
    title,
    width: W,
    height: H,
    count: 12,
    clipId: "chartStarClip",
  });
  const glow = renderTitleGlow({ title, width: W, height: H });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(username)} ${esc(modesLabel)} rating history">

  <title>${esc(username)} – ${esc(modesLabel)} rating history (${esc(platform)})</title>
  
  <rect width="${W}" height="${H}" rx="12" fill="${COLORS.bg}" stroke="${COLORS.border}" stroke-width="1"/>
  <rect x="0" y="10" width="3" height="38" rx="1.5" fill="${COLORS.accent}"/>
  
  <defs>
    ${gradDefs.join("\n    ")}
    ${stars.defs}
    ${glow.defs}
    <linearGradient id="hdrGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"  stop-color="${COLORS.accent}" stop-opacity="0.15"/>
      <stop offset="70%" stop-color="${COLORS.accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  
  ${renderHeader({ username, title, platform, country: "PT", themeName, width: W })}
  
  <g transform="translate(${PAD.left}, ${PAD.top})">
  ${yTicks
    .map(
      (v) => `
    <line x1="0" y1="${toY(v).toFixed(1)}" x2="${CHART_W}" y2="${toY(v).toFixed(1)}"
    stroke="${COLORS.grid}" stroke-width="1" stroke-dasharray="4 3"/>
    <text x="-8" y="${(toY(v) + 4).toFixed(1)}" text-anchor="end"
    fill="${COLORS.muted}" font-size="10" font-family="monospace">${v}</text>`,
    )
    .join("")}
  
  ${xTicks
    .map((t, i) => {
      const x = toX(t).toFixed(1);
      const anchor =
        i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle";
      return `<text x="${x}" y="${CHART_H + 18}" text-anchor="${anchor}"
    fill="${COLORS.muted}" font-size="10" font-family="sans-serif">${formatDate(new Date(t), spanMonths)}</text>`;
    })
    .join("")}
  
  <line x1="0" y1="0" x2="0" y2="${CHART_H}" stroke="${COLORS.border}" stroke-width="1"/>

  <line x1="0" y1="${CHART_H}" x2="${CHART_W}" y2="${CHART_H}" stroke="${COLORS.border}" stroke-width="1"/>

  ${chartPaths}

  <g clip-path="url(#chartClip)">
    ${annotationsSVG.join("")}
  </g>
  </g>

  <line x1="${W - PAD.right + 10}" y1="${PAD.top}" x2="${W - PAD.right + 10}" y2="${H - PAD.bottom}" stroke="${COLORS.border}" stroke-width="1" opacity="0.6"/>

  ${
    multiMode
      ? `${legendItems.join("")}`
      : `<text x="${PAD.left}" y="42" fill="${COLORS.muted}" font-size="11" font-family="monospace">${esc(modesLabel)}</text>`
  }
  
  <text x="${PAD.left}" y="${H - 10}" fill="${COLORS.muted}" font-size="9" font-family="monospace">last ${months}mo${allSeries.length > 1 ? " · " + allSeries.length + " modes" : " · " + allSeries[0].points.length + " data points"}</text>
  
  ${glow.markup}
  ${stars.markup}
  </svg>`;
}
