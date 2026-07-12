/**
 * Player Profile derived fields — mirrors Big Board engine scoring + color logic.
 * @see server/api/big-board/engine.ts
 * @see server/api/big-board/utils.ts
 */
import type {
  CollegeProfile,
  DiscoverySignal,
  PlayerCore,
  PortalProfile,
  UFSpecificProfile,
} from './player-api';

export const SIGNAL_TYPE_WEIGHTS: Record<string, number> = {
  OFFER: 10,
  COMPETING_INTEREST: 6,
  RANKING_JUMP: 15,
  CAMP_PERFORMANCE: 20,
  EVALUATION_NOTE: 10,
  SOCIAL_MOMENTUM: 5,
  PORTAL_ACTIVITY: 25,
  STAFF_FLAG: 30,
  OTHER: 5,
};

export const UF_FIT_COMPONENT_MAX = {
  scheme: 40,
  culture: 30,
  positionalNeed: 20,
  staffInterest: 10,
} as const;

export const UF_STATUS_INTEREST: Record<string, number> = {
  TARGET: 5,
  PRIORITY: 8,
  EVAL: 3,
  COMMITTED: 10,
  NOT_INTERESTED: 0,
};

export type FitTier = 'elite' | 'strong' | 'moderate' | 'low';
export type ColorBand = 'high' | 'medium' | 'low' | 'neutral';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp100(value: number): number {
  return clamp(value, 0, 100);
}

function normalizePercent(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n > 1) return n / 100;
  return n;
}

export function formatHeight(inches: number | null): string {
  if (inches == null || !Number.isFinite(inches)) return '—';
  const ft = Math.floor(inches / 12);
  const inch = Math.round((inches % 12) * 2) / 2;
  const inchLabel = Number.isInteger(inch) ? String(inch) : inch.toFixed(1);
  return `${ft}'${inchLabel}"`;
}

export function formatWeight(lbs: number | null): string {
  if (lbs == null || !Number.isFinite(lbs)) return '—';
  return `${lbs} lbs`;
}

export function fitTier(score: number): FitTier {
  if (score >= 85) return 'elite';
  if (score >= 70) return 'strong';
  if (score >= 50) return 'moderate';
  return 'low';
}

export function fitTierLabel(tier: FitTier): string {
  const labels: Record<FitTier, string> = {
    elite: 'Elite',
    strong: 'Strong',
    moderate: 'Moderate',
    low: 'Low',
  };
  return labels[tier];
}

export function lifecycleColor(lifecycle: string): string {
  switch (lifecycle) {
    case 'HS':
      return '#38bdf8';
    case 'COLLEGE':
      return '#fb923c';
    case 'PORTAL':
      return '#c4b5fd';
    default:
      return '#94a3b8';
  }
}

export function portalLikelihoodColor(pct: number): ColorBand {
  if (pct >= 70) return 'high';
  if (pct >= 40) return 'medium';
  if (pct > 0) return 'low';
  return 'neutral';
}

export function signalWeight(type: string): number {
  return SIGNAL_TYPE_WEIGHTS[type] ?? SIGNAL_TYPE_WEIGHTS.OTHER;
}

export function computeUfFitScore(uf: UFSpecificProfile | null): number {
  if (!uf) return 0;
  if (uf.ufFitScore != null) return clamp100(uf.ufFitScore);

  const scheme = ((uf.schemeScore ?? 0) / 100) * UF_FIT_COMPONENT_MAX.scheme;
  const culture = ((uf.characterScore ?? 0) / 100) * UF_FIT_COMPONENT_MAX.culture;
  const positionalNeed =
    ((uf.athleticScore ?? uf.timelineScore ?? 0) / 100) * UF_FIT_COMPONENT_MAX.positionalNeed;
  const staffInterest =
    ((UF_STATUS_INTEREST[uf.ufStatus ?? ''] ?? 0) / 10) * UF_FIT_COMPONENT_MAX.staffInterest;

  return clamp100(scheme + culture + positionalNeed + staffInterest);
}

export interface UfFitComponents {
  schemeFit: number;
  cultureFit: number;
  positionalNeed: number;
  staffInterest: number;
  total: number;
}

