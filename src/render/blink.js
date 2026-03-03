const { renderCard } = require("./card");
const { renderChart } = require("./chart");

/**
 * Interval (seconds) for each "frame" of the blink animation.
 * Total cycle = FRAME_SEC * 2  (card → chart → card …)
 */
const FRAME_SEC = 5;

// Both views use these dimensions
const W = 600;
const H = 250;

/**
 * Wraps raw SVG markup so it can be embedded inside another <svg>.
 * Strips the outer <svg …> and </svg> tags and returns the inner content
 * wrapped in a <g> with an optional id / class.
 */
function svgToGroup(svgMarkup, { id, className, viewBox } = {}) {
    // Extract the original viewBox so we can apply a transform
    const vbMatch = svgMarkup.match(/viewBox="([^"]+)"/);
    const origVB = vbMatch ? vbMatch[1] : null;

    // Strip outer <svg> open / close tags, keep inner content
    const inner = svgMarkup
        .replace(/<svg[^>]*>/, "")
        .replace(/<\/svg>\s*$/, "");

    // If the original viewBox differs from the outer canvas we scale to fit
    let transform = "";
    if (origVB) {
        const [, , ow, oh] = origVB.split(/\s+/).map(Number);
        if (ow && oh && (ow !== W || oh !== H)) {
            const sx = W / ow;
            const sy = H / oh;
            const s = Math.min(sx, sy);
            const tx = (W - ow * s) / 2;
            const ty = (H - oh * s) / 2;
            transform = `transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${s.toFixed(4)})"`;
        }
    }

    const attrs = [
        id ? `id="${id}"` : "",
        className ? `class="${className}"` : "",
        transform,
    ]
        .filter(Boolean)
        .join(" ");

    return `<g ${attrs}>${inner}</g>`;
}

/**
 * Renders a single SVG that CSS-animates between the stats card and the
 * rating-history chart (a "blinking" toggle).
 *
 * @param {object}  opts
 * @param {object}  opts.stats          Normalised stats from a provider
 * @param {string}  opts.username
 * @param {string}  opts.platform       Display name ("Chess.com" / "Lichess")
 * @param {string|string[]}  opts.mode
 * @param {Array|Array[]}    opts.points
 * @param {number}  [opts.months]
 * @param {string}  [opts.themeName]
 * @returns {string} SVG markup
 */
function renderBlink({
    stats,
    username,
    platform,
    mode,
    points,
    months = 6,
    themeName,
}) {
    // Generate each view independently
    const cardSvg = renderCard(stats, themeName);
    const chartSvg = renderChart({
        username,
        platform,
        mode,
        points,
        months,
        themeName,
    });

    const cardGroup = svgToGroup(cardSvg, { className: "blink-card" });
    const chartGroup = svgToGroup(chartSvg, { className: "blink-chart" });

    const totalCycle = FRAME_SEC * 2;
    // percentage of the cycle each frame occupies
    const pct = ((FRAME_SEC / totalCycle) * 100).toFixed(1);

    return `<svg xmlns="http://www.w3.org/2000/svg"
  width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
  role="img" aria-label="Chess stats blink view for ${username}">

  <title>Chess Stats – ${username} (blink)</title>

  <style>
    /* ---------- blink animation ---------- */
    @keyframes showCard {
      0%              { opacity: 1; }
      ${pct}%         { opacity: 1; }
      ${(parseFloat(pct) + 2).toFixed(1)}%  { opacity: 0; }
      ${(100 - 2).toFixed(1)}%              { opacity: 0; }
      100%            { opacity: 1; }
    }
    @keyframes showChart {
      0%              { opacity: 0; }
      ${pct}%         { opacity: 0; }
      ${(parseFloat(pct) + 2).toFixed(1)}%  { opacity: 1; }
      ${(100 - 2).toFixed(1)}%              { opacity: 1; }
      100%            { opacity: 0; }
    }

    .blink-card  { animation: showCard  ${totalCycle}s ease-in-out infinite; }
    .blink-chart { animation: showChart ${totalCycle}s ease-in-out infinite; }
  </style>

  ${cardGroup}
  ${chartGroup}

</svg>`;
}

module.exports = { renderBlink };
