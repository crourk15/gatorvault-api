/**
 * Map API player shapes → RecruitingBoardPlayer for ClassicRecruitCard.
 */
import type { BigBoardPlayer } from './big-board-api';
import type { FeedPrediction } from './predictions-api';
import type { HeatCheckItem } from './recruiting-api';
import type { RecruitingBoardPlayer } from './recruiting-board-api';
import type { PortalWatchlistHomePlayer } from './futurecast-home-api';
import type { PortalWatchlistPlayer } from './portal-api';
import type { UfFitWatchlistPlayer } from './uf-fit-api';
import type { EarlyDiscoveryPlayer } from './early-discovery-api';
import type { UnderclassmenPlayer } from './futurecast-underclassmen-api';
import { formatRecruitSchoolLabel } from './recruiting-display-utils';
import type { StaffDashboardPlayer } from './staff-api';
import type { PortalIncomingPlayer } from './recruiting-api';
import { ensurePlayerSlug } from './slug';
import type { ClassicCardVariant } from '@/components/vault/ClassicRecruitCard';
import {
  youngerProspectFitPct,
  youngerProspectStars,
  youngerProspectTierLabel,
  youngerProspectUfPct,
} from './younger-prospects';

export function minimalRecruitPlayer(slug: string, name: string): RecruitingBoardPlayer {
  return { slug, name, tier: 'HIGH' };
}

export function fromUnderclassmenTarget(p: UnderclassmenPlayer): RecruitingBoardPlayer {
  const composite = p.composite > 0 ? p.composite : undefined;
  const isLiveOn3 = (p.natlRank ?? 0) > 0 && (p.composite ?? 0) > 0;
  const isUfCommit = isFloridaCommit(p.committedTo);
  const ufPct = isUfCommit ? 100 : p.ufConfidence ?? null;
  return {
    slug: p.slug,
    name: p.name,
    tier: isUfCommit ? 'TOP' : 'HIGH',
    position: p.position,
    classYear: p.classYear,
    state: p.state ?? undefined,
    stars: p.stars ?? 0,
    rating: composite,
    displayRating: composite,
    natlRank: isLiveOn3 ? (p.natlRank ?? undefined) : undefined,
    posRank: isLiveOn3 ? (p.posRank ?? undefined) : undefined,
    stateRank: isLiveOn3 ? (p.stateRank ?? undefined) : undefined,
    fitScore: p.fitScore ?? undefined,
    ufProbability: ufPct != null && ufPct > 0 ? ufPct / 100 : undefined,
    ufStatus: isUfCommit ? 'COMMITTED' : 'TARGET',
    statusLabel: isUfCommit ? 'Commit' : undefined,
    school: formatRecruitSchoolLabel(p.school ?? undefined) ?? undefined,
    committedTo: p.committedTo ?? undefined,
    isCommittedToUF: isUfCommit,
    inState: p.state === 'FL',
    heatPct: ufPct != null && ufPct > 0 ? ufPct : undefined,
    heatLabel: isUfCommit ? 'Locked In' : 'UF likelihood',
    ratingLabel: isLiveOn3 ? 'Composite' : composite != null ? 'Vault est.' : undefined,
    showIndustryRanks: isLiveOn3,
    movementDirection:
      p.trendDelta7d != null
        ? p.trendDelta7d > 0
          ? 'up'
          : p.trendDelta7d < 0
            ? 'down'
            : 'flat'
        : undefined,
    skinny: isUfCommit
      ? 'Committed to Florida'
      : p.tier === 'target'
        ? 'Locked UF target'
        : 'Underclassmen watchlist',
  };
}

