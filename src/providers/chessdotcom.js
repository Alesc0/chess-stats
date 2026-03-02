const fetch = require("node-fetch");

const BASE = "https://api.chess.com/pub/player";

const COUNTRY_CODES = {
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

function extractCountry(url) {
  if (!url) return null;
  if (COUNTRY_CODES[url]) return COUNTRY_CODES[url];
  const match = url.match(/\/country\/([A-Z]+)$/i);
  return match ? match[1].toUpperCase() : null;
}

function extractRating(modeData) {
  if (!modeData || !modeData.last) return null;
  return {
    rating: modeData.last.rating,
    wins: modeData.record?.win ?? 0,
    losses: modeData.record?.loss ?? 0,
    draws: modeData.record?.draw ?? 0,
  };
}

/**
 * Fetches stats for a Chess.com username.
 * @param {string} username
 * @returns {Promise<object>} Normalised stats object
 */
async function fetchChessDotCom(username) {
  const [profileRes, statsRes] = await Promise.all([
    fetch(`${BASE}/${username}`, {
      headers: { "User-Agent": "chess-stats-api/1.0" },
    }),
    fetch(`${BASE}/${username}/stats`, {
      headers: { "User-Agent": "chess-stats-api/1.0" },
    }),
  ]);

  if (profileRes.status === 404) {
    const err = new Error(`Chess.com user "${username}" not found`);
    err.status = 404;
    throw err;
  }
  if (!profileRes.ok || !statsRes.ok) {
    throw new Error(`Chess.com API error (${profileRes.status})`);
  }

  const profile = await profileRes.json();
  const stats = await statsRes.json();

  const bullet = extractRating(stats.chess_bullet);
  const blitz = extractRating(stats.chess_blitz);
  const rapid = extractRating(stats.chess_rapid);

  // Aggregate totals across modes
  const totals = [bullet, blitz, rapid].filter(Boolean).reduce(
    (acc, m) => ({
      wins: acc.wins + m.wins,
      losses: acc.losses + m.losses,
      draws: acc.draws + m.draws,
    }),
    { wins: 0, losses: 0, draws: 0 }
  );

  return {
    platform: "Chess.com",
    username: profile.username,
    title: profile.title ?? null,
    country: extractCountry(profile.country),
    avatar: profile.avatar ?? null,
    bullet: bullet ? bullet.rating : null,
    blitz: blitz ? blitz.rating : null,
    rapid: rapid ? rapid.rating : null,
    puzzle: stats.tactics?.highest?.rating ?? null,
    wins: totals.wins,
    losses: totals.losses,
    draws: totals.draws,
  };
}

module.exports = { fetchChessDotCom };
