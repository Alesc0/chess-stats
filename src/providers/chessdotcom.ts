import { MODE, type ChessStats } from "../types.js";
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

export async function fetchChessDotComHistory(
  username: string,
  mode = "blitz",
  months = 6,
) {
  mode = mode.toLowerCase();
  const apiMode = MODE[mode];
  if (!apiMode)
    throw Object.assign(new Error(`Unknown mode "${mode}"`), { status: 400 });

  const archivesRes = await fetch(
    `https://api.chess.com/pub/player/${username}/games/archives`,
    { headers: HEADERS },
  );
  if (archivesRes.status === 404)
    throw Object.assign(new Error(`Chess.com user "${username}" not found`), {
      status: 404,
    });
  if (!archivesRes.ok)
    throw new Error(`Chess.com API error (${archivesRes.status})`);

  const { archives = [] } = (await archivesRes.json()) as {
    archives: string[];
  };
  const slice = archives.slice(-Math.min(months, 12));

  if (slice.length === 0) return { mode, points: [] };

  const monthGames = await Promise.all(
    slice.map(async (url) => {
      const r = await fetch(url, { headers: HEADERS });
      if (!r.ok) return [];
      const { games = [] } = (await r.json()) as { games: any[] };
      return mapChessDotComRecentGames(games, username).filter(
        (g) => g.type === apiMode,
      );
    }),
  );

  const points: { date: Date; rating: number }[] = [];

  for (const games of monthGames) {
    const modeGames = games.filter((g) => g.type === mode);
    if (modeGames.length === 0) continue;

    const step = Math.max(1, Math.floor(modeGames.length / 8));
    const sampled = [
      ...modeGames.filter((_: any, i: number) => i % step === 0),
      modeGames[modeGames.length - 1],
    ];

    for (const g of sampled) {
      points.push({ date: g.date, rating: g.finalRating ?? 0 });
    }
  }

  const deduped = points.filter(
    (p, i) => i === 0 || p.date.getTime() !== points[i - 1].date.getTime(),
  );

  return { mode, points: deduped };
}

export async function fetchChessDotComActivity(
  username: string,
  months = 3,
  mode?: string,
) {
  const archivesRes = await fetch(`${BASE}/${username}/games/archives`, {
    headers: HEADERS,
  });
  if (archivesRes.status === 404)
    throw Object.assign(new Error(`Chess.com user "${username}" not found`), {
      status: 404,
    });
  if (!archivesRes.ok)
    throw new Error(`Chess.com API error (${archivesRes.status})`);

  const { archives = [] } = (await archivesRes.json()) as {
    archives: string[];
  };
  const slice = archives.slice(-Math.min(months, 12));

  if (slice.length === 0) return [];

  const monthGames = await Promise.all(
    slice.map(async (url) => {
      const r = await fetch(url, { headers: HEADERS });
      if (!r.ok) return [];
      const { games = [] } = (await r.json()) as { games: any[] };
      return mapChessDotComRecentGames(games, username);
    }),
  );

  const daily = new Map<string, { games: number; wins: number }>();
  const modeSet = mode ? new Set(mode.split(",").map((m) => m.trim())) : null;

  for (const games of monthGames) {
    for (const g of games) {
      if (modeSet && !modeSet.has(g.type)) continue;
      const key = g.date.toISOString().slice(0, 10);
      const entry = daily.get(key) ?? { games: 0, wins: 0 };
      entry.games++;
      if (g.result === "win") entry.wins++;
      daily.set(key, entry);
    }
  }

  return Array.from(daily.entries())
    .map(([date, d]) => ({ date, games: d.games, wins: d.wins }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
