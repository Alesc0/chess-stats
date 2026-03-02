const fetch = require("node-fetch");

const BASE = "https://lichess.org/api";

/**
 * Fetches stats for a Lichess username.
 * @param {string} username
 * @returns {Promise<object>} Normalised stats object
 */
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
  };
}

module.exports = { fetchLichess };
