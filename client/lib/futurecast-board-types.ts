/**
 * FutureCast elite board — shared types (2027 allow-list only).
 * API response types: client/lib/futurecast-elite-api-types.ts
 */

export type FutureCastPriority = 'high' | 'medium' | 'low';

export type FutureCastPlayer = {
  id: string;
  slug: string;
  name: string;
  classYear: number;
  position: string;
  school?: string | null;
  hometown?: string | null;
  state?: string | null;
  composite: number;
  stars: number;
  natlRank?: number | null;
  posRank?: number | null;
  stateRank?: number | null;
  /** UF % (Likelihood) — see futurecast-elite-metrics.ts. Board field; high-priority API uses ufProbability. */
  ufConfidence: number | null;
  /** Fit % (Scheme Match) — scheme, roster, and athletic fit. */
  fitScore: number | null;
  trendDelta7d: number | null;
  volatility7d: number;
  /** Priority tier tag; numeric Priority Score (importance) is on high-priority API. */
  priority: FutureCastPriority;
  committedTo?: string | null;
  predictors?: Array<{ name: string; score: number }>;
  competingSchools?: Array<{ name: string; pct: number }>;
};

export type MovementHeatmap = {
  upCount: number;
  downCount: number;
  flatCount: number;
};

export type CommitWatchEntry = {
  playerId: string;
  slug: string;
  name: string;
  /** UF % (Likelihood). */
  ufConfidence: number;
  recentMovement: number;
};

export type MasterBoardResponse = {
  classYear: number;
  updatedAt: string;
  movementHeatmap: MovementHeatmap;
  heatmap: {
    buckets: { label: string; count: number }[];
    windowDays: number;
  };
  /** Average UF % (Likelihood) across the allow-list board. */
  ufConfidenceAverage: number;
  confidenceSparkline: number[];
  commitWatch: CommitWatchEntry[];
  highPriority: {
    playerIds: string[];
    players: FutureCastPlayer[];
  };
  movementSummary: {
    risers: string[];
    fallers: string[];
    highVolatility: string[];
    riserPlayers: FutureCastPlayer[];
    fallerPlayers: FutureCastPlayer[];
    volatilePlayers: FutureCastPlayer[];
  };
  players: FutureCastPlayer[];
};

export type TrendingBoardResponse = {
  classYear: number;
  updatedAt: string;
  trendingUp: FutureCastPlayer[];
  trendingDown: FutureCastPlayer[];
};

export type MovementIntelResponse = {
  classYear: number;
  updatedAt: string;
  movementHeatmap: MovementHeatmap;
  heatmap: {
    buckets: { label: string; count: number }[];
    windowDays: number;
  };
  risers: FutureCastPlayer[];
  fallers: FutureCastPlayer[];
  highVolatility: FutureCastPlayer[];
  stable: FutureCastPlayer[];
  fitScoreLeaders: FutureCastPlayer[];
  fitScoreRisks: FutureCastPlayer[];
  alerts: { id: string; message: string; createdAt: string }[];
};

export type StaffNote = {
  id?: string;
  playerId?: string;
  playerSlug: string;
  playerName: string;
  note?: string;
  notePreview?: string | null;
  /** Priority tier tag on staff notes (not numeric Priority Score). */
  priority?: FutureCastPriority;
  createdAt?: string | null;
  updatedAt?: string | null;
  position?: string | null;
  school?: string | null;
  classYear?: number | null;
  compositeScore?: number;
  nationalRank?: number | null;
  posRank?: number | null;
  stateRank?: number | null;
  /** Fit % (Scheme Match). */
  fitScore?: number;
  trendDelta7d?: number;
  staffNotes?: string | null;
  insiderNotes?: string | null;
  projection?: string | null;
};

export type StaffNotesResponse = {
  classYear: number;
  updatedAt: string;
  totalNotes: number;
  count: number;
  notes: StaffNote[];
};
