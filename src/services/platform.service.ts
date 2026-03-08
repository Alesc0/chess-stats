import {
  fetchChessDotCom,
  fetchChessDotComHistory,
  fetchChessDotComActivity,
} from "../providers/chessdotcom";
import {
  fetchLichess,
  fetchLichessHistory,
  fetchLichessActivity,
} from "../providers/lichess";
import type { DailyActivity } from "../render/activity";
import type { ChessStats } from "../types";
import { traceAsync } from "./telemetry.service";

export type HistoryResult = {
  mode: string;
  points: Array<{ date: Date; rating: number }>;
};

/**
 * Normalize a platform string from the URL param to a canonical key.
 * "chess.com", "chess-com", "chessdotcom" → "chessdotcom"
 */
export function normalizePlatform(raw: string): string {
  return raw.toLowerCase().replace(/[\.\-]/g, "");
}

/** Pretty platform label for display. */
export function platformLabel(normalized: string): string {
  return normalized === "lichess" ? "Lichess" : "Chess.com";
}

function isChessDotCom(p: string): boolean {
  return p === "chessdotcom" || p === "chesscommunity";
}

function isLichess(p: string): boolean {
  return p === "lichess";
}

export function isKnownPlatform(normalized: string): boolean {
  return isChessDotCom(normalized) || isLichess(normalized);
}

export async function fetchStats(
  platform: string,
  username: string,
): Promise<ChessStats> {
  return traceAsync(
    "platform.fetchStats",
    async () => {
      if (isChessDotCom(platform)) return fetchChessDotCom(username);
      if (isLichess(platform)) return fetchLichess(username);
      throw Object.assign(
        new Error(
          `Unknown platform "${platform}". Use "chessdotcom" or "lichess".`,
        ),
        { status: 400 },
      );
    },
    { "chess.platform": platform, "chess.username": username },
  );
}

export async function fetchHistory(
  platform: string,
  username: string,
  mode: string,
  months: number,
): Promise<HistoryResult> {
  return traceAsync(
    "platform.fetchHistory",
    async () => {
      if (isChessDotCom(platform))
        return fetchChessDotComHistory(username, mode, months);
      if (isLichess(platform))
        return fetchLichessHistory(username, mode, months);
      throw Object.assign(
        new Error(
          `Unknown platform "${platform}". Use "chessdotcom" or "lichess".`,
        ),
        { status: 400 },
      );
    },
    {
      "chess.platform": platform,
      "chess.username": username,
      "chess.mode": mode,
      "chess.months": months,
    },
  );
}

export async function fetchActivity(
  platform: string,
  username: string,
  months: number,
  mode?: string,
): Promise<DailyActivity[]> {
  return traceAsync(
    "platform.fetchActivity",
    async () => {
      if (isChessDotCom(platform))
        return fetchChessDotComActivity(username, months, mode);
      if (isLichess(platform))
        return fetchLichessActivity(username, months, mode);
      throw Object.assign(
        new Error(
          `Unknown platform "${platform}". Use "chessdotcom" or "lichess".`,
        ),
        { status: 400 },
      );
    },
    {
      "chess.platform": platform,
      "chess.username": username,
      "chess.months": months,
      ...(mode && { "chess.mode": mode }),
    },
  );
}
