import type { Request, Response } from "express";
import { DEFAULT_THEME, HISTORY_CACHE_TTL } from "../config";
import logger from "../logger";
import { renderActivityHeatmap } from "../render/activity";
import { resolveTheme } from "../render/themes";
import { errorSvg } from "../render/utils";
import * as cache from "../services/cache.service";
import { sendImage } from "../services/png.service";
import {
  fetchActivity,
  fetchStats,
  isKnownPlatform,
  normalizePlatform,
  platformLabel,
} from "../services/platform.service";

export async function getActivityCard(req: Request, res: Response) {
  const { platform, username } = req.params;
  const mode = (req.query.mode as string) || undefined;
  const months = Math.min(
    12,
    Math.max(1, parseInt(req.query.months as string, 10) || 3),
  );
  const format = (req.query.format as string) ?? "svg";
  const theme = (req.query.theme as string) ?? DEFAULT_THEME;
  const { colors: C } = resolveTheme(theme);
  const normalized = normalizePlatform(platform);

  logger.info(
    { platform: normalized, username, mode, months },
    "fetching activity",
  );

  try {
    if (!isKnownPlatform(normalized)) {
      return res.status(400).json({
        error: `Unknown platform "${platform}". Use "chessdotcom" or "lichess".`,
      });
    }

    // Fetch stats (for header info) and activity data in parallel
    const sKey = cache.statsCacheKey(normalized, username);
    const aKey = cache.activityCacheKey(normalized, username, months, mode);

    const [resolvedStats, activity] = await Promise.all([
      (async () => {
        const cached = cache.getStats(sKey);
        if (cached) return cached;
        const stats = await fetchStats(normalized, username);
        cache.setStats(sKey, stats);
        return stats;
      })().catch(() => null),

      (async () => {
        const cached =
          cache.getActivity<ReturnType<typeof fetchActivity>>(aKey);
        if (cached) return cached;
        logger.debug(
          { platform: normalized, username, mode, months },
          "cache miss — fetching activity",
        );
        const data = await fetchActivity(normalized, username, months, mode);
        cache.setActivity(aKey, data);
        return data;
      })(),
    ]);

    if (format === "json") {
      return res.json(activity);
    }

    const svg = renderActivityHeatmap({
      username,
      platform: platformLabel(normalized),
      title: resolvedStats?.title ?? null,
      country: resolvedStats?.country ?? null,
      activity,
      months,
      mode,
      themeName: theme,
    });

    sendImage(req, res, svg, HISTORY_CACHE_TTL);
  } catch (err) {
    const status = err.status ?? 500;
    logger[status >= 500 ? "error" : "warn"](
      {
        platform,
        username,
        mode,
        months,
        status,
        err: err.message,
        ...(status >= 500 && { stack: err.stack }),
      },
      "activity error",
    );
    if (format === "json") {
      return res.status(status).json({ error: err.message });
    }
    sendImage(req, res, errorSvg(err.message, C), 0, status);
  }
}
