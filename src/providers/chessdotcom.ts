import type {
  ChessDotComStatsResponse,
  ChessModeStats,
  ChessDotComProfile,
  ChessStats,
} from "../types.js";

const BASE = "https://api.chess.com/pub/player";

const COUNTRY_CODES: Record<string, string> = {
  "https://api.chess.com/pub/country/US": "US",
  "https://api.chess.com/pub/country/GB": "GB",
  "https://api.chess.com/pub/country/DE": "DE",
  "https://api.chess.com/pub/country/FR": "FR",
  "https://api.chess.com/pub/country/RU": "RU",
  "https://api.chess.com/pub/country/IN": "IN",
  "https://api.chess.com/pub/country/CN": "CN",
  "https://api.chess.com/pub/country/ES": "ES",
  "https://api.chess.com/pub/country/AR": "AR",
  "https://api.chess.com/pub/country/BR": "BR",
};

function extractCountry(url?: string): string | null {
  if (!url) return null;
  if (COUNTRY_CODES[url]) return COUNTRY_CODES[url];
  const match = url.match(/\/country\/([A-Z]+)$/i);
  return match ? match[1].toUpperCase() : null;
}

function extractRating(modeData?: ChessModeStats) {
  if (!modeData?.last) return null;
  return {
    rating: modeData.last.rating,
    wins: modeData.record?.win ?? 0,
    losses: modeData.record?.loss ?? 0,
    draws: modeData.record?.draw ?? 0,
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

async function fetchRecentResults(username: string, limit = 10) {
  try {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const res = await fetch(`${BASE}/${username}/games/${yyyy}/${mm}`, {
      headers: { "User-Agent": "chess-stats-api/1.0" },
    });
    if (!res.ok) return [];
    const { games = [] } = (await res.json()) as { games: any[] };
    const recent = games.slice(-limit).reverse();
    return recent.map((g: any) => {
      const isWhite =
        g.white?.username?.toLowerCase() === username.toLowerCase();
      const result = (isWhite ? g.white : g.black)?.result;
      const outcome =
        result === "win" ? "win" : DRAW_RESULTS.has(result) ? "draw" : "loss";
      return { result: outcome, type: g.time_class ?? "blitz" };
    });
  } catch {
    return [];
  }
}

export async function fetchChessDotCom(username: string): Promise<ChessStats> {
  const [profileRes, statsRes] = await Promise.all([
    fetch(`${BASE}/${username}`, {
      headers: { "User-Agent": "chess-stats-api/1.0" },
    }),
    fetch(`${BASE}/${username}/stats`, {
      headers: { "User-Agent": "chess-stats-api/1.0" },
    }),
  ]);

  if (profileRes.status === 404)
    throw Object.assign(new Error(`Chess.com user "${username}" not found`), {
      status: 404,
    });
  if (!profileRes.ok || !statsRes.ok)
    throw new Error(`Chess.com API error (${profileRes.status})`);

  const profile = (await profileRes.json()) as ChessDotComProfile;
  const stats = (await statsRes.json()) as ChessDotComStatsResponse;

  const bullet = extractRating(stats.chess_bullet);
  const blitz = extractRating(stats.chess_blitz);
  const rapid = extractRating(stats.chess_rapid);

  const totals = [bullet, blitz, rapid].filter(Boolean).reduce(
    (acc, m) => ({
      wins: acc.wins + m!.wins,
      losses: acc.losses + m!.losses,
      draws: acc.draws + m!.draws,
    }),
    { wins: 0, losses: 0, draws: 0 },
  );

  const recentGames = await fetchRecentResults(username);

  return {
    platform: "Chess.com",
    username: profile.username,
    title: profile.title ?? null,
    country: extractCountry(profile.country),
    profile: profile,
    stats: {
      bullet: stats.chess_bullet,
      blitz: stats.chess_blitz,
      rapid: stats.chess_rapid,
      tactics: stats.tactics,
    },
    wins: totals.wins,
    losses: totals.losses,
    draws: totals.draws,
    recentGames,
  };
}
