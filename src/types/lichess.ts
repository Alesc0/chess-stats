// ── Per-mode performance (standard rated modes) ──────────────────────────────
export interface LichessPerf {
  games: number;
  rating: number;
  rd: number; // rating deviation
  prog: number; // progress (last 12 games delta)
  prov?: boolean; // provisional rating
}

// ── Puzzle-only performance (no rd/prog/prov) ─────────────────────────────────
export interface LichessPuzzlePerf {
  games: number;
  rating: number;
  rd: number;
  prog: number;
}

// ── Streaks / storm / racer mini-games ───────────────────────────────────────
export interface LichessRunPerf {
  runs: number;
  score: number;
}

// ── Full perfs map ────────────────────────────────────────────────────────────
export interface LichessPerfs {
  ultraBullet?: LichessPerf;
  bullet?: LichessPerf;
  blitz?: LichessPerf;
  rapid?: LichessPerf;
  classical?: LichessPerf;
  correspondence?: LichessPerf;
  chess960?: LichessPerf;
  kingOfTheHill?: LichessPerf;
  threeCheck?: LichessPerf;
  antichess?: LichessPerf;
  atomic?: LichessPerf;
  horde?: LichessPerf;
  racingKings?: LichessPerf;
  crazyhouse?: LichessPerf;
  puzzle?: LichessPuzzlePerf;
  storm?: LichessRunPerf;
  racer?: LichessRunPerf;
  streak?: LichessRunPerf;
}

// ── Public profile fields ─────────────────────────────────────────────────────
export interface LichessProfile {
  flag?: string; // ISO 3166-1 alpha-2 country code
  location?: string;
  bio?: string;
  realName?: string;
  fideRating?: number;
}

// ── Play-time (seconds) ───────────────────────────────────────────────────────
export interface LichessPlayTime {
  total: number;
  tv: number;
}

// ── Game counts ───────────────────────────────────────────────────────────────
export interface LichessCount {
  all: number;
  rated: number;
  draw: number;
  loss: number;
  win: number;
  bookmark: number;
  playing: number;
  import: number;
  me: number;
}

// ── Top-level user object ─────────────────────────────────────────────────────
export interface LichessUser {
  id: string;
  username: string;
  perfs: LichessPerfs;
  title?: string; // e.g. "GM", "IM"
  createdAt?: number; // unix ms
  seenAt?: number; // unix ms
  profile?: LichessProfile;
  playTime?: LichessPlayTime;
  url?: string;
  count?: LichessCount;
}
