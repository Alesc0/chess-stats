import { renderHeader } from "./header";
import { resolveTheme, type ThemeColors } from "./themes";
import { renderStarEffect, renderTitleGlow } from "./titleEffects";
import { esc } from "./utils";

export type DailyActivity = {
  date: string; // "YYYY-MM-DD"
  games: number;
  wins: number;
};

const CELL = 11;
const GAP = 3;
const STRIDE = CELL + GAP;
const ROWS = 7; // Mon–Sun
const HEADER_H = 52;
const TOP_PAD = 20; // space between header and day labels
const LEFT_PAD = 32; // space for day-of-week labels
const BOTTOM_PAD = 28; // space for month labels
const LEGEND_H = 24; // bottom legend row
const RIGHT_PAD = 16;

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

function opacity(level: number): number {
  // 0 = empty, 1-4 = intensity levels
  return [0, 0.25, 0.5, 0.75, 1.0][level] ?? 0;
}

function quantize(count: number, max: number): number {
  if (count === 0) return 0;
  if (max <= 0) return 1;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function monthLabel(d: Date): string {
  return d.toLocaleString("en", { month: "short" });
}

export function renderActivityHeatmap(opts: {
  username: string;
  platform: string;
  title?: string | null;
  country?: string | null;
  activity: DailyActivity[];
  months?: number;
  mode?: string | null;
  themeName?: string;
}): string {
  const {
    username,
    platform,
    title = null,
    country = null,
    activity,
    months = 3,
    mode = null,
    themeName,
  } = opts;

  const { colors: C } = resolveTheme(themeName);

  // Build the date range: from `months` ago (aligned to Sunday start) to today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setMonth(start.getMonth() - months);
  // Align start to the previous Sunday (week column boundary)
  start.setDate(start.getDate() - start.getDay());

  // Build lookup of activity data
  const lookup = new Map<string, DailyActivity>();
  for (const d of activity) lookup.set(d.date, d);

  // Generate all dates in range
  type CellData = {
    date: Date;
    key: string;
    col: number;
    row: number;
    games: number;
    wins: number;
  };
  const cells: CellData[] = [];
  let col = 0;
  const cursor = new Date(start);

  while (cursor <= today) {
    const row = cursor.getDay(); // 0=Sun, 6=Sat
    const key = cursor.toISOString().slice(0, 10);
    const entry = lookup.get(key);
    cells.push({
      date: new Date(cursor),
      key,
      col,
      row,
      games: entry?.games ?? 0,
      wins: entry?.wins ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
    // New column when wrapping back to Sunday
    if (cursor.getDay() === 0) col++;
  }

  const totalCols = col + 1;

  // Compute max games for quantization
  const maxGames = Math.max(1, ...cells.map((c) => c.games));

  // Calculate summary stats
  const totalGames = cells.reduce((s, c) => s + c.games, 0);
  const totalWins = cells.reduce((s, c) => s + c.wins, 0);
  const activeDays = cells.filter((c) => c.games > 0).length;
  const winRate =
    totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(0) : "0";

  // Dimensions
  const gridW = totalCols * STRIDE;
  const W = LEFT_PAD + gridW + RIGHT_PAD;
  const gridH = ROWS * STRIDE;
  const H = HEADER_H + TOP_PAD + gridH + BOTTOM_PAD + LEGEND_H + 8;

  const gridX = LEFT_PAD;
  const gridY = HEADER_H + TOP_PAD;

  // Choose heatmap color: accent-based
  const heatColor = C.accent;

  // Render cells
  const cellsSvg = cells
    .map((c) => {
      const x = gridX + c.col * STRIDE;
      const y = gridY + c.row * STRIDE;
      const level = quantize(c.games, maxGames);
      const fill = level === 0 ? C.bgAlt : heatColor;
      const op = level === 0 ? 1 : opacity(level);
      const border = level === 0 ? C.border : "none";
      const sw = level === 0 ? 0.5 : 0;

      return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2"
        fill="${fill}" opacity="${op}"
        stroke="${border}" stroke-width="${sw}">
        <title>${c.key}: ${c.games} game${c.games !== 1 ? "s" : ""}${c.games > 0 ? ` (${c.wins}W / ${c.games - c.wins}L)` : ""}</title>
      </rect>`;
    })
    .join("\n    ");

  // Day-of-week labels (left side)
  const dayLabelsSvg = DAY_LABELS.map((label, i) => {
    if (!label) return "";
    const y = gridY + i * STRIDE + CELL - 1;
    return `<text x="${gridX - 6}" y="${y}" text-anchor="end" fill="${C.muted}" font-size="9" font-family="sans-serif">${label}</text>`;
  }).join("\n    ");

  // Month labels (bottom)
  const monthPositions = new Map<string, number>();
  for (const c of cells) {
    const mKey = `${c.date.getFullYear()}-${c.date.getMonth()}`;
    if (!monthPositions.has(mKey)) {
      monthPositions.set(mKey, c.col);
    }
  }
  const monthLabelsSvg = Array.from(monthPositions.entries())
    .map(([mKey, colIdx]) => {
      const [year, month] = mKey.split("-").map(Number);
      const d = new Date(year, month, 1);
      const x = gridX + colIdx * STRIDE;
      const y = gridY + gridH + 14;
      return `<text x="${x}" y="${y}" fill="${C.muted}" font-size="9" font-family="sans-serif">${monthLabel(d)}</text>`;
    })
    .join("\n    ");

  // Legend (bottom right): Less ▢▢▢▢▢ More
  const legendY = gridY + gridH + BOTTOM_PAD + 2;
  const legendX = gridX + gridW - 120;
  const legendCells = [0, 1, 2, 3, 4]
    .map((level, i) => {
      const x = legendX + 28 + i * (CELL + 2);
      const fill = level === 0 ? C.bgAlt : heatColor;
      const op = level === 0 ? 1 : opacity(level);
      const border = level === 0 ? C.border : "none";
      const sw = level === 0 ? 0.5 : 0;
      return `<rect x="${x}" y="${legendY}" width="${CELL}" height="${CELL}" rx="2" fill="${fill}" opacity="${op}" stroke="${border}" stroke-width="${sw}"/>`;
    })
    .join("\n    ");
  const legendSvg = `
    <text x="${legendX}" y="${legendY + 9}" fill="${C.muted}" font-size="9" font-family="sans-serif">Less</text>
    ${legendCells}
    <text x="${legendX + 28 + 5 * (CELL + 2) + 2}" y="${legendY + 9}" fill="${C.muted}" font-size="9" font-family="sans-serif">More</text>`;

  // Summary stats (bottom left)
  const summaryY = legendY + 9;
  const modeLabel = mode ? ` (${mode})` : "";
  const summarySvg = `
    <text x="${gridX}" y="${summaryY}" fill="${C.muted}" font-size="9" font-family="sans-serif">
      ${totalGames.toLocaleString()} games${esc(modeLabel)} · ${activeDays} active days · ${winRate}% win rate
    </text>`;

  // Header
  const headerSvg = renderHeader({
    username,
    title,
    country,
    platform,
    themeName: themeName ?? "dark",
    width: W,
  });

  // Title effects (stars, glow)
  const stars = renderStarEffect({
    title,
    width: W,
    height: H,
    clipId: "actClip",
  });
  const glow = renderTitleGlow({ title, width: W, height: H });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Activity heatmap for ${esc(username)}">
  <rect width="${W}" height="${H}" rx="12" fill="${C.bg}" stroke="${C.border}" stroke-width="1"/>

  ${glow.defs}
  ${stars.defs}

  ${headerSvg}

  ${glow.markup}
  ${stars.markup}

  <!-- Day labels -->
  ${dayLabelsSvg}

  <!-- Heatmap cells -->
  ${cellsSvg}

  <!-- Month labels -->
  ${monthLabelsSvg}

  <!-- Legend -->
  ${legendSvg}

  <!-- Summary -->
  ${summarySvg}

</svg>`;
}