/** 2029–2030 watchboard cards — name/pos/school first; hide filler UF/fit/stars. */
export function fromYoungerProspect(p: UnderclassmenPlayer): RecruitingBoardPlayer {
  const composite = p.composite > 0 ? p.composite : undefined;
  const isLiveOn3 = (p.natlRank ?? 0) > 0 && (p.composite ?? 0) > 0;
  const ufPct = youngerProspectUfPct(p);
  const fitPct = youngerProspectFitPct(p);
  const stars = youngerProspectStars(p.stars);
  const tierLabel = youngerProspectTierLabel(p);
  const year = Number(p.classYear) || 0;
  const delta = p.trendDelta7d ?? p.earlyMovement;
  const realMove =
    delta != null && Number.isFinite(Number(delta)) && Math.abs(Number(delta)) >= 0.005
      ? Number(delta)
      : null;

  return {
    slug: p.slug,
    name: p.name,
    tier: 'MEDIUM',
    position: p.position,
    classYear: year || undefined,
    state: p.state ?? undefined,
    stars: stars ?? 0,
    rating: composite,
    displayRating: composite,
    natlRank: isLiveOn3 ? (p.natlRank ?? undefined) : undefined,
    posRank: isLiveOn3 ? (p.posRank ?? undefined) : undefined,
    stateRank: isLiveOn3 ? (p.stateRank ?? undefined) : undefined,
    fitScore: fitPct ?? undefined,
    ufProbability: ufPct != null ? ufPct / 100 : undefined,
    ufStatus: tierLabel === 'Watch' ? 'EVAL' : 'TARGET',
    statusLabel: tierLabel,
    school: formatRecruitSchoolLabel(p.school ?? undefined) ?? undefined,
    inState: p.state === 'FL',
    heatPct: ufPct ?? undefined,
    heatLabel: 'UF likelihood',
    ratingLabel: isLiveOn3 ? 'Composite' : composite != null ? 'Vault est.' : undefined,
    showIndustryRanks: isLiveOn3,
    movementDirection:
      realMove != null ? (realMove > 0 ? 'up' : realMove < 0 ? 'down' : undefined) : undefined,
    skinny: year ? `Class of ${year}` : undefined,
  };
}

export function fromEarlyDiscovery(p: EarlyDiscoveryPlayer): RecruitingBoardPlayer {
  const composite = p.compositeScore ?? undefined;
  const isLiveOn3 = p.ratingSource === 'on3';
  const fitPending = p.ufFitScore == null || p.ufFitScore <= 0;
  const signalLine = p.signalCount ? ` · ${p.signalCount} signals` : '';
  const statusLine = p.ufStatus ? ` · UF ${p.ufStatus}` : '';
  const fitLine = fitPending ? ' · UF Fit pending' : '';
  const allowlist = p.allowlistTarget === true;
  const ufFrac = p.ufProbability ?? undefined;
  return {
    slug: p.slug,
    name: p.fullName,
    tier: allowlist || p.ufStatus === 'TARGET' ? 'HIGH' : 'MEDIUM',
    position: p.position ?? undefined,
    classYear: p.classYear,
    state: p.state ?? undefined,
    stars: p.stars ?? 0,
    rating: composite,
    displayRating: composite,
    natlRank: isLiveOn3 ? (p.nationalRank ?? undefined) : undefined,
    posRank: isLiveOn3 ? (p.positionRank ?? undefined) : undefined,
    stateRank: isLiveOn3 ? (p.stateRank ?? undefined) : undefined,
    fitScore: p.ufFitScore ?? undefined,
    ufProbability: ufFrac,
    ufStatus: p.ufStatus ?? undefined,
    school: formatRecruitSchoolLabel(p.school ?? undefined) ?? undefined,
    inState: p.inState ?? undefined,
    heatPct:
      allowlist && ufFrac != null
        ? Math.round(ufFrac * 100)
        : p.discoveryScore > 0
          ? p.discoveryScore
          : undefined,
    heatLabel: allowlist && ufFrac != null ? 'UF likelihood' : 'Discovery',
    ratingLabel: isLiveOn3 ? 'Composite' : 'Vault est.',
    showIndustryRanks: isLiveOn3,
    skinny: allowlist
      ? `Locked UF target · Discovery ${p.discoveryScore}${fitLine}`
      : `Discovery score ${p.discoveryScore}${signalLine}${statusLine}${fitLine}`,
  };
}

