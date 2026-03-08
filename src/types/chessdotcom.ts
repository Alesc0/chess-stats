// ── Chess.com API response types (trimmed to what we actually consume) ────────

// ── Per-mode stats block ──────────────────────────────────────────────────────
export interface ChessModeRecord {
  win: number;
  loss: number;
  draw: number;
}

export interface ChessModeStats {
  last: { rating: number };
  record: ChessModeRecord;
}

// ── Full stats response ───────────────────────────────────────────────────────
export interface ChessDotComStatsResponse {
  chess_bullet?: ChessModeStats;
  chess_blitz?: ChessModeStats;
  chess_rapid?: ChessModeStats;
  tactics?: { highest?: { rating: number } };
}

// ── Public profile ────────────────────────────────────────────────────────────
export interface ChessDotComProfile {
  username: string;
  title?: string | null;
  country?: string; // URL to country resource
  avatar?: string | null;
}

// ── Game / recent games response ─────────────────────────────────────────────
export interface ChessDotComPlayerResult {
  username: string;
  result: string;
  rating: number;
}

export interface ChessDotComGame {
  white: ChessDotComPlayerResult;
  black: ChessDotComPlayerResult;
  end_time?: number;
  time_class?: string;
}

export interface ChessDotComGamesResponse {
  games: ChessDotComGame[];
}
