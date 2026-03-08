import type { Request, Response } from "express";
import { DEFAULT_THEME, STATS_CACHE_TTL } from "../config";
import logger from "../logger";
import { statsCard } from "../render/stats";
import { resolveTheme } from "../render/themes";
import { errorSvg, getModes } from "../render/utils";
import * as cache from "../services/cache.service";
import { sendImage } from "../services/png.service";
import {
  fetchStats,
  isKnownPlatform,
  normalizePlatform,
} from "../services/platform.service";
import { trace } from "@opentelemetry/api";
import { traceAsync, traceSync } from "../services/telemetry.service";

export async function getStatsCard(req: Request, res: Response) {
  const { platform, username } = req.params;
  const format = req.query.format ?? "svg";
  const theme = (req.query.theme as string) ?? DEFAULT_THEME;
  const modes = getModes(req.query.modes);

  const normalized = normalizePlatform(platform);
  const key = cache.statsCacheKey(normalized, username);

  try {
    if (!isKnownPlatform(normalized)) {
      return res.status(400).json({
        error: `Unknown platform "${platform}". Use "chessdotcom" or "lichess".`,
      });
    }

    trace.getActiveSpan()?.setAttributes({
      "chess.platform": normalized,
      "chess.username": username,
      "chess.format": String(format),
      "chess.theme": theme,
    });

    const stats = await traceAsync(
      "controller.stats.resolve",
      async () => {
        const cached = cache.getStats(key);
        if (cached) return cached;
        logger.info({ platform: normalized, username }, "fetching stats");
        const fresh = await fetchStats(normalized, username);
        cache.setStats(key, fresh);
        return fresh;
      },
      {
        "chess.platform": normalized,
        "chess.username": username,
        "chess.format": String(format),
      },
    );

    if (format === "json") {
      return res.json(stats);
    }

    const svg = traceSync("render.stats", () => statsCard(stats, theme, modes), {
      "chess.theme": theme,
    });
    sendImage(req, res, svg, STATS_CACHE_TTL);
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
    const { colors: ec } = resolveTheme(theme);
    sendImage(req, res, errorSvg(err.message, ec), 0, status);
  }
}
