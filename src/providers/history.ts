const HEADERS = { "User-Agent": "chess-stats-api/1.0" };

const MODE_MAP: Record<string, string> = {
  bullet: "chess_bullet",
  blitz: "chess_blitz",
  rapid: "chess_rapid",
};

export async function fetchChessDotComHistory(username: string, mode = "blitz", months = 6) {
  mode = mode.toLowerCase();
  const apiMode = MODE_MAP[mode];
  if (!apiMode) throw Object.assign(new Error(`Unknown mode "${mode}"`), { status: 400 });

  const archivesRes = await fetch(
    `https://api.chess.com/pub/player/${username}/games/archives`,
    { headers: HEADERS },
  );
  if (archivesRes.status === 404)
    throw Object.assign(new Error(`Chess.com user "${username}" not found`), { status: 404 });
  if (!archivesRes.ok)
    throw new Error(`Chess.com API error (${archivesRes.status})`);

  const { archives = [] } = await archivesRes.json() as { archives: string[] };
  const slice = archives.slice(-Math.min(months, 12));

  if (slice.length === 0) return { mode, points: [] };

  const monthGames = await Promise.all(
    slice.map(async (url) => {
      const r = await fetch(url, { headers: HEADERS });
      if (!r.ok) return [];
      const { games = [] } = await r.json() as { games: any[] };
      return games;
    }),
  );

  const points: { date: Date; rating: number }[] = [];

  for (const games of monthGames) {
    const modeGames = games.filter((g: any) => g.time_class === mode);
    if (modeGames.length === 0) continue;

    const step = Math.max(1, Math.floor(modeGames.length / 8));
    const sampled = [
      ...modeGames.filter((_: any, i: number) => i % step === 0),
      modeGames[modeGames.length - 1],
    ];

    for (const g of sampled) {
      const end = g.end_time;
      const white = g.white?.username?.toLowerCase() === username.toLowerCase();
      const rating = white ? g.white?.rating : g.black?.rating;
      if (!rating || !end) continue;
      points.push({ date: new Date(end * 1000), rating });
    }
  }

  points.sort((a, b) => a.date.getTime() - b.date.getTime());
  const deduped = points.filter(
    (p, i) => i === 0 || p.date.getTime() !== points[i - 1].date.getTime(),
  );

  return { mode, points: deduped };
}

export async function fetchLichessHistory(username: string, mode = "blitz", months = 6) {
  mode = mode.toLowerCase();

  const LICHESS_MODE_NAMES: Record<string, string> = {
    bullet: "Bullet",
    blitz: "Blitz",
    rapid: "Rapid",
    puzzle: "Puzzles",
  };
  const modeName = LICHESS_MODE_NAMES[mode];
  if (!modeName) throw Object.assign(new Error(`Unknown mode "${mode}"`), { status: 400 });

  const res = await fetch(
    `https://lichess.org/api/user/${username}/rating-history`,
    { headers: { ...HEADERS, Accept: "application/json" } },
  );
  if (res.status === 404)
    throw Object.assign(new Error(`Lichess user "${username}" not found`), { status: 404 });
  if (!res.ok) throw new Error(`Lichess API error (${res.status})`);

  const history = await res.json() as Array<{ name: string; points: [number, number, number, number][] }>;
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
