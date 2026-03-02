const fetch = require("node-fetch");

const HEADERS = { "User-Agent": "chess-stats-api/1.0" };

const MODE_MAP = {
  bullet: "chess_bullet",
  blitz: "chess_blitz",
  rapid: "chess_rapid",
};

/**
 * Returns rating history for a Chess.com user.
 *
 * Strategy: fetch the last `months` monthly game archives, then for each
 * month sample the first game of the month and the last game, giving a
 * lightweight series of data points without downloading every game.
 *
 * @param {string} username
 * @param {string} mode  "bullet" | "blitz" | "rapid"
 * @param {number} months  How many months of history to fetch (max 12)
 * @returns {Promise<{ mode: string, points: Array<{ date: Date, rating: number }> }>}
 */
async function fetchChessDotComHistory(username, mode = "blitz", months = 6) {
  mode = mode.toLowerCase();
  const apiMode = MODE_MAP[mode];
  if (!apiMode) throw Object.assign(new Error(`Unknown mode "${mode}"`), { status: 400 });

  // Get list of monthly archive URLs
  const archivesRes = await fetch(
    `https://api.chess.com/pub/player/${username}/games/archives`,
    { headers: HEADERS }
  );
  if (archivesRes.status === 404)
    throw Object.assign(new Error(`Chess.com user "${username}" not found`), { status: 404 });
  if (!archivesRes.ok)
    throw new Error(`Chess.com API error (${archivesRes.status})`);

  const { archives = [] } = await archivesRes.json();
  const slice = archives.slice(-Math.min(months, 12));

  if (slice.length === 0) return { mode, points: [] };

  // Fetch all months in parallel
  const monthGames = await Promise.all(
    slice.map(async (url) => {
      const r = await fetch(url, { headers: HEADERS });
      if (!r.ok) return [];
      const { games = [] } = await r.json();
      return games;
    })
  );

  const points = [];

  for (const games of monthGames) {
    // Filter to this mode and where the user played either side
    const modeGames = games.filter((g) => g.time_class === mode);
    if (modeGames.length === 0) continue;

    // Sample ~8 evenly-spaced games per month to keep the chart clean
    const step = Math.max(1, Math.floor(modeGames.length / 8));
    const sampled = [
      ...modeGames.filter((_, i) => i % step === 0),
      modeGames[modeGames.length - 1], // always include last
    ];

    for (const g of sampled) {
      const end = g.end_time; // unix timestamp
      const white = g.white?.username?.toLowerCase() === username.toLowerCase();
      const rating = white ? g.white?.rating : g.black?.rating;
      if (!rating || !end) continue;
      points.push({ date: new Date(end * 1000), rating });
    }
  }

  // Sort chronologically and deduplicate timestamps
  points.sort((a, b) => a.date - b.date);
  const deduped = points.filter(
    (p, i) => i === 0 || p.date.getTime() !== points[i - 1].date.getTime()
  );

  return { mode, points: deduped };
}

/**
 * Returns rating history for a Lichess user.
 *
 * Uses the dedicated /api/user/:username/rating-history endpoint which
 * returns clean [year, month0, day, rating] tuples — no extra fetches needed.
 *
 * @param {string} username
 * @param {string} mode  "bullet" | "blitz" | "rapid" | "puzzle"
 * @param {number} months  How many months of history to include
 */
async function fetchLichessHistory(username, mode = "blitz", months = 6) {
  mode = mode.toLowerCase();

  const LICHESS_MODE_NAMES = {
    bullet: "Bullet",
    blitz: "Blitz",
    rapid: "Rapid",
    puzzle: "Puzzles",
  };
  const modeName = LICHESS_MODE_NAMES[mode];
  if (!modeName) throw Object.assign(new Error(`Unknown mode "${mode}"`), { status: 400 });

  const res = await fetch(
    `https://lichess.org/api/user/${username}/rating-history`,
    { headers: { ...HEADERS, Accept: "application/json" } }
  );
  if (res.status === 404)
    throw Object.assign(new Error(`Lichess user "${username}" not found`), { status: 404 });
  if (!res.ok) throw new Error(`Lichess API error (${res.status})`);

  const history = await res.json();
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

  // Lichess can return thousands of points; downsample to ~120 max
  const MAX_POINTS = 120;
  const step = Math.max(1, Math.floor(points.length / MAX_POINTS));
  const sampled = [
    ...points.filter((_, i) => i % step === 0),
    points[points.length - 1],
  ].filter(Boolean);

  // Deduplicate
  const seen = new Set();
  const deduped = sampled.filter((p) => {
    const k = p.date.getTime();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { mode, points: deduped };
}

module.exports = { fetchChessDotComHistory, fetchLichessHistory };
