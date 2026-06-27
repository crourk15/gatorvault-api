/**
 * Phase 2 — recompute portal_likelihood for college/portal candidates.
 */
import { computePortalLikelihood } from '../api/portal/engine';
import { listPortalCandidates, portalRowToEngineInput } from '../models/portal-intel';
import { getPortalProfileByPlayerId, upsertPortalProfile } from '../models/portal-profile';

export interface PortalIntelJobOptions {
  limit?: number;
  dryRun?: boolean;
}

export interface PortalIntelJobResult {
  ok: boolean;
  dryRun: boolean;
  playersProcessed: number;
  playersUpdated: number;
  tagsApplied: number;
  avgLikelihood: number;
  samples: Array<{ slug: string; portalLikelihood: number }>;
}

export async function runPortalIntelJob({
  limit = 200,
  dryRun = false,
}: PortalIntelJobOptions = {}): Promise<PortalIntelJobResult> {
  const rows = await listPortalCandidates({ limit });
  let processed = 0;
  let updated = 0;
  let likelihoodSum = 0;
  const samples: PortalIntelJobResult['samples'] = [];

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
