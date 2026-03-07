import type { ChessStats, RecentGame } from "../../types.js";
import type { LichessUser, LichessPerfs } from "../../types/lichess.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function perf(perfs: LichessPerfs | undefined, key: keyof LichessPerfs): number | null {
  const p = perfs?.[key];
  if (!p || ("prov" in p && p.prov)) return null;
  return p.rating;
}

// ── public mapper ────────────────────────────────────────────────────────────

export function mapLichessStats(
  user: LichessUser,
  recentGames: RecentGame[],
): ChessStats {
  return {
    username:    user.username,
    title:       user.title ?? null,
    country:     user.profile?.flag ?? null,
    platform:    "Lichess",
    bullet:      perf(user.perfs, "bullet"),
    blitz:       perf(user.perfs, "blitz"),
    rapid:       perf(user.perfs, "rapid"),
    puzzle:      perf(user.perfs, "puzzle"),
    wins:        user.count?.win  ?? 0,
    losses:      user.count?.loss ?? 0,
    draws:       user.count?.draw ?? 0,
    recentGames,
  };
}

// ── recent-games helper ──────────────────────────────────────────────────────

export function mapLichessRecentGames(
  games: any[],
  username: string,
): RecentGame[] {
  return games.map((g) => {
    const isWhite =
      g.players?.white?.user?.name?.toLowerCase() === username.toLowerCase();
    const winner = g.winner;
    const result: RecentGame["result"] = !winner
      ? "draw"
      : (winner === "white") === isWhite
        ? "win"
        : "loss";
    return { result, type: g.perf ?? g.speed ?? "blitz" };
  });
}