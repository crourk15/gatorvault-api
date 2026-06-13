/**
 * Live HS commit list from recruiting store (source of truth for UF commits).
 */
import { createRequire } from 'node:module';
import type { SerializedFeedPrediction } from '../predictions/utils-api';

const require = createRequire(import.meta.url);

export interface LiveCommitRef {
  slug: string;
  fullName: string;
  classYear: number;
  position: string;
  committedTo: string;
}

export async function listRecruitingStoreCommits(classYear: number): Promise<LiveCommitRef[]> {
  try {
    const store = require('../../lib/recruiting-store');
    const players = await store.getAllPlayers();
    return players
      .filter(
        (p: {
          classYear?: number;
          committedTo?: string;
          category?: string;
          status?: string;
        }) =>
          p.classYear === classYear &&
          p.category === 'recruit' &&
          /^florida$/i.test(String(p.committedTo || '').trim()) &&
          /^(committed|signed|enrolled)$/i.test(String(p.status || 'committed'))
      )
      .map(
        (p: {
          slug: string;
          name?: string;
          classYear: number;
          position?: string;
          committedTo?: string;
        }) => ({
          slug: p.slug,
          fullName: p.name || p.slug,
          classYear: p.classYear,
          position: p.position || 'ATH',
          committedTo: p.committedTo || 'Florida',
        })
      );
  } catch {
    return [];
  }
}

/** Merge model commits with live recruiting-store commits (dedupe by slug). */
export function mergeLiveCommits(
  modelCommits: SerializedFeedPrediction[],
  liveCommits: LiveCommitRef[]
): SerializedFeedPrediction[] {
  const bySlug = new Map<string, SerializedFeedPrediction>();
  for (const row of modelCommits) {
    if (row.playerSlug) bySlug.set(row.playerSlug, row);
  }

  for (const live of liveCommits) {
    if (bySlug.has(live.slug)) continue;
    bySlug.set(live.slug, {
      id: `live-${live.slug}`,
      playerId: live.slug,
      playerSlug: live.slug,
      fullName: live.fullName,
      classYear: live.classYear,
      position: live.position,
      lifecycle: 'HS',
      school: 'Florida',
      confidence: 0,
      sourceType: 'LIVE',
      predictorId: 'recruiting-store',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      committedTo: live.committedTo,
      ufStatus: 'COMMITTED',
      ufFitScore: null,
      ufProbability: 0,
      fitScoreBreakdown: {
        scheme: 0,
        culture: 0,
        staff: 0,
        need: 0,
        geo: 0,
      },
      volatilityScore: 0,
      stabilityScore: 100,
    });
  }

  return [...bySlug.values()];
}
