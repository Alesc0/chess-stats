import type { LichessUser, LichessProfile, LichessPerfs } from "../types/lichess.js";

const BASE = "https://lichess.org/api";

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
    return games.map((g: any) => {
      const isWhite =
        g.players?.white?.user?.name?.toLowerCase() === username.toLowerCase();
      const winner = g.winner;
      const result = !winner
        ? "draw"
        : (winner === "white") === isWhite
          ? "win"
          : "loss";
      return { result, type: g.perf ?? g.speed ?? "blitz" };
    });
  } catch {
    return [];
  }
}

export async function fetchLichess(username: string) {
  const res = await fetch(`${BASE}/user/${username}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "chess-stats-api/1.0",
    },
  });

  if (res.status === 404)
    throw Object.assign(new Error(`Lichess user "${username}" not found`), {
      status: 404,
    });
  if (!res.ok) throw new Error(`Lichess API error (${res.status})`);

  const data = (await res.json()) as LichessUser;

  const perf = (key: keyof LichessPerfs) => {
    const p = data.perfs?.[key];
    if (!p || !("rating" in p) || ("prov" in p && p.prov)) return null;
    return p.rating;
  };
  const profile: LichessProfile = {
    flag:        data.profile?.flag,
    location:    data.profile?.location,
    realName:    data.profile?.realName,
    bio:         data.profile?.bio,
    fideRating:  data.profile?.fideRating,
  };
  const count = data.count ?? { win: 0, loss: 0, draw: 0 };
  const recentGames = await fetchRecentResults(username);

  return {
    platform: "Lichess",
    username: data.username,
    title: data.title ?? null,
    country: data.profile?.flag ?? null,
    profile,
    stats: {
      bullet: perf("bullet"),
      blitz: perf("blitz"),
      rapid: perf("rapid"),
    },
    wins: count.win ?? 0,
    losses: count.loss ?? 0,
    draws: count.draw ?? 0,
    recentGames,
  };
}