export function computeUfFitComponents(uf: UFSpecificProfile | null): UfFitComponents | null {
  if (!uf) return null;
  const schemeFit = ((uf.schemeScore ?? 0) / 100) * UF_FIT_COMPONENT_MAX.scheme;
  const cultureFit = ((uf.characterScore ?? 0) / 100) * UF_FIT_COMPONENT_MAX.culture;
  const positionalNeed =
    ((uf.athleticScore ?? uf.timelineScore ?? 0) / 100) * UF_FIT_COMPONENT_MAX.positionalNeed;
  const staffInterest =
    ((UF_STATUS_INTEREST[uf.ufStatus ?? ''] ?? 0) / 10) * UF_FIT_COMPONENT_MAX.staffInterest;
  const total = computeUfFitScore(uf);
  return {
    schemeFit: Math.round(schemeFit * 10) / 10,
    cultureFit: Math.round(cultureFit * 10) / 10,
    positionalNeed: Math.round(positionalNeed * 10) / 10,
    staffInterest: Math.round(staffInterest * 10) / 10,
    total,
  };
}

function extractDepthChartRank(
  depthHistory: unknown[] | null | undefined,
  stats: Record<string, unknown> | null | undefined
): number | null {
  const fromStats = stats?.depth_chart_rank ?? stats?.depthChartRank;
  if (fromStats != null && Number.isFinite(Number(fromStats))) return Number(fromStats);
  if (!depthHistory?.length) return null;
  const last = depthHistory[depthHistory.length - 1] as Record<string, unknown>;
  const rank = last?.rank ?? last?.depth ?? last?.position_rank;
  if (rank != null && Number.isFinite(Number(rank))) return Number(rank);
  return null;
}

function extractSnapPercent(snaps: Record<string, unknown> | null | undefined): number | null {
  if (!snaps) return null;
  const raw =
    snaps.snap_pct ??
    snaps.snapPercent ??
    snaps.snap_percentage ??
    snaps.offense_pct ??
    snaps.total_pct;
  return normalizePercent(raw);
}

export function computePortalLikelihood(
  player: PlayerCore,
  portal: PortalProfile | null,
  college: CollegeProfile | null,
  signals: DiscoverySignal[]
): number {
  if (player.status === 'PORTAL') return 1;
  if (player.status === 'HS') return 0;

  const types = signals.map((s) => s.signalType);
  let score = 0.05;

  if (types.includes('PORTAL_ACTIVITY')) score += 0.25;
  if (types.includes('SOCIAL_MOMENTUM')) score += 0.15;
  if (types.includes('STAFF_FLAG')) score += 0.1;
  if (types.includes('EVALUATION_NOTE')) score += 0.05;

  const depthRank = extractDepthChartRank(college?.depthHistory, college?.stats);
  if (depthRank != null) {
    if (depthRank >= 4) score += 0.25;
    else if (depthRank >= 3) score += 0.15;
  }

  const snapPct = extractSnapPercent(college?.snaps);
  if (snapPct != null) {
    if (snapPct < 0.1) score += 0.25;
    else if (snapPct < 0.2) score += 0.15;
  }

  const highTalent =
    (player.stars != null && player.stars >= 4) ||
    (player.compositeRating != null && player.compositeRating >= 0.88);
  if (highTalent && snapPct != null && snapPct < 0.3) score += 0.1;

  return clamp01(score);
}

export function portalLikelihoodPercent(
  player: PlayerCore,
  portal: PortalProfile | null,
  college: CollegeProfile | null,
  signals: DiscoverySignal[]
): number {
  const raw = computePortalLikelihood(player, portal, college, signals);
  return Math.round(raw * 100);
}

