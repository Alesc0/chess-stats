type ChessModeRatingLast = {
  rating: number;
  date: number;
  rd: number;
};

type ChessModeRatingBest = {
  rating: number;
  date: number;
  game: string;
};

type ChessModeRecord = {
  win: number;
  loss: number;
  draw: number;
};

type ChessModeStats = {
  last: ChessModeRatingLast;
  best?: ChessModeRatingBest;
  record: ChessModeRecord;
};

type ChessTacticsEntry = {
  rating: number;
  date: number;
};

type ChessTactics = {
  highest: ChessTacticsEntry;
  lowest: ChessTacticsEntry;
};

type ChessDotComStatsResponse = {
  chess_bullet: ChessModeStats;
  chess_blitz: ChessModeStats;
  chess_rapid: ChessModeStats;
  tactics: ChessTactics;
  puzzle_rush: Record<string, never>;
};

type ChessStats = {
  platform: string;
  username: string;
  title: string | null;
  country: string | null;
  profile: ChessDotComProfile | LichessProfile;
  stats: {
    bullet: ChessModeStats | null;
    blitz: ChessModeStats | null;
    rapid: ChessModeStats | null;
    tactics?: ChessDotComStatsResponse["tactics"];
  };
  wins: number;
  losses: number;
  draws: number;
  recentGames: { result: string; type: string }[];
};

type LichessProfile = {
  flag: string;
  location: string;
  realName: string;
  bio: string;
  title: string | null;
  fideRating: number | null;
};

/**
 * Profile object returned by https://api.chess.com/pub/player/:username
 */
type ChessDotComProfile = {
  avatar: string | null;
  player_id: number;
  "@id": string;
  url: string;
  name: string | null;
  title?: string | null;
  username: string;
  followers: number;
  country: string; // URL to country resource
  location: string | null;
  last_online: number; // unix timestamp
  joined: number; // unix timestamp
  status: string; // e.g. "basic"
  is_streamer: boolean;
  twitch_url?: string | null;
  verified: boolean;
  league: string | null;
  streaming_platforms: Array<{ type: string; channel_url: string }>;
};

export {
  ChessModeRatingLast,
  ChessModeRatingBest,
  ChessModeRecord,
  ChessModeStats,
  ChessTacticsEntry,
  ChessTactics,
  ChessDotComStatsResponse,
  ChessDotComProfile,
  ChessStats,
  LichessProfile,
};
