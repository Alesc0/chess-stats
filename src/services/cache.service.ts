import logger from "../logger";
import { STATS_CACHE_TTL, HISTORY_CACHE_TTL } from "../config";
import type { ChessStats } from "../types";

interface CacheEntry {
  data: unknown;
  expires: number;
}

const store = new Map<string, CacheEntry>();

function get<T = unknown>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(key);
    logger.debug({ key }, "cache expired");
    return null;
  }
  logger.debug({ key }, "cache hit");
  return entry.data as T;
}

function set(key: string, data: unknown, ttl: number): void {
  store.set(key, { data, expires: Date.now() + ttl });
  logger.debug({ key, ttl_ms: ttl }, "cache set");
}

// ── Convenience helpers ──────────────────────────────────────────────────────

export function getStats(key: string): ChessStats | null {
  return get<ChessStats>(key);
}

export function setStats(key: string, stats: ChessStats): void {
  set(key, stats, STATS_CACHE_TTL);
}

export function getHistory<T = unknown>(key: string): T | null {
  return get<T>(key);
}

export function setHistory(key: string, data: unknown): void {
  set(key, data, HISTORY_CACHE_TTL);
}

export function statsCacheKey(platform: string, username: string): string {
  return `${platform}:${username.toLowerCase()}`;
}

export function historyCacheKey(
  platform: string,
  username: string,
  mode: string,
  months: number,
): string {
  return `history:${platform}:${username.toLowerCase()}:${mode}:${months}`;
}