type EnrichedBigBoardPlayer = BigBoardPlayer & {
  stars?: number | null;
  rating?: number | null;
  compositeScore?: number | null;
  nationalRank?: number | null;
  natlRank?: number | null;
  posRank?: number | null;
  stateRank?: number | null;
  state?: string | null;
  school?: string | null;
  inState?: boolean;
  committedTo?: string | null;
  isCommittedToUF?: boolean;
};

function isFloridaCommit(committedTo?: string | null): boolean {
  return /\bflorida\b|\bgators\b|\buf\b/i.test(String(committedTo || ''));
}

export function fromBigBoard(p: EnrichedBigBoardPlayer): RecruitingBoardPlayer {
  const isUfCommit = p.isCommittedToUF === true || isFloridaCommit(p.committedTo);
  const composite = p.compositeScore ?? p.rating ?? undefined;
  const hasComposite = composite != null && Number(composite) > 0;
  const isLiveOn3 = (p.nationalRank ?? p.natlRank ?? 0) > 0 && hasComposite;
  const ufScore = isUfCommit ? 100 : p.ufFitScore > 0 ? p.ufFitScore : 0;
  return {
    slug: p.slug,
    name: p.fullName,
    tier: isUfCommit ? 'TOP' : 'HIGH',
    position: p.position,
    classYear: p.classYear,
    state: p.state ?? undefined,
    inState: p.inState ?? undefined,
    stars: p.stars ?? undefined,
    rating: hasComposite ? composite : undefined,
    displayRating: hasComposite ? composite : undefined,
    natlRank: isLiveOn3 ? (p.nationalRank ?? p.natlRank ?? undefined) : undefined,
    posRank: isLiveOn3 ? (p.posRank ?? undefined) : undefined,
    stateRank: isLiveOn3 ? (p.stateRank ?? undefined) : undefined,
    showIndustryRanks: isLiveOn3,
    ratingLabel: isLiveOn3 ? 'Composite' : hasComposite ? 'Vault est.' : undefined,
    school: formatRecruitSchoolLabel(p.school ?? undefined, p.state ?? undefined) ?? undefined,
    committedTo: p.committedTo ?? undefined,
    isCommittedToUF: isUfCommit,
    fitScore: ufScore > 0 ? ufScore : undefined,
    // Avoid a fake 0% heat meter when there is no UF Fit score yet.
    ufProbability: ufScore > 0 ? ufScore / 100 : undefined,
    heatPct: ufScore > 0 ? ufScore : undefined,
    heatLabel: isUfCommit ? 'Locked In' : ufScore > 0 ? 'UF interest' : undefined,
    skinny:
      isUfCommit
        ? `Committed to Florida`
        : p.portalLikelihood > 0
          ? `Portal likelihood ${Math.round(p.portalLikelihood * 100)}% · ${p.signalCount} signals`
          : p.signalCount > 0
            ? `${p.signalCount} FutureCast signals`
            : undefined,
  };
}

export function fromHeatCheck(item: HeatCheckItem): RecruitingBoardPlayer {
  return {
    slug: item.playerSlug ?? ensurePlayerSlug('', item.playerName),
    name: item.playerName,
    tier: 'HIGH',
    movementDirection: item.direction === 'rising' ? 'up' : 'down',
    skinny: item.headline ?? item.triggerLabel ?? undefined,
    predictionSchools: item.predictionSchool
      ? [{ school: item.predictionSchool, pct: 75 }]
      : undefined,
  };
}

