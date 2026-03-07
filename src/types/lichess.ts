// ── Lichess API response types (trimmed to what we actually consume) ──────────

// ── Per-mode performance ─────────────────────────────────────────────────────
export interface LichessPerf {
  rating: number;
  prov?:  boolean; // provisional rating
}

// ── Perf map (only modes we display) ─────────────────────────────────────────
export interface LichessPerfs {
  bullet?:  LichessPerf;
  blitz?:   LichessPerf;
  rapid?:   LichessPerf;
  puzzle?:  LichessPerf;
}

// ── Public profile fields ─────────────────────────────────────────────────────
export interface LichessProfile {
  flag?:     string; // ISO 3166-1 alpha-2 country code
  realName?: string;
}

// ── Game counts ───────────────────────────────────────────────────────────────
export interface LichessCount {
  win:  number;
  loss: number;
  draw: number;
}

// ── Top-level user object ─────────────────────────────────────────────────────
export interface LichessUser {
  id:        string;
  username:  string;
  perfs:     LichessPerfs;
  title?:    string;        // e.g. "GM", "IM"
  profile?:  LichessProfile;
  count?:    LichessCount;
}
