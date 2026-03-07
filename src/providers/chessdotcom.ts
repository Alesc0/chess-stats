import type { ChessStats } from "../types.js";
import type {
  ChessDotComStatsResponse,
  ChessDotComProfile,
  ChessDotComGamesResponse,
} from "../types/chessdotcom.js";
import {
  mapChessDotComStats,
  mapChessDotComRecentGames,
} from "./mappers/chess.mapper.js";

const BASE = "https://api.chess.com/pub/player";
const HEADERS = { "User-Agent": "chess-stats-api/1.0" };

async function fetchRecentResults(username: string, limit = 10) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const res = await fetch(`${BASE}/${username}/games/${yyyy}/${mm}`, {
    headers: HEADERS,
  });
  if (!res.ok) return [];
  const data: ChessDotComGamesResponse = await res.json();
  const recent = data.games.slice(-limit).reverse();
  return mapChessDotComRecentGames(recent, username);
}

export async function fetchChessDotCom(username: string): Promise<ChessStats> {
  const [profileRes, statsRes] = await Promise.all([
    fetch(`${BASE}/${username}`, { headers: HEADERS }),
    fetch(`${BASE}/${username}/stats`, { headers: HEADERS }),
  ]);

  if (profileRes.status === 404)
    throw Object.assign(new Error(`Chess.com user "${username}" not found`), {
      status: 404,
    });
  if (!profileRes.ok || !statsRes.ok)
    throw new Error(`Chess.com API error (${profileRes.status})`);

  const profile: ChessDotComProfile = await profileRes.json();
  const stats: ChessDotComStatsResponse = await statsRes.json();
  const recentGames = await fetchRecentResults(username);

  return mapChessDotComStats(profile, stats, recentGames);
}
