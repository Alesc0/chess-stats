import type { Request, Response } from "express";
import { DEFAULT_THEME, HISTORY_CACHE_TTL } from "../config";
import logger from "../logger";
import { renderBlink } from "../render/blink";
import { resolveTheme } from "../render/themes";
import { errorSvg, getModes } from "../render/utils";
import * as cache from "../services/cache.service";
import { sendImage } from "../services/png.service";
import {
  fetchHistory,
  fetchStats,
  isKnownPlatform,
  normalizePlatform,
  platformLabel,
} from "../services/platform.service";

export async function getBlinkCard(req: Request, res: Response) {
  const { platform, username } = req.params;
  const modes = getModes(req.query.modes);
  const months = Math.min(
    12,
    Math.max(1, parseInt(req.query.months as string, 10) || 6),
  );
  const theme = (req.query.theme as string) ?? DEFAULT_THEME;
  const { colors: C } = resolveTheme(theme);
  const normalized = normalizePlatform(platform);

  try {
    if (!isKnownPlatform(normalized)) {
      throw Object.assign(
        new Error(
          `Unknown platform "${platform}". Use "chessdotcom" or "lichess".`,
        ),
        { status: 400 },
      );
    }

    // Stats + all mode histories in parallel
    const sKey = cache.statsCacheKey(normalized, username);
    let blinkStats = cache.getStats(sKey);
    const statsPromise = blinkStats
      ? Promise.resolve(blinkStats)
      : (async () => {
          blinkStats = await fetchStats(normalized, username);
          cache.setStats(sKey, blinkStats);
          return blinkStats;
        })();

    const historyPromises = modes.map(async (mode) => {
      const hKey = cache.historyCacheKey(normalized, username, mode, months);
      let result = cache.getHistory(hKey);
      if (!result) {
        result = await fetchHistory(normalized, username, mode, months);
        cache.setHistory(hKey, result);
      }
      return result as {
        mode: string;
        points: Array<{ date: Date; rating: number }>;
      };
    });

    const [resolvedStats, ...historySeries] = await Promise.all([
      statsPromise,
      ...historyPromises,
    ]);

    const svg = renderBlink({
      stats: resolvedStats,
      username: resolvedStats?.username ?? username,
      platform: platformLabel(normalized),
      modes: historySeries.map((r) => r.mode) as any,
      points: historySeries.map((r) => r.points) as any,
      months,
      themeName: theme,
    });

    sendImage(req, res, svg, HISTORY_CACHE_TTL);
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
    sendImage(req, res, errorSvg(err.message, C), 0, status);
  }
}
