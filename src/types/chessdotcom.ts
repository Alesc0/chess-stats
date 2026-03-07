// ── Rating snapshots ──────────────────────────────────────────────────────────
export interface ChessModeRatingLast {
  rating: number;
  date: number; // unix timestamp
  rd: number;
}

export interface ChessModeRatingBest {
  rating: number;
  date: number;
  game: string; // URL
}

// ── Win/loss/draw record ──────────────────────────────────────────────────────
export interface ChessModeRecord {
  win: number;
  loss: number;
  draw: number;
}

// ── Per-mode stats block ──────────────────────────────────────────────────────
export interface ChessModeStats {
  last: ChessModeRatingLast;
  best?: ChessModeRatingBest;
  record: ChessModeRecord;
}

// ── Tactics ───────────────────────────────────────────────────────────────────
export interface ChessTacticsEntry {
  rating: number;
  date: number;
}

export interface ChessTactics {
  highest: ChessTacticsEntry;
  lowest: ChessTacticsEntry;
}

// ── Full stats response ───────────────────────────────────────────────────────
export interface ChessDotComStatsResponse {
  chess_bullet?: ChessModeStats;
  chess_blitz?: ChessModeStats;
  chess_rapid?: ChessModeStats;
  tactics?: ChessTactics;
  puzzle_rush?: Record<string, unknown>;
}

// ── Public profile ────────────────────────────────────────────────────────────
export interface ChessDotComProfile {
  avatar?: string | null;
  player_id?: number;
  "@id"?: string;
  url?: string;
  name?: string | null;
  title?: string | null;
  username: string;
  followers?: number;
  country?: string; // URL to country resource
  location?: string | null;
  last_online?: number; // unix timestamp
  joined?: number; // unix timestamp
  status?: string; // e.g. "basic"
  is_streamer?: boolean;
  twitch_url?: string | null;
  verified?: boolean;
  league?: string | null;
  streaming_platforms?: Array<{ type: string; channel_url: string }>;
}

// ── Game / recent games response ─────────────────────────────────────────────
export interface ChessDotComPlayerSummary {
  rating?: number;
  result?: string;
  "@id"?: string;
  username: string;
  uuid?: string;
}

export interface ChessDotComAccuracies {
  white?: number;
  black?: number;
}

export interface ChessDotComGame {
  url: string;
  pgn: string;
  time_control?: string;
  end_time?: number;
  rated?: boolean;
  tcn?: string;
  uuid?: string;
  initial_setup?: string;
  fen?: string;
  time_class?: string;
  rules?: string;
  white: ChessDotComPlayerSummary;
  black: ChessDotComPlayerSummary;
  eco?: string;
  accuracies?: ChessDotComAccuracies;
}

export interface ChessDotComGamesResponse {
  games: ChessDotComGame[];
}
