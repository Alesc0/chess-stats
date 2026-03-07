export type {
  ChessModeRecord,
  ChessModeStats,
  ChessDotComStatsResponse,
  ChessDotComProfile,
  ChessDotComPlayerResult,
  ChessDotComGamesResponse,
  ChessDotComGame,
} from "./types/chessdotcom.js";

export type {
  LichessPerf,
  LichessPerfs,
  LichessProfile,
  LichessCount,
  LichessUser,
} from "./types/lichess.js";

// ── Unified card-ready stats (what all renderers actually consume) ────────────
export type RecentGame = { result: "win" | "loss" | "draw"; type: string };

export interface ChessStats {
  username: string;
  title: string | null;
  country: string | null;
  platform: string;
  bullet: number | null;
  blitz: number | null;
  rapid: number | null;
  puzzle: number | null;
  wins: number;
  losses: number;
  draws: number;
  recentGames: RecentGame[];
}
