import type { ChessStats } from "../types.js";
import type { LichessUser } from "../types/lichess.js";
import {
  mapLichessStats,
  mapLichessRecentGames,
} from "./mappers/lichess.mapper.js";

const BASE = "https://lichess.org/api";
const HEADERS = {
  Accept: "application/json",
  "User-Agent": "chess-stats-api/1.0",
};

async function fetchRecentResults(username: string, limit = 10) {
  try {
    const res = await fetch(
      `${BASE}/games/user/${username}?max=${limit}&moves=false&perfType=bullet,blitz,rapid`,
      {
        headers: {
          Accept: "application/x-ndjson",
          "User-Agent": "chess-stats-api/1.0",
        },
      },
    );
    if (!res.ok) return [];
    const text = await res.text();
    const games = text
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    return mapLichessRecentGames(games, username);
  } catch {
    return [];
  }
}

export async function fetchLichess(username: string): Promise<ChessStats> {
  const res = await fetch(`${BASE}/user/${username}`, { headers: HEADERS });

  if (res.status === 404)
    throw Object.assign(new Error(`Lichess user "${username}" not found`), {
      status: 404,
    });
  if (!res.ok) throw new Error(`Lichess API error (${res.status})`);

  const user = (await res.json()) as LichessUser;
  const recentGames = await fetchRecentResults(username);

  return mapLichessStats(user, recentGames);
}

export async function fetchLichessHistory(
  username: string,
  mode = "blitz",
  months = 6,
) {
  mode = mode.toLowerCase();

  const LICHESS_MODE_NAMES: Record<string, string> = {
    bullet: "Bullet",
    blitz: "Blitz",
    rapid: "Rapid",
    puzzle: "Puzzles",
  };
  const modeName = LICHESS_MODE_NAMES[mode];
  if (!modeName)
    throw Object.assign(new Error(`Unknown mode "${mode}"`), { status: 400 });

  const res = await fetch(
    `https://lichess.org/api/user/${username}/rating-history`,
    { headers: { ...HEADERS, Accept: "application/json" } },
  );
  if (res.status === 404)
    throw Object.assign(new Error(`Lichess user "${username}" not found`), {
      status: 404,
    });
  if (!res.ok) throw new Error(`Lichess API error (${res.status})`);

  const history = (await res.json()) as Array<{
    name: string;
    points: [number, number, number, number][];
  }>;
  const entry = history.find((h) => h.name === modeName);
  if (!entry || entry.points.length === 0) return { mode, points: [] };

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  const points = entry.points
    .map(([year, month0, day, rating]) => ({
      date: new Date(year, month0, day),
      rating,
    }))
    .filter((p) => p.date >= cutoff);

  const MAX_POINTS = 120;
  const step = Math.max(1, Math.floor(points.length / MAX_POINTS));
  const sampled = [
    ...points.filter((_, i) => i % step === 0),
    points[points.length - 1],
  ].filter(Boolean);

  const seen = new Set<number>();
  const deduped = sampled.filter((p) => {
    const k = p.date.getTime();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { mode, points: deduped };
}
