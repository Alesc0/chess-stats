const express = require("express");
const { fetchChessDotCom } = require("./providers/chessdotcom");
const { fetchLichess } = require("./providers/lichess");
const {
  fetchChessDotComHistory,
  fetchLichessHistory,
} = require("./providers/history");
const { renderCard } = require("./render/card");
const { renderChart } = require("./render/chart");
const { resolveTheme, THEMES } = require("./render/themes");

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_THEME = process.env.DEFAULT_THEME || "dark";

// Simple in-memory cache: key → { data, expires }
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
}

/**
 * GET /stats/chessdotcom/:username
 * GET /stats/lichess/:username
 *
 * Returns an SVG image with chess stats.
 * Optional query params:
 *   ?format=svg (default) | json  – return raw JSON instead of image
 *   ?theme=dark (default) | light | monokai | nord | solarized | dracula
 */
app.get("/stats/:platform/:username", async (req, res) => {
  const { platform, username } = req.params;
  const format = req.query.format ?? "svg";
  const theme = req.query.theme ?? DEFAULT_THEME;

  const normalized = platform.toLowerCase().replace(/[\.\-]/g, "");
  const cacheKey = `${normalized}:${username.toLowerCase()}`;

  try {
    let stats = getCached(cacheKey);

    if (!stats) {
      if (normalized === "chessdotcom" || normalized === "chesscommunity") {
        stats = await fetchChessDotCom(username);
      } else if (normalized === "lichess") {
        stats = await fetchLichess(username);
      } else {
        return res.status(400).json({
          error: `Unknown platform "${platform}". Use "chessdotcom" or "lichess".`,
        });
      }
      setCache(cacheKey, stats);
    }

    if (format === "json") {
      return res.json(stats);
    }

    const svg = renderCard(stats, theme);
    res
      .set("Content-Type", "image/svg+xml")
      .set("Cache-Control", `public, max-age=${CACHE_TTL_MS / 1000}`)
      .send(svg);
  } catch (err) {
    const status = err.status ?? 500;
    if (format === "json") {
      return res.status(status).json({ error: err.message });
    }
    // Return an SVG error card
    const { colors: ec } = resolveTheme(theme);
    const errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="80" viewBox="0 0 420 80">
      <rect width="420" height="80" rx="10" fill="${ec.bg}" stroke="${ec.loss}33" stroke-width="1"/>
      <text x="20" y="30" fill="${ec.loss}" font-size="13" font-family="monospace" font-weight="bold">Error</text>
      <text x="20" y="52" fill="${ec.muted}" font-size="11" font-family="monospace">${err.message.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>
    </svg>`;
    res.status(status).set("Content-Type", "image/svg+xml").send(errorSvg);
  }
});

/**
 * GET /history/chessdotcom/:username
 * GET /history/lichess/:username
 *
 * Returns an SVG line chart of Elo rating over time.
 * Optional query params:
 *   ?mode=blitz               single mode (default: blitz)
 *   ?mode=bullet,blitz,rapid  comma-separated for multi-mode overlay
 *   ?months=6  (1-12, how many months of history)
 *   ?format=svg (default) | json
 *   ?theme=dark (default) | light | monokai | nord | solarized | dracula
 */
app.get("/history/:platform/:username", async (req, res) => {
  const { platform, username } = req.params;

  // Accept comma-separated modes or multiple ?mode= params
  const rawMode = req.query.mode ?? "blitz";
  const modes = (Array.isArray(rawMode) ? rawMode : [rawMode])
    .flatMap((m) => m.split(","))
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 4); // cap at 4 modes

  const months = Math.min(12, Math.max(1, parseInt(req.query.months, 10) || 6));
  const format = req.query.format ?? "svg";
  const theme = req.query.theme ?? DEFAULT_THEME;

  const normalized = platform.toLowerCase().replace(/[\.-]/g, "");
  const HISTORY_TTL = 15 * 60 * 1000;

  function historyCached(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      cache.delete(key);
      return null;
    }
    return entry.data;
  }

  try {
    // Fetch all requested modes in parallel, using per-mode cache keys
    const results = await Promise.all(
      modes.map(async (mode) => {
        const cacheKey = `history:${normalized}:${username.toLowerCase()}:${mode}:${months}`;
        let result = historyCached(cacheKey);
        if (!result) {
          if (normalized === "chessdotcom" || normalized === "chesscommunity") {
            result = await fetchChessDotComHistory(username, mode, months);
          } else if (normalized === "lichess") {
            result = await fetchLichessHistory(username, mode, months);
          } else {
            return res.status(400).json({
              error: `Unknown platform "${platform}". Use "chessdotcom" or "lichess".`,
            });
          }
          cache.set(cacheKey, {
            data: result,
            expires: Date.now() + HISTORY_TTL,
          });
        }
        return result;
      }),
    );

    if (format === "json") {
      // Single mode → keep original shape; multiple → return array
      return res.json(modes.length === 1 ? results[0] : results);
    }

    const svg = renderChart({
      username,
      platform: normalized === "lichess" ? "Lichess" : "Chess.com",
      mode: results.map((r) => r.mode),
      points: results.map((r) => r.points),
      months,
      themeName: theme,
    });

    res
      .set("Content-Type", "image/svg+xml")
      .set("Cache-Control", `public, max-age=${HISTORY_TTL / 1000}`)
      .send(svg);
  } catch (err) {
    const status = err.status ?? 500;
    if (format === "json") {
      return res.status(status).json({ error: err.message });
    }
    const { colors: ec } = resolveTheme(theme);
    const errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="80" viewBox="0 0 600 80">
      <rect width="600" height="80" rx="10" fill="${ec.bg}" stroke="${ec.loss}33" stroke-width="1"/>
      <text x="20" y="30" fill="${ec.loss}" font-size="13" font-family="monospace" font-weight="bold">Error</text>
      <text x="20" y="52" fill="${ec.muted}" font-size="11" font-family="monospace">${err.message.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>
    </svg>`;
    res.status(status).set("Content-Type", "image/svg+xml").send(errorSvg);
  }
});

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Root usage hint
app.get("/", (_req, res) => {
  res.json({
    endpoints: {
      statsCard: [
        "GET /stats/chessdotcom/:username",
        "GET /stats/lichess/:username",
      ],
      eloChart: [
        "GET /history/chessdotcom/:username",
        "GET /history/lichess/:username",
      ],
    },
    options: {
      "?format=svg": "returns SVG image (default)",
      "?format=json": "returns raw JSON data",
      "?theme=dark": `card theme: ${Object.keys(THEMES).join(" | ")} (default: ${DEFAULT_THEME}; override with DEFAULT_THEME env var)`,
      "?mode=blitz":
        "game mode: bullet | blitz | rapid | puzzle — or comma-separated for multi-mode (history only)",
      "?months=6": "months of history to show: 1-12 (history only)",
    },
    examples: [
      "/stats/lichess/DrNykterstein",
      "/stats/chessdotcom/hikaru?theme=nord",
      "/history/lichess/DrNykterstein?mode=bullet&months=3&theme=dracula",
      "/history/chessdotcom/hikaru?mode=blitz&months=6&theme=light",
      "/history/chessdotcom/hikaru?mode=bullet,blitz,rapid&months=6",
    ],
  });
});

app.listen(PORT, () => {
  console.log(`Chess stats API listening on port ${PORT}`);
});
