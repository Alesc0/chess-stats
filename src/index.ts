import express from "express";
import pinoHttp from "pino-http";
import { version } from "../package.json";
import logger from "./logger";
import {
  fetchChessDotCom,
  fetchChessDotComHistory,
} from "./providers/chessdotcom";
import { fetchLichess, fetchLichessHistory } from "./providers/lichess";
import { renderBlink } from "./render/blink";
import { renderChart } from "./render/chart";
import { renderCombined } from "./render/combined";
import { statsCard } from "./render/stats";
import { resolveTheme, THEMES } from "./render/themes";
import { errorSvg, getModes } from "./render/utils";
import { ChessStats, MODE } from "./types";

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_THEME = process.env.DEFAULT_THEME || "dark";

// Request logging
app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req: any, res: any) =>
      res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
    customSuccessMessage: (req: any, res: any) =>
      `${req.method} ${req.url} ${res.statusCode}`,
    customErrorMessage: (req: any, res: any, err: any) =>
      `${req.method} ${req.url} ${res.statusCode}`,
    serializers: {
      req: (req: any) => ({
        method: req.method,
        url: req.url,
        remoteAddress:
          req.headers?.["x-forwarded-for"]?.split(",")[0].trim() ??
          req.connection?.remoteAddress,
      }),
      res: (res: any) => ({ statusCode: res.statusCode }),
    },
  }),
);

// Simple in-memory cache: key → { data, expires }
const cache = new Map<
  string,
  {
    stats: ChessStats;
    expires: number;
    data?: any; // for history cache entries
  }
>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(key: string): ChessStats | null {
  const entry = cache.get(key);
  if (!entry || !entry.stats) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    logger.debug({ key }, "cache expired");
    return null;
  }
  logger.debug({ key }, "cache hit");
  return entry.stats;
}

