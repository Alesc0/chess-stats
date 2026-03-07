import { statsCard } from "./stats.js";
import { renderChart } from "./chart.js";
import { Style, SVG } from "@svgdotjs/svg.js";

const FRAME_SEC = 5;
const W = 600;
const H = 250;

export function svgToGroup(
  svgMarkup: string,
  opts: { id?: string; className?: string; viewBox?: string } = {},
): string {
  const { id, className } = opts;

  const vbMatch = svgMarkup.match(/viewBox="([^"]+)"/);
  const origVB = vbMatch ? vbMatch[1] : null;
  const inner = svgMarkup.replace(/<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

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

export function renderBlink(opts: {
  stats: any;
  username: string;
  platform: string;
  mode: string | string[];
  points:
    | Array<{ date: Date; rating: number }>
    | Array<Array<{ date: Date; rating: number }>>;
  months?: number;
  themeName?: string;
}): string {
  const {
    stats,
    username,
    platform,
    mode,
    points,
    months = 6,
    themeName,
  } = opts;

  const cardSvg = statsCard(stats, themeName);
  const chartSvg = renderChart({
    username,
    platform,
    mode,
    points,
    months,
    themeName,
    title: stats.title ?? null,
  });

  const cardGroup = svgToGroup(cardSvg, { className: "blink-card" });
  const chartGroup = svgToGroup(chartSvg, { className: "blink-chart" });

  const totalCycle = FRAME_SEC * 2;
  const pct = ((FRAME_SEC / totalCycle) * 100).toFixed(1);

  return `<svg xmlns="http://www.w3.org/2000/svg"
  width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
  role="img" aria-label="Chess stats blink view for ${username}">

  <title>Chess Stats – ${username} (blink)</title>

  <style>
    @keyframes showCard {
      0%                                 { opacity: 1; }
      ${pct}%                            { opacity: 1; }
      ${(parseFloat(pct) + 2).toFixed(1)}%  { opacity: 0; }
      ${(100 - 2).toFixed(1)}%              { opacity: 0; }
      100%                               { opacity: 1; }
    }
    @keyframes showChart {
      0%                                 { opacity: 0; }
      ${pct}%                            { opacity: 0; }
      ${(parseFloat(pct) + 2).toFixed(1)}%  { opacity: 1; }
      ${(100 - 2).toFixed(1)}%              { opacity: 1; }
      100%                               { opacity: 0; }
    }
    .blink-card  { animation: showCard  ${totalCycle}s ease-in-out infinite; }
    .blink-chart { animation: showChart ${totalCycle}s ease-in-out infinite; }
  </style>

  ${cardGroup}
  ${chartGroup}

</svg>`;
}