export function fromStaffDashboard(p: StaffDashboardPlayer): RecruitingBoardPlayer {
  const delta = p.delta;
  return {
    slug: p.slug,
    name: p.name,
    tier: 'HIGH',
    fitScore: p.ufFitScore ?? undefined,
    movementDirection:
      delta != null ? (delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat') : undefined,
    skinny:
      delta != null
        ? `Movement ${delta > 0 ? '+' : ''}${delta}%${p.volatilityScore != null ? ` · Volatility ${p.volatilityScore}` : ''}`
        : p.volatilityScore != null
          ? `Volatility ${p.volatilityScore}`
          : undefined,
  };
}

export function fromFeedPrediction(
  p: FeedPrediction,
  variant: ClassicCardVariant = 'target'
): RecruitingBoardPlayer {
  const slug = p.playerSlug || p.playerId;
  const isCommit =
    variant === 'commit' || Boolean(p.committedTo?.toLowerCase().includes('florida'));
  return {
    slug,
    name: p.fullName,
    tier: 'HIGH',
    position: p.position,
    classYear: typeof p.classYear === 'number' ? p.classYear : undefined,
    school: p.school ?? undefined,
    rating: p.compositeScore ?? p.rating ?? 0,
    displayRating: p.compositeScore ?? p.rating ?? 0,
    natlRank: p.nationalRank ?? p.natlRank ?? 0,
    posRank: p.positionRank ?? p.posRank ?? 0,
    stateRank: p.stateRank ?? 0,
    stars: p.stars ?? 0,
    fitScore: p.ufFitScore ?? 0,
    ufProbability:
      p.ufProbability != null
        ? p.ufProbability / 100
        : isCommit && p.confidence != null
          ? p.confidence / 100
          : 0,
    movementDirection:
      p.delta != null ? (p.delta > 0 ? 'up' : p.delta < 0 ? 'down' : 'flat') : undefined,
    skinny: undefined,
    isCommittedToUF: isCommit,
    headliner: false,
    predictionSchools: p.school
      ? [{ school: p.school, pct: p.confidence ?? 50 }]
      : undefined,
  };
}

export function fromPortalWatchlist(
  p: PortalWatchlistPlayer | PortalWatchlistHomePlayer
): RecruitingBoardPlayer {
  return {
    slug: p.slug,
    name: p.fullName,
    tier: 'HIGH',
    position: p.position,
    classYear: p.classYear,
    natlRank: p.rank,
    skinny: `Portal ${'portalLikelihood' in p && typeof p.portalLikelihood === 'number' ? p.portalLikelihood : 0}% · Depth risk ${'depthChartRisk' in p ? p.depthChartRisk : '—'}`,
  };
}

export function fromUfFitWatchlist(p: UfFitWatchlistPlayer): RecruitingBoardPlayer {
  const isLiveOn3 = p.ratingSource === 'on3';
  const composite = p.compositeScore ?? undefined;
  return {
    slug: p.slug,
    name: p.fullName,
    tier: 'HIGH',
    position: p.position,
    classYear: p.classYear,
    school: p.school ?? undefined,
    inState: p.inState ?? undefined,
    stars: p.stars ?? undefined,
    rating: composite,
    displayRating: composite,
    natlRank: isLiveOn3 ? (p.nationalRank ?? undefined) : undefined,
    posRank: isLiveOn3 ? (p.positionRank ?? undefined) : undefined,
    stateRank: isLiveOn3 ? (p.stateRank ?? undefined) : undefined,
    fitScore: p.ufFitScore,
    heatPct: p.ufFitScore > 0 ? p.ufFitScore : undefined,
    heatLabel: 'UF Fit',
    ratingLabel: isLiveOn3 ? 'Composite' : composite != null ? 'Vault est.' : undefined,
    showIndustryRanks: isLiveOn3,
    movementDirection: p.fitDelta > 0 ? 'up' : p.fitDelta < 0 ? 'down' : 'flat',
    skinny: `UF Fit ${p.ufFitScore} · Δ ${p.fitDelta >= 0 ? '+' : ''}${p.fitDelta} · Vol ${p.fitVolatility}`,
  };
}

export function fromPortalIncoming(p: PortalIncomingPlayer): RecruitingBoardPlayer {
  return {
    slug: p.slug,
    name: p.fullName,
    tier: 'HIGH',
    position: p.position,
    classYear: p.classYear,
    school: p.previousSchool ?? undefined,
    fitScore: p.ufFitScore ?? undefined,
  };
}

export function resolveCardVariant(
  player: RecruitingBoardPlayer,
  hint?: ClassicCardVariant | 'ranking' | 'priority' | 'heat'
): ClassicCardVariant {
  if (hint === 'commit') return 'commit';
  if (player.isCommittedToUF) return 'commit';
  return 'target';
}
