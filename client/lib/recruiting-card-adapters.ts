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
import type { StaffDashboardPlayer } from './staff-api';
import type { PortalIncomingPlayer } from './recruiting-api';
import { ensurePlayerSlug } from './slug';
import type { ClassicCardVariant } from '@/components/vault/ClassicRecruitCard';

export function minimalRecruitPlayer(slug: string, name: string): RecruitingBoardPlayer {
  return { slug, name, tier: 'HIGH' };
}

export function fromBigBoard(p: BigBoardPlayer): RecruitingBoardPlayer {
  return {
    slug: p.slug,
    name: p.fullName,
    tier: 'HIGH',
    position: p.position,
    classYear: p.classYear,
    rating: p.compositeScore || p.rating,
    displayRating: p.compositeScore || p.rating,
    natlRank: p.nationalRank ?? p.natlRank ?? p.rank,
    posRank: p.positionRank ?? p.posRank,
    stateRank: p.stateRank,
    stars: p.stars,
    fitScore: p.ufFitScore,
    ufProbability: p.ufFitScore > 0 ? Math.min(1, p.ufFitScore / 100) : null,
    skinny:
      p.portalLikelihood > 0
        ? `Portal likelihood ${p.portalLikelihood}% · ${p.signalCount} signals`
        : `${p.signalCount} FutureCast signals`,
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
    rating: p.compositeScore || p.rating,
    displayRating: p.compositeScore || p.rating,
    natlRank: p.nationalRank ?? p.natlRank,
    posRank: p.positionRank ?? p.posRank,
    stateRank: p.stateRank,
    stars: p.stars,
    fitScore: p.ufFitScore ?? undefined,
    ufProbability:
      p.ufProbability != null
        ? p.ufProbability / 100
        : isCommit && p.confidence
          ? p.confidence / 100
          : p.confidence
            ? p.confidence / 100
            : null,
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
  return {
    slug: p.slug,
    name: p.fullName,
    tier: 'HIGH',
    position: p.position,
    classYear: p.classYear,
    natlRank: p.rank,
    fitScore: p.ufFitScore,
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
