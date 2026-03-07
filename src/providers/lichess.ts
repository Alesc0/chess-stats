import type { ChessStats } from "../types.js";
import type { LichessUser } from "../types/lichess.js";
import { mapLichessStats, mapLichessRecentGames } from "./mappers/lichess.mapper.js";

const BASE = "https://lichess.org/api";
const HEADERS = { Accept: "application/json", "User-Agent": "chess-stats-api/1.0" };

async function fetchRecentResults(username: string, limit = 10) {
  try {
    const res = await fetch(
      `${BASE}/games/user/${username}?max=${limit}&moves=false&perfType=bullet,blitz,rapid`,
      { headers: { Accept: "application/x-ndjson", "User-Agent": "chess-stats-api/1.0" } },
    );
    if (!res.ok) return [];
    const text  = await res.text();
    const games = text
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
    return mapLichessRecentGames(games, username);
  } catch {
    return [];
  }
}

export async function fetchLichess(username: string): Promise<ChessStats> {
  const res = await fetch(`${BASE}/user/${username}`, { headers: HEADERS });

  if (res.status === 404)
    throw Object.assign(new Error(`Lichess user "${username}" not found`), { status: 404 });
  if (!res.ok) throw new Error(`Lichess API error (${res.status})`);

  const user = (await res.json()) as LichessUser;
  const recentGames = await fetchRecentResults(username);

  return mapLichessStats(user, recentGames);
}
