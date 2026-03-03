const { resolveTheme } = require("./themes");
const { esc, lerp } = require("./utils");

// Fallback colors if a mode key isn't in the theme
const MODE_COLORS_FALLBACK = {
  bullet: "#f78166",
  blitz: "#ffa657",
  rapid: "#3fb950",
  puzzle: "#a371f7",
};

const W = 600;
const H = 250;
const PAD = { top: 58, right: 30, bottom: 40, left: 58 };
const CHART_W = W - PAD.left - PAD.right;
const CHART_H = H - PAD.top - PAD.bottom;

function niceStep(range, targetTicks) {
  const raw = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const nice = [1, 2, 2.5, 5, 10].find((f) => f * mag >= raw) * mag;
  return nice;
}

function formatDate(date, monthsSpan) {
  if (monthsSpan <= 3) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

/**
 * Renders an SVG line chart supporting one or multiple rating series.
 *
 * @param {object} opts
 * @param {string} opts.username
 * @param {string} opts.platform
 * @param {string|string[]} opts.mode         Single mode string OR array of modes
 * @param {Array|Array[]}   opts.points       Points for single mode OR array of point-arrays
 * @param {number} [opts.months]
 * @param {string} [opts.themeName]
 * @returns {string} SVG markup
 */
function renderChart({ username, platform, mode, points, months = 6, themeName }) {
  const { colors: COLORS } = resolveTheme(themeName);

  // ── Normalise to multi-series format ────────────────────────────────────
  const modes  = Array.isArray(mode)   ? mode   : [mode];
  const series = Array.isArray(points) && Array.isArray(points[0])
    ? points
    : [points];

  // Pair each mode with its points array, drop empties
  const allSeries = modes
    .map((m, i) => ({ mode: m, points: series[i] ?? [] }))
    .filter((s) => s.points && s.points.length >= 2);

  const modeColor = (m) => COLORS[m] ?? MODE_COLORS_FALLBACK[m] ?? "#58a6ff";

  // ── Handle fully empty result ────────────────────────────────────────────
  if (allSeries.length === 0) {
    const modesStr = modes.join(", ");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" rx="12" fill="${COLORS.bg}" stroke="${COLORS.border}" stroke-width="1"/>
  <text x="${W / 2}" y="${H / 2 - 10}" text-anchor="middle" fill="${COLORS.muted}" font-size="14" font-family="monospace">No data found for ${esc(username)} (${esc(modesStr)})</text>
  <text x="${W / 2}" y="${H / 2 + 14}" text-anchor="middle" fill="${COLORS.border}" font-size="11" font-family="sans-serif">Try a different mode or a longer time range</text>
</svg>`;
  }

  // ── Shared scale across all series ──────────────────────────────────────
  const allRatings = allSeries.flatMap((s) => s.points.map((p) => p.rating));
  const allDates   = allSeries.flatMap((s) => s.points.map((p) => p.date.getTime()));

  const minR = Math.min(...allRatings);
  const maxR = Math.max(...allRatings);
  const minT = Math.min(...allDates);
  const maxT = Math.max(...allDates);

  const rPad = Math.max(20, Math.round((maxR - minR) * 0.12));
  const rMin = minR - rPad;
  const rMax = maxR + rPad;

  const toX = (t) => lerp(t, minT, maxT, 0, CHART_W);
  const toY = (r) => lerp(r, rMin, rMax, CHART_H, 0);

  // ── Y ticks ──────────────────────────────────────────────────────────────
  const yStep  = niceStep(rMax - rMin, 5);
  const yStart = Math.ceil(rMin / yStep) * yStep;
  const yTicks = [];
  for (let v = yStart; v <= rMax; v += yStep) yTicks.push(v);

  // ── X ticks ──────────────────────────────────────────────────────────────
  const TARGET_X_TICKS = Math.min(6, Math.max(...allSeries.map((s) => s.points.length)));
  const timeStep = (maxT - minT) / (TARGET_X_TICKS - 1 || 1);
  const xTicks = Array.from({ length: TARGET_X_TICKS }, (_, i) =>
    i === TARGET_X_TICKS - 1 ? maxT : minT + i * timeStep,
  );
  const spanMonths = (maxT - minT) / (30 * 24 * 3600 * 1000);

  const multiMode = allSeries.length > 1;

  // ── Per-series SVG elements ──────────────────────────────────────────────
  const seriesSVG = allSeries.map(({ mode: m, points: pts }, si) => {
    const color = modeColor(m);
    const ratings = pts.map((p) => p.rating);
    const dates   = pts.map((p) => p.date.getTime());

    const polyPoints = pts
      .map((p) => `${toX(p.date.getTime()).toFixed(1)},${toY(p.rating).toFixed(1)}`)
      .join(" ");

    const firstX = toX(dates[0]).toFixed(1);
    const lastX  = toX(dates[dates.length - 1]).toFixed(1);
    const areaPath = `M${firstX},${CHART_H} L${polyPoints.replace(/ /g, " L")} L${lastX},${CHART_H} Z`;

    const currentRating = ratings[ratings.length - 1];
    const peakRating    = Math.max(...ratings);
    const peakIdx       = ratings.indexOf(peakRating);
    const currentX      = toX(dates[dates.length - 1]);
    const currentY      = toY(currentRating);
    const peakX         = toX(dates[peakIdx]);
    const peakY         = toY(peakRating);

    const delta     = currentRating - ratings[0];
    const deltaStr  = (delta >= 0 ? "+" : "") + delta;
    const deltaCol  = delta >= 0 ? COLORS.win : COLORS.loss;

    // Thin lines when multi-mode to reduce clutter
    const strokeW = multiMode ? 1.8 : 2.2;
    // Only draw area fill for single-mode (too noisy when overlaid)
    const areaOpacity = multiMode ? 0.06 : 0.2;

    return `
    <!-- Series: ${m} -->
    <path d="${areaPath}" fill="${color}" opacity="${areaOpacity}"/>
    <polyline points="${polyPoints}"
      fill="none" stroke="${color}" stroke-width="${strokeW}"
      stroke-linejoin="round" stroke-linecap="round"/>

    ${peakIdx !== ratings.length - 1 && !multiMode
      ? `<circle cx="${peakX.toFixed(1)}" cy="${peakY.toFixed(1)}" r="3.5"
           fill="${COLORS.bg}" stroke="${color}" stroke-width="1.5" opacity="0.8"/>
         <text x="${Math.min(peakX, CHART_W - 36).toFixed(1)}" y="${(peakY - 7).toFixed(1)}"
           fill="${color}" font-size="9" font-family="monospace" opacity="0.8">${peakRating}</text>`
      : ""}

    <!-- Current dot + label -->
    <circle cx="${currentX.toFixed(1)}" cy="${currentY.toFixed(1)}" r="${multiMode ? 4 : 5}"
      fill="${color}" stroke="${COLORS.bg}" stroke-width="2"/>
    ${!multiMode
      ? `<text x="${(currentX - 6).toFixed(1)}" y="${(currentY - 9).toFixed(1)}"
           text-anchor="end" fill="${color}" font-size="11" font-family="monospace" font-weight="bold">${currentRating}</text>`
      : ""}
    <!-- Delta (single-mode shown in header; multi-mode shown in legend) -->
    ${!multiMode
      ? `<text x="${W - PAD.right - PAD.left}" y="${-18}" text-anchor="end"
           fill="${deltaCol}" font-size="12" font-family="monospace" font-weight="bold">${deltaStr}</text>`
      : ""}`;
  });

  // ── Legend (multi-mode only) ─────────────────────────────────────────────
  // render as pill-like items in the header area
  const LEGEND_Y = 42;
  const legendItems = allSeries.map(({ mode: m, points: pts }, i) => {
    const color   = modeColor(m);
    const current = pts[pts.length - 1]?.rating ?? "–";
    const delta   = pts.length >= 2 ? pts[pts.length - 1].rating - pts[0].rating : 0;
    const dStr    = (delta >= 0 ? "+" : "") + delta;
    const dCol    = delta >= 0 ? COLORS.win : COLORS.loss;
    const ITEM_W  = 108;
    const x       = PAD.left + i * ITEM_W;
    return `
    <circle cx="${x + 7}" cy="${LEGEND_Y - 4}" r="5" fill="${color}"/>
    <text x="${x + 16}" y="${LEGEND_Y}" fill="${COLORS.text}" font-size="11" font-family="monospace" font-weight="bold">${String(current)}</text>
    <text x="${x + 16 + String(current).length * 7 + 2}" y="${LEGEND_Y}" fill="${dCol}" font-size="10" font-family="monospace">${dStr}</text>
    <text x="${x + 16}" y="${LEGEND_Y + 12}" fill="${COLORS.muted}" font-size="9" font-family="sans-serif" letter-spacing="0.5">${m.toUpperCase()}</text>`;
  });

  // ── Unique gradient defs per series (single-mode only) ──────────────────
  const gradDefs = allSeries.map(({ mode: m }) => {
    const color = modeColor(m);
    return `<linearGradient id="areaGrad_${m}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.01"/>
    </linearGradient>`;
  });

  const modesLabel = allSeries.map((s) => s.mode).join(", ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"
  aria-label="${esc(username)} ${esc(modesLabel)} rating history on ${esc(platform)}">

  <title>${esc(username)} – ${esc(modesLabel)} rating history (${esc(platform)})</title>

  <defs>
    ${gradDefs.join("\n    ")}
    <clipPath id="chartClip">
      <rect x="0" y="0" width="${CHART_W}" height="${CHART_H}"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" rx="12" fill="${COLORS.bg}" stroke="${COLORS.border}" stroke-width="1"/>

  <!-- Header accent bar -->
  <rect x="0" y="10" width="3" height="38" rx="1.5" fill="${COLORS.accent}"/>

  <!-- Header -->
  <text x="${PAD.left}" y="22" fill="${COLORS.text}" font-size="13" font-family="monospace" font-weight="bold">${esc(username)}</text>
  <text x="${PAD.left + esc(username).length * 8}" y="22" fill="${COLORS.muted}" font-size="11" font-family="monospace"> · ${esc(platform)}</text>

  ${multiMode
    ? `<!-- Multi-mode legend -->
  ${legendItems.join("")}`
    : `<!-- Single-mode subtitle -->
  <text x="${PAD.left}" y="42" fill="${COLORS.muted}" font-size="11" font-family="monospace">${esc(modesLabel)}</text>`}

  <!-- Chart group -->
  <g transform="translate(${PAD.left}, ${PAD.top})">

    <!-- Y grid + labels -->
    ${yTicks.map((v) => `
    <line x1="0" y1="${toY(v).toFixed(1)}" x2="${CHART_W}" y2="${toY(v).toFixed(1)}"
          stroke="${COLORS.grid}" stroke-width="1" stroke-dasharray="4 3"/>
    <text x="-8" y="${(toY(v) + 4).toFixed(1)}" text-anchor="end"
          fill="${COLORS.muted}" font-size="10" font-family="monospace">${v}</text>`).join("")}

    <!-- X labels -->
    ${xTicks.map((t, i) => {
      const x      = toX(t).toFixed(1);
      const anchor = i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle";
      return `<text x="${x}" y="${CHART_H + 18}" text-anchor="${anchor}"
          fill="${COLORS.muted}" font-size="10" font-family="sans-serif">${formatDate(new Date(t), spanMonths)}</text>`;
    }).join("")}

    <!-- Axes -->
    <line x1="0" y1="0" x2="0" y2="${CHART_H}" stroke="${COLORS.border}" stroke-width="1"/>
    <line x1="0" y1="${CHART_H}" x2="${CHART_W}" y2="${CHART_H}" stroke="${COLORS.border}" stroke-width="1"/>

    <!-- Clipped series -->
    <g clip-path="url(#chartClip)">
      ${seriesSVG.join("")}
    </g>

  </g>

  <!-- Footer -->
  <text x="${PAD.left}" y="${H - 10}" fill="${COLORS.border}" font-size="9" font-family="monospace">last ${months}mo${allSeries.length > 1 ? " · " + allSeries.length + " modes" : " · " + allSeries[0].points.length + " data points"}</text>
  <text x="${W - PAD.right}" y="${H - 10}" text-anchor="end" fill="${COLORS.border}" font-size="18" font-family="serif">♟</text>
</svg>`;
}

module.exports = { renderChart };
