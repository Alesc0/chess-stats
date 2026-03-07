const fetch = require("node-fetch");

const BASE = "https://lichess.org/api";

/**
 * Fetches stats for a Lichess username.
 * @param {string} username
 * @returns {Promise<object>} Normalised stats object
 */
/**
 * Fetches the last `limit` game results for a Lichess user.
 * Returns an array of "win" | "loss" | "draw" strings, most-recent first.
 * @param {string} username
 * @param {number} limit
 * @returns {Promise<string[]>}
 */
async function fetchRecentResults(username, limit = 10) {
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
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
    return games.map((g) => {
      const isWhite =
        g.players?.white?.user?.name?.toLowerCase() === username.toLowerCase();
      const winner = g.winner; // "white" | "black" | undefined (draw)
      const result = !winner ? "draw" : (winner === "white") === isWhite ? "win" : "loss";
      return { result, type: g.perf ?? g.speed ?? "blitz" };
    });
  } catch {
    return [];
  }
}

async function fetchLichess(username) {
  const res = await fetch(`${BASE}/user/${username}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "chess-stats-api/1.0",
    },
  });

  if (res.status === 404) {
    const err = new Error(`Lichess user "${username}" not found`);
    err.status = 404;
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Lichess API error (${res.status})`);
  }

  const data = await res.json();

  const perf = (key) => {
    const p = data.perfs?.[key];
    if (!p || p.prov) return null; // provisional → skip
    return p.rating ?? null;
  };

  const count = data.count ?? {};

  const recentGames = await fetchRecentResults(username);

  return {
    platform: "Lichess",
    username: data.username,
    title: data.title ?? null,
    country: data.profile?.country ?? null,
    avatar: null, // Lichess doesn't expose avatars via public API
    bullet: perf("bullet"),
    blitz: perf("blitz"),
    rapid: perf("rapid"),
    puzzle: perf("puzzle"),
    wins: count.win ?? 0,
    losses: count.loss ?? 0,
    draws: count.draw ?? 0,
    recentGames,
  };
}

module.exports = { fetchLichess };
