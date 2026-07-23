import type { TeamHubBundle } from '@/lib/team-hub-api';
import type { RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import type { MasterBoardResponse } from '@/lib/futurecast-board-types';
import { primaryRecruitingClassYear } from '@/lib/recruiting-cycle';
import type { PipelinePreviewData, TeamHeroMetric } from './team-premium-types';
import {
  buildFutureCastSlugMap,
  commitCompositeRating,
  resolveUfProbabilityPct,
  ufPctFromRaw,
} from './team-pipeline-utils';

/**
 * One honest hero pulse from real depth-chart / roster stats — no cosplay grades.
 */
export function computeHeroPulse(bundle: TeamHubBundle): TeamHeroMetric {
  const { rosterCount, startersLocked, positionBattles, updatedLabel } = bundle.commandStats;
  const parts: string[] = [];
  if (rosterCount > 0) parts.push(`${rosterCount} on roster`);
  if (startersLocked > 0) parts.push(`${startersLocked} locked`);
  if (positionBattles > 0) parts.push(`${positionBattles} battles`);
  const value = parts.length ? parts.join(' · ') : 'Depth chart loading';
  return {
    id: 'pulse',
    label: updatedLabel && updatedLabel !== '—' ? `Updated ${updatedLabel}` : 'Team pulse',
    value,
  };
}

/** @deprecated Prefer computeHeroPulse — kept for home preview migration. */
export function computeHeroMetrics(bundle: TeamHubBundle): TeamHeroMetric[] {
  const pulse = computeHeroPulse(bundle);
  const portalAdditions = bundle.roster.filter((p) => p.tags?.includes('portal')).length;
  return [
    { id: 'scholarships', label: 'On roster', value: String(bundle.commandStats.rosterCount || '—') },
    {
      id: 'locked',
      label: 'Locked starters',
      value: String(bundle.commandStats.startersLocked || '—'),
    },
    {
      id: 'battles',
      label: 'Battles',
      value: String(bundle.commandStats.positionBattles || '—'),
    },
    {
      id: 'portal-add',
      label: 'Portal additions',
      value: portalAdditions > 0 ? String(portalAdditions) : '—',
    },
    pulse,
  ];
}

export function buildPipelinePreview(
  board: RecruitingBoardResponse | null,
  fcBoard: MasterBoardResponse | null = null
): PipelinePreviewData {
  const fcBySlug = buildFutureCastSlugMap(fcBoard);
  const commits = [...(board?.commits ?? [])]
    .sort((a, b) => commitCompositeRating(b) - commitCompositeRating(a))
    .slice(0, 5)
    .map((p) => ({
      name: p.name,
      position: p.position ?? p.pos ?? '—',
      stars: p.stars ?? 0,
      composite: commitCompositeRating(p),
    }));

  const targetPool = board?.targets ?? board?.players ?? [];
  const topTargets = targetPool
    .filter((p) => p.isTarget || !p.isCommittedToUF)
    .slice()
    .sort((a, b) => {
      const probA = resolveUfProbabilityPct(a, fcBySlug) ?? -1;
      const probB = resolveUfProbabilityPct(b, fcBySlug) ?? -1;
      if (probB !== probA) return probB - probA;
      return commitCompositeRating(b) - commitCompositeRating(a);
    })
    .slice(0, 5)
    .map((p) => ({
      name: p.name,
      position: p.position ?? p.pos ?? '—',
      ufProbability: resolveUfProbabilityPct(p, fcBySlug),
    }));

  const allPlayers = [...(board?.commits ?? []), ...targetPool];
  const fitScores = allPlayers
    .map((p) => {
      const fc = p.slug ? fcBySlug.get(p.slug.toLowerCase()) : undefined;
      return p.fitScore ?? fc?.fitScore;
    })
    .filter((s): s is number => typeof s === 'number' && Number.isFinite(s));

  const probs = allPlayers
    .map((p) => resolveUfProbabilityPct(p, fcBySlug))
    .filter((s): s is number => s != null);

  const stateMap = new Map<string, number>();
  for (const p of allPlayers) {
    const st = p.state?.trim();
    if (st) stateMap.set(st, (stateMap.get(st) ?? 0) + 1);
  }
  const stateCounts = [...stateMap.entries()]
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    classYear: board?.classYear ?? primaryRecruitingClassYear(),
    topCommits: commits,
    topTargets,
    avgFitScore: fitScores.length
      ? Math.round((fitScores.reduce((a, b) => a + b, 0) / fitScores.length) * 10) / 10
      : 0,
    avgFutureCastProb: probs.length ? Math.round(probs.reduce((a, b) => a + b, 0) / probs.length) : 0,
    stateCounts,
  };
}

export { ufPctFromRaw };
