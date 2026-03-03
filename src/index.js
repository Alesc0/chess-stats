const express = require("express");
const { version } = require("../package.json");
const logger = require("./logger");
const pinoHttp = require("pino-http");
const { fetchChessDotCom } = require("./providers/chessdotcom");
const { fetchLichess } = require("./providers/lichess");
const {
  fetchChessDotComHistory,
  fetchLichessHistory,
} = require("./providers/history");
const { renderCard } = require("./render/card");
const { renderChart } = require("./render/chart");
const { renderCombined } = require("./render/combined");
const { resolveTheme, THEMES } = require("./render/themes");

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_THEME = process.env.DEFAULT_THEME || "dark";

// Request logging
app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res) =>
      res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
    customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    customErrorMessage:   (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        remoteAddress:
          req.headers?.["x-forwarded-for"]?.split(",")[0].trim() ??
          req.remoteAddress,
      }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);

// Simple in-memory cache: key → { data, expires }
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    logger.debug({ key }, "cache expired");
    return null;
  }
  logger.debug({ key }, "cache hit");
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
  logger.debug({ key, ttl_ms: CACHE_TTL_MS }, "cache set");
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
      logger.info({ platform: normalized, username }, "fetching stats");
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
    logger[status >= 500 ? "error" : "warn"](
      { platform, username, status, err: err.message, ...(status >= 500 && { stack: err.stack }) },
      "stats error",
    );
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

  logger.info({ platform: normalized, username, modes, months }, "fetching history");

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
          logger.debug({ platform: normalized, username, mode, months }, "cache miss — fetching history");
          if (normalized === "chessdotcom" || normalized === "chesscommunity") {
            result = await fetchChessDotComHistory(username, mode, months);
          } else if (normalized === "lichess") {
            result = await fetchLichessHistory(username, mode, months);
          } else {
            return res.status(400).json({
              error: `Unknown platform "${platform}". Use "chessdotcom" or "lichess".`,
            });
          }
          logger.debug({ platform: normalized, username, mode, points: result.points?.length ?? 0 }, "history fetched");
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
    logger[status >= 500 ? "error" : "warn"](
      { platform, username, modes, status, err: err.message, ...(status >= 500 && { stack: err.stack }) },
      "history error",
    );
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

/**
 * GET /combined/chessdotcom/:username
 * GET /combined/lichess/:username
 *
 * Returns a single unified SVG card: stats + inline mini chart.
 * Optional query params:
 *   ?mode=blitz                   single mode (default)
 *   ?mode=bullet,blitz,rapid      comma-separated for multi-mode overlay (max 4)
 *   ?months=6                     months of history (1-12)
 *   ?theme=dark                   theme name
 */
app.get("/combined/:platform/:username", async (req, res) => {
  const { platform, username } = req.params;

  const rawMode = req.query.mode ?? "blitz";
  const modes = (Array.isArray(rawMode) ? rawMode : [rawMode])
    .flatMap((m) => m.split(","))
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 4);

  const months = Math.min(12, Math.max(1, parseInt(req.query.months, 10) || 6));
  const theme = req.query.theme ?? DEFAULT_THEME;

  const normalized = platform.toLowerCase().replace(/[\.-]/g, "");
  const HISTORY_TTL = 15 * 60 * 1000;

  try {
    // Stats + all mode histories in parallel
    const statsCacheKey = `${normalized}:${username.toLowerCase()}`;
    let stats = getCached(statsCacheKey);
    const statsPromise = stats
      ? Promise.resolve(stats)
      : (async () => {
          if (normalized === "chessdotcom" || normalized === "chesscommunity") {
            stats = await fetchChessDotCom(username);
          } else if (normalized === "lichess") {
            stats = await fetchLichess(username);
          } else {
            const err = new Error(
              `Unknown platform "${platform}". Use "chessdotcom" or "lichess".`,
            );
            err.status = 400;
            throw err;
          }
          setCache(statsCacheKey, stats);
          return stats;
        })();

    const historyPromises = modes.map(async (mode) => {
      const key = `history:${normalized}:${username.toLowerCase()}:${mode}:${months}`;
      let result = getCached(key);
      if (!result) {
        if (normalized === "chessdotcom" || normalized === "chesscommunity") {
          result = await fetchChessDotComHistory(username, mode, months);
        } else if (normalized === "lichess") {
          result = await fetchLichessHistory(username, mode, months);
        }
        cache.set(key, { data: result, expires: Date.now() + HISTORY_TTL });
      }
      return result;
    });

    const [resolvedStats, ...historySeries] = await Promise.all([
      statsPromise,
      ...historyPromises,
    ]);

    const svg = renderCombined(resolvedStats, historySeries, theme);
    res
      .set("Content-Type", "image/svg+xml")
      .set("Cache-Control", `public, max-age=${HISTORY_TTL / 1000}`)
      .send(svg);
  } catch (err) {
    const status = err.status ?? 500;
    logger[status >= 500 ? "error" : "warn"](
      { platform, username, modes, status, err: err.message, ...(status >= 500 && { stack: err.stack }) },
      "combined error",
    );
    const { colors: ec } = resolveTheme(theme);
    const errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="80" viewBox="0 0 480 80">
      <rect width="480" height="80" rx="10" fill="${ec.bg}" stroke="${ec.loss}33" stroke-width="1"/>
      <text x="20" y="30" fill="${ec.loss}" font-size="13" font-family="monospace" font-weight="bold">Error</text>
      <text x="20" y="52" fill="${ec.muted}" font-size="11" font-family="monospace">${err.message.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>
    </svg>`;
    res.status(status).set("Content-Type", "image/svg+xml").send(errorSvg);
  }
});

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok", version }));

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
      combined: [
        "GET /combined/chessdotcom/:username",
        "GET /combined/lichess/:username",
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
      "/combined/lichess/DrNykterstein?mode=bullet&months=3&theme=dracula",
      "/combined/chessdotcom/hikaru?mode=blitz&theme=nord",
      "/combined/chessdotcom/hikaru?mode=bullet,blitz,rapid&months=6",
    ],
  });
});
app.listen(PORT, () => {
  logger.info({ version, port: PORT, defaultTheme: DEFAULT_THEME }, "server started");
});