export function daysInPortal(portal: PortalProfile | null): number | null {
  if (!portal?.enteredPortalAt) return null;
  const start = new Date(portal.enteredPortalAt);
  if (Number.isNaN(start.getTime())) return null;
  const end = portal.exitedPortalAt ? new Date(portal.exitedPortalAt) : new Date();
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function depthChartTier(
  college: CollegeProfile | null
): 'Starter' | 'Rotation' | 'Depth' | null {
  const rank = extractDepthChartRank(college?.depthHistory, college?.stats);
  if (rank == null) return null;
  if (rank <= 1) return 'Starter';
  if (rank === 2) return 'Rotation';
  return 'Depth';
}

export function snapSharePercent(college: CollegeProfile | null): number | null {
  const pct = extractSnapPercent(college?.snaps);
  if (pct == null) return null;
  return Math.round(pct * 100);
}

export function signalSummaryText(signals: DiscoverySignal[]): string {
  if (!signals.length) return 'No discovery signals yet';
  const types = [...new Set(signals.map((s) => s.signalType.replace(/_/g, ' ')))];
  return `${signals.length} signal${signals.length === 1 ? '' : 's'} · ${types.slice(0, 3).join(', ')}${types.length > 3 ? '…' : ''}`;
}

export function formatSignalValue(signal: DiscoverySignal | { signalType?: string; signalValue?: Record<string, unknown>; value?: Record<string, unknown> }): string {
  const raw = signal as {
    signalType?: string;
    signalValue?: Record<string, unknown>;
    value?: Record<string, unknown>;
  };
  const v = raw.signalValue ?? raw.value ?? {};
  const type = String(raw.signalType || '').toUpperCase();
  if (v.school) {
    const school = String(v.school);
    const pct = Number(v.interestPct);
    if (type === 'COMPETING_INTEREST' && Number.isFinite(pct) && pct > 0) {
      return `${school} · ${Math.round(pct * 10) / 10}% On3 interest`;
    }
    if (type === 'OFFER') {
      return school;
    }
    return school;
  }
  if (v.note) return String(v.note);
  if (v.message) return String(v.message);
  if (v.delta) return `+${v.delta}`;
  const entries = Object.entries(v).filter(([, val]) => val != null && val !== '');
  if (!entries.length) return '—';
  return entries
    .map(([k, val]) => {
      const text =
        val == null || val === ''
          ? ''
          : typeof val === 'object'
            ? JSON.stringify(val)
            : String(val);
      return text ? `${k.replace(/_/g, ' ')}: ${text}` : '';
    })
    .filter(Boolean)
    .join(' · ');
}

export function formatDate(iso: unknown): string {
  if (iso == null || iso === '') return '—';
  if (typeof iso === 'object') {
    if (iso instanceof Date) {
      return Number.isNaN(iso.getTime())
        ? '—'
        : iso.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
    return '—';
  }
  const raw = String(iso).trim();
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Stars are 1–5. Stored/API `0` means unknown — never treat as a rating. */
export function validStars(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const stars = Math.round(n);
  return stars >= 1 && stars <= 5 ? stars : null;
}

/** Avoid "Newnan, GA, GA" when hometown already includes state. */
export function formatPlayerLocation(
  hometown?: string | null,
  state?: string | null
): string {
  const town = String(hometown || '').trim();
  const st = String(state || '').trim();
  if (!town && !st) return '';
  if (!st) return town;
  if (!town) return st;
  const lowerTown = town.toLowerCase();
  const lowerSt = st.toLowerCase();
  if (
    lowerTown.endsWith(`, ${lowerSt}`) ||
    lowerTown.endsWith(`,${lowerSt}`) ||
    lowerTown.endsWith(` ${lowerSt}`)
  ) {
    return town;
  }
  return `${town}, ${st}`;
}

export interface PlayerMetrics {
  ufFitScore: number;
  ufFitTier: FitTier;
  /** UF commit display override (e.g. Locked In). */
  ufFitLabel?: string;
  portalLikelihoodPct: number | null;
  portalHidden?: boolean;
  portalColor: ColorBand;
  signalCount: number;
}

export function computePlayerMetrics(
  player: PlayerCore,
  uf: UFSpecificProfile | null,
  portal: PortalProfile | null,
  college: CollegeProfile | null,
  signals: DiscoverySignal[]
): PlayerMetrics {
  const ufFitScore = computeUfFitScore(uf);
  const portalLikelihoodPct = portalLikelihoodPercent(player, portal, college, signals);
  return {
    ufFitScore,
    ufFitTier: fitTier(ufFitScore),
    portalLikelihoodPct: portalLikelihoodPct,
    portalColor: portalLikelihoodColor(portalLikelihoodPct),
    signalCount: signals.length,
  };
}
