import type { ChessStats, RecentGame } from "../../types.js";
import type {
  ChessDotComProfile,
  ChessDotComStatsResponse,
  ChessModeStats,
  ChessDotComGamesResponse,
  ChessDotComGame,
} from "../../types/chessdotcom.js";

// ── helpers ──────────────────────────────────────────────────────────────────

const COUNTRY_RE = /\/country\/([A-Z]+)$/i;

function extractCountry(url?: string): string | null {
  if (!url) return null;
  const m = url.match(COUNTRY_RE);
  return m ? m[1].toUpperCase() : null;
}

function extractRating(mode?: ChessModeStats): number | null {
  return mode?.last?.rating ?? null;
}

function extractRecord(mode?: ChessModeStats) {
  return {
    wins:   mode?.record?.win  ?? 0,
    losses: mode?.record?.loss ?? 0,
    draws:  mode?.record?.draw ?? 0,
  };
}

const DRAW_RESULTS = new Set([
  "stalemate",
  "repetition",
  "agreed",
  "timevsinsufficient",
  "50move",
  "insufficient",
]);

// ── public mapper ────────────────────────────────────────────────────────────

export function mapChessDotComStats(
  profile: ChessDotComProfile,
  stats: ChessDotComStatsResponse,
  recentGames: RecentGame[],
): ChessStats {
  const modes = [stats.chess_bullet, stats.chess_blitz, stats.chess_rapid];
  const totals = modes.reduce(
    (acc, m) => {
      const r = extractRecord(m);
      return {
        wins:   acc.wins   + r.wins,
        losses: acc.losses + r.losses,
        draws:  acc.draws  + r.draws,
      };
    },
    { wins: 0, losses: 0, draws: 0 },
  );

  return {
    username:    profile.username,
    title:       profile.title ?? null,
    country:     extractCountry(profile.country),
    platform:    "Chess.com",
    bullet:      extractRating(stats.chess_bullet),
    blitz:       extractRating(stats.chess_blitz),
    rapid:       extractRating(stats.chess_rapid),
    puzzle:      stats.tactics?.highest?.rating ?? null,
    wins:        totals.wins,
    losses:      totals.losses,
    draws:       totals.draws,
    recentGames,
  };
}

// ── recent-games helper ──────────────────────────────────────────────────────

export function mapChessDotComRecentGames(
  games: ChessDotComGame[],
  username: string,
): RecentGame[] {
  return games.map((g) => {
    const isWhite = g.white?.username?.toLowerCase() === username.toLowerCase();
    const result  = (isWhite ? g.white : g.black)?.result;
    const outcome: RecentGame["result"] =
      result === "win" ? "win" : DRAW_RESULTS.has(result) ? "draw" : "loss";
    return { result: outcome, type: g.time_class ?? "blitz" };
  });
}