function setCache(key: string, stats: ChessStats) {
  cache.set(key, {
    stats,
    expires: Date.now() + CACHE_TTL_MS,
  });
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
 *   ?modes=bullet,blitz,rapid (default) – comma-separated subset to show
 */
app.get("/stats/:platform/:username", async (req, res) => {
  const { platform, username } = req.params;
  const format = req.query.format ?? "svg";
  const theme = (req.query.theme as string) ?? DEFAULT_THEME;
  const modes = getModes(req.query.modes);

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

    const svg = statsCard(stats, theme, modes);
    res
      .set("Content-Type", "image/svg+xml")
      .set("Cache-Control", `public, max-age=${CACHE_TTL_MS / 1000}`)
      .send(svg);
  } catch (err) {
    const status = err.status ?? 500;
    logger[status >= 500 ? "error" : "warn"](
      {
        platform,
        username,
        status,
        err: err.message,
        ...(status >= 500 && { stack: err.stack }),
      },
      "stats error",
    );
    if (format === "json") {
      return res.status(status).json({ error: err.message });
    }
    // Return an SVG error card
    const { colors: ec } = resolveTheme(theme);
    res
      .status(status)
      .set("Content-Type", "image/svg+xml")
      .send(errorSvg(err.message, ec));
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
  const modes = getModes(req.query.modes);

  const months = Math.min(
    12,
    Math.max(1, parseInt(req.query.months as string, 10) || 6),
  );

  const format = (req.query.format as string) ?? "svg";
  const theme = (req.query.theme as string) ?? DEFAULT_THEME;
  const { colors: C } = resolveTheme(theme);

  const normalized = platform.toLowerCase().replace(/[\.-]/g, "");
  const HISTORY_TTL = 15 * 60 * 1000;

  logger.info(
    { platform: normalized, username, modes, months },
    "fetching history",
  );

  function historyCached(key: string) {
    const entry = cache.get(key);
    if (!entry || !entry.data) return null;
    if (Date.now() > entry.expires) {
      cache.delete(key);
      return null;
    }
    return entry.data;
  }

  try {
    // Fetch stats (for the title) + all history modes in parallel
    const statsCacheKey = `${normalized}:${username.toLowerCase()}`;
    let cachedStats = getCached(statsCacheKey);
    const statsPromise = cachedStats
      ? Promise.resolve(cachedStats)
      : (async () => {
          if (normalized === "chessdotcom" || normalized === "chesscommunity") {
            cachedStats = await fetchChessDotCom(username);
          } else if (normalized === "lichess") {
            cachedStats = await fetchLichess(username);
          }
          if (cachedStats) setCache(statsCacheKey, cachedStats);
          return cachedStats;
        })().catch(() => null); // non-critical — ignore errors

    // Fetch all requested modes in parallel, using per-mode cache keys
    const [resolvedStats, ...results] = await Promise.all([
      statsPromise,
      ...modes.map(async (mode) => {
        const cacheKey = `history:${normalized}:${username.toLowerCase()}:${mode}:${months}`;
        let result = historyCached(cacheKey);
        if (!result) {
          logger.debug(
            { platform: normalized, username, mode, months },
            "cache miss — fetching history",
          );
          if (normalized === "chessdotcom" || normalized === "chesscommunity") {
            result = await fetchChessDotComHistory(username, mode, months);
          } else if (normalized === "lichess") {
            result = await fetchLichessHistory(username, mode, months);
          } else {
            return res.status(400).json({
              error: `Unknown platform "${platform}". Use "chessdotcom" or "lichess".`,
            });
          }
          logger.debug(
            {
              platform: normalized,
              username,
              mode,
              points: result.points?.length ?? 0,
            },
            "history fetched",
          );
          cache.set(cacheKey, {
            data: result,
            expires: Date.now() + HISTORY_TTL,
          } as any);
        }
        return result;
      }),
    ]);

    if (format === "json") {
      // Single mode → keep original shape; multiple → return array
      return res.json(modes.length === 1 ? results[0] : results);
    }

    const svg = renderChart({
      username,
      platform: normalized === "lichess" ? "Lichess" : "Chess.com",
      modes: results.map((r) => r.mode),
      points: results.map((r) => r.points),
      months,
      themeName: theme,
      title: resolvedStats?.title ?? null,
    });

    res
      .set("Content-Type", "image/svg+xml")
      .set("Cache-Control", `public, max-age=${HISTORY_TTL / 1000}`)
      .send(svg);
  } catch (err) {
    const status = err.status ?? 500;
    logger[status >= 500 ? "error" : "warn"](
      {
        platform,
        username,
        modes,
        status,
        err: err.message,
        ...(status >= 500 && { stack: err.stack }),
      },
      "history error",
    );
    if (format === "json") {
      return res.status(status).json({ error: err.message });
    }
    res
      .status(status)
      .set("Content-Type", "image/svg+xml")
      .send(errorSvg(err.message, C));
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
  const modes = getModes(req.query.modes);

  const months = Math.min(
    12,
    Math.max(1, parseInt(req.query.months as string, 10) || 6),
  );
  const theme = (req.query.theme as string) ?? DEFAULT_THEME;
  const { colors: C } = resolveTheme(theme);
  const normalized = platform.toLowerCase().replace(/[\.-]/g, "");
  const HISTORY_TTL = 15 * 60 * 1000;

  try {
    // Stats + all mode histories in parallel
    const statsCacheKey = `${normalized}:${username.toLowerCase()}`;
    let combinedStats = getCached(statsCacheKey);
    const statsPromise = combinedStats
      ? Promise.resolve(combinedStats)
      : (async () => {
          if (normalized === "chessdotcom" || normalized === "chesscommunity") {
            combinedStats = await fetchChessDotCom(username);
          } else if (normalized === "lichess") {
            combinedStats = await fetchLichess(username);
          } else {
            const err = new Error(
              `Unknown platform "${platform}". Use "chessdotcom" or "lichess".`,
            );
            throw err;
          }
          setCache(statsCacheKey, combinedStats);
          return combinedStats;
        })();

    const historyPromises = modes.map(async (mode) => {
      const key = `history:${normalized}:${username.toLowerCase()}:${mode}:${months}`;
      const entry = cache.get(key);
      let result = entry && Date.now() <= entry.expires ? entry.data : null;
      if (!result) {
        if (normalized === "chessdotcom" || normalized === "chesscommunity") {
          result = await fetchChessDotComHistory(username, mode, months);
        } else if (normalized === "lichess") {
          result = await fetchLichessHistory(username, mode, months);
        }
        cache.set(key, {
          data: result,
          expires: Date.now() + HISTORY_TTL,
        } as any);
      }
      return result;
    });

    const [resolvedStats, ...historySeries] = await Promise.all([
      statsPromise,
      ...historyPromises,
    ]);

    const svg = renderCombined(resolvedStats, historySeries, modes, theme);
    res
      .set("Content-Type", "image/svg+xml")
      .set("Cache-Control", `public, max-age=${HISTORY_TTL / 1000}`)
      .send(svg);
  } catch (err) {
    const status = err.status ?? 500;
    logger[status >= 500 ? "error" : "warn"](
      {
        platform,
        username,
        modes,
        status,
        err: err.message,
        ...(status >= 500 && { stack: err.stack }),
      },
      "combined error",
    );
    res
      .status(status)
      .set("Content-Type", "image/svg+xml")
      .send(errorSvg(err.message, C));
  }
});

/**
 * GET /blink/chessdotcom/:username
 * GET /blink/lichess/:username
 *
 * Returns a single SVG that CSS-animates between the stats card and the
 * rating-history chart (alternating / "blinking" view).
 * Optional query params:
 *   ?mode=blitz                   single mode (default)
 *   ?mode=bullet,blitz,rapid      comma-separated for multi-mode overlay (max 4)
 *   ?months=6                     months of history (1-12)
 *   ?theme=dark                   theme name
 */
app.get("/blink/:platform/:username", async (req, res) => {
  const { platform, username } = req.params;
  const modes = getModes(req.query.modes);

  const months = Math.min(
    12,
    Math.max(1, parseInt(req.query.months as string, 10) || 6),
  );
  const theme = (req.query.theme as string) ?? DEFAULT_THEME;
  const { colors: C } = resolveTheme(theme);

  const normalized = platform.toLowerCase().replace(/[\.-]/g, "");
  const HISTORY_TTL = 15 * 60 * 1000;

  try {
    // Stats + all mode histories in parallel
    const statsCacheKey = `${normalized}:${username.toLowerCase()}`;
    let blinkStats = getCached(statsCacheKey);
    const statsPromise = blinkStats
      ? Promise.resolve(blinkStats)
      : (async () => {
          if (normalized === "chessdotcom" || normalized === "chesscommunity") {
            blinkStats = await fetchChessDotCom(username);
          } else if (normalized === "lichess") {
            blinkStats = await fetchLichess(username);
          } else {
            const err = new Error(
              `Unknown platform "${platform}". Use "chessdotcom" or "lichess".`,
            );
            throw err;
          }
          setCache(statsCacheKey, blinkStats);
          return blinkStats;
        })();

    const historyPromises = modes.map(async (mode) => {
      const key = `history:${normalized}:${username.toLowerCase()}:${mode}:${months}`;
      const entry = cache.get(key);
      let result = entry && Date.now() <= entry.expires ? entry.data : null;
      if (!result) {
        if (normalized === "chessdotcom" || normalized === "chesscommunity") {
          result = await fetchChessDotComHistory(username, mode, months);
        } else if (normalized === "lichess") {
          result = await fetchLichessHistory(username, mode, months);
        }
        cache.set(key, {
          data: result,
          expires: Date.now() + HISTORY_TTL,
        } as any);
      }
      return result;
    });

    const [resolvedStats, ...historySeries] = await Promise.all([
      statsPromise,
      ...historyPromises,
    ]);

    const svg = renderBlink({
      stats: resolvedStats,
      username: resolvedStats?.username ?? username,
      platform: normalized === "lichess" ? "Lichess" : "Chess.com",
      modes: historySeries.map((r) => r.mode),
      points: historySeries.map((r) => r.points),
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
      {
        platform,
        username,
        modes,
        status,
        err: err.message,
        ...(status >= 500 && { stack: err.stack }),
      },
      "blink error",
    );
    res
      .status(status)
      .set("Content-Type", "image/svg+xml")
      .send(errorSvg(err.message, C));
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
      blink: [
        "GET /blink/chessdotcom/:username",
        "GET /blink/lichess/:username",
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
      "/blink/lichess/DrNykterstein?mode=blitz&months=3&theme=dracula",
      "/blink/chessdotcom/hikaru?mode=bullet,blitz,rapid&months=6",
    ],
  });
});
app.listen(PORT, () => {
  logger.info(
    { version, port: PORT, defaultTheme: DEFAULT_THEME },
    "server started",
  );
});
