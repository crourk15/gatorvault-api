/**
 * Portal Intelligence pipeline.
 * @see server/docs/futurecast-platform-spec.md §2.2
 */
import { computePortalLikelihood } from '../../../api/portal/engine';
import { listPortalCandidates, portalRowToEngineInput } from '../../../models/portal-intel';
import { getPortalProfileByPlayerId, upsertPortalProfile } from '../../../models/portal-profile';
import type { PortalIntelOptions, PortalIntelResult } from './index';
import { computeReasonTags } from './reason-tags';

export async function analyzeUsageVsTalent(_playerId: string): Promise<string[]> {
  void _playerId;
  return [];
}

export async function analyzeDepthChartSqueeze(_playerId: string): Promise<string[]> {
  void _playerId;
  return [];
}

export async function computePortalLikelihoodFromTags(_tags: string[]): Promise<number> {
  void _tags;
  return 0;
}

export async function runPortalIntelJob({
  limit = 200,
  dryRun = false,
}: { limit?: number; dryRun?: boolean } = {}) {
  const rows = await listPortalCandidates({ limit });
  let processed = 0;
  let updated = 0;
  let likelihoodSum = 0;
  const samples: Array<{ slug: string; portalLikelihood: number }> = [];

  for (const row of rows) {
    const input = portalRowToEngineInput(row);
    const likelihood = computePortalLikelihood(input);
    const scorePct = Math.round(likelihood * 1000) / 10;

    if (!dryRun) {
      const existing = await getPortalProfileByPlayerId(row.id);
      if (existing) {
        await upsertPortalProfile({ player_id: row.id, portal_likelihood: scorePct });
        updated += 1;
      } else if (row.lifecycle === 'PORTAL' || row.portal_status) {
        await upsertPortalProfile({
          player_id: row.id,
          portal_likelihood: scorePct,
          portal_status: row.portal_status || 'IN_PORTAL',
          previous_school: row.previous_school ?? row.college,
          reason_tags: [],
        });
        updated += 1;
      } else if (row.lifecycle === 'COLLEGE') {
        await upsertPortalProfile({
          player_id: row.id,
          portal_likelihood: scorePct,
          portal_status: 'COMMITTED',
          previous_school: row.college,
          reason_tags: [],
        });
        updated += 1;
      }
    }

    processed += 1;
    likelihoodSum += scorePct;
    if (samples.length < 5) {
      samples.push({ slug: row.slug, portalLikelihood: scorePct });
    }
  }

  return {
    ok: true,
    dryRun,
    playersProcessed: processed,
    playersUpdated: updated,
    tagsApplied: 0,
    avgLikelihood: processed ? Math.round((likelihoodSum / processed) * 10) / 10 : 0,
    samples,
  };
}

export async function runPortalIntelPipeline(opts: PortalIntelOptions): Promise<PortalIntelResult> {
  void computeReasonTags;
  const result = await runPortalIntelJob({ dryRun: opts.dryRun ?? false });
  return {
    playersScored: result.playersProcessed,
    tagsApplied: result.tagsApplied,
    avgLikelihood: result.avgLikelihood,
  };
}
