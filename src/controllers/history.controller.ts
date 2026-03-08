import type { Request, Response } from "express";
import { DEFAULT_THEME, HISTORY_CACHE_TTL } from "../config";
import logger from "../logger";
import { renderChart } from "../render/chart";
import { resolveTheme } from "../render/themes";
import { errorSvg, getModes } from "../render/utils";
import * as cache from "../services/cache.service";
import {
  fetchHistory,
  fetchStats,
  isKnownPlatform,
  normalizePlatform,
  platformLabel,
} from "../services/platform.service";

export async function getHistoryChart(req: Request, res: Response) {
  const { platform, username } = req.params;
  const modes = getModes(req.query.modes);
  const months = Math.min(
    12,
    Math.max(1, parseInt(req.query.months as string, 10) || 6),
  );
  const format = (req.query.format as string) ?? "svg";
  const theme = (req.query.theme as string) ?? DEFAULT_THEME;
  const { colors: C } = resolveTheme(theme);
  const normalized = normalizePlatform(platform);

  logger.info(
    { platform: normalized, username, modes, months },
    "fetching history",
  );

  try {
    if (!isKnownPlatform(normalized)) {
      return res.status(400).json({
        error: `Unknown platform "${platform}". Use "chessdotcom" or "lichess".`,
      });
    }

    // Fetch stats (for the title) — non-critical
    const sKey = cache.statsCacheKey(normalized, username);
    let cachedStats = cache.getStats(sKey);
    const statsPromise = cachedStats
      ? Promise.resolve(cachedStats)
      : (async () => {
          cachedStats = await fetchStats(normalized, username);
          cache.setStats(sKey, cachedStats);
          return cachedStats;
        })().catch(() => null);

    // Fetch all requested modes in parallel
    const [resolvedStats, ...results] = await Promise.all([
      statsPromise,
      ...modes.map(async (mode) => {
        const hKey = cache.historyCacheKey(normalized, username, mode, months);
        let result = cache.getHistory(hKey);
        if (!result) {
          logger.debug(
            { platform: normalized, username, mode, months },
            "cache miss — fetching history",
          );
          result = await fetchHistory(normalized, username, mode, months);
          logger.debug(
            {
              platform: normalized,
              username,
              mode,
              points: (result as any).points?.length ?? 0,
            },
            "history fetched",
          );
          cache.setHistory(hKey, result);
        }
        return result as {
          mode: string;
          points: Array<{ date: Date; rating: number }>;
        };
      }),
    ]);

    if (format === "json") {
      return res.json(modes.length === 1 ? results[0] : results);
    }

    const svg = renderChart({
      username,
      platform: platformLabel(normalized),
      modes: results.map((r) => r.mode) as any,
      points: results.map((r) => r.points) as any,
      months,
      themeName: theme,
      title: resolvedStats?.title ?? null,
    });

    res
      .set("Content-Type", "image/svg+xml")
      .set("Cache-Control", `public, max-age=${HISTORY_CACHE_TTL / 1000}`)
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
}
