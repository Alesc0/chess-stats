import { THEMES } from "./render/themes";

export const PORT = process.env.PORT || 3000;
export const DEFAULT_THEME = process.env.DEFAULT_THEME || "dark";

/** Cache TTL for stats cards (milliseconds). */
export const STATS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Cache TTL for history / combined / blink endpoints (milliseconds). */
export const HISTORY_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/** Available theme names, for documentation. */
export const THEME_NAMES = Object.keys(THEMES);
