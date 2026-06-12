/**
 * FutureCast Predictions Engine — model picks with confidence scores.
 * @see FutureCast Phase 8 spec
 */
import { hasSignalType } from '../big-board/utils';
import { computePortalLikelihood, computeTransferPredictions } from '../portal/engine';
import type { PortalIntelInput } from '../portal/engine';
import { computeUfFitScore, ufFitIntelFromBigBoardRow } from '../uf-fit/engine';
import type { PredictionCandidateRow } from '../../models/predictions';
import { mapSignalTypes } from '../../models/predictions';

export interface ModelPrediction {
  school: string;
  confidence: number;
}

export interface PredictionEngineInput {
  playerId: string;
  lifecycle: string;
  committedTo: string | null;
  portalInput: PortalIntelInput;
  ufFitScore: number;
}

function schoolsFromOffers(offers: unknown[]): string[] {
  const out: string[] = [];
  for (const offer of offers) {
    if (offer && typeof offer === 'object' && 'school' in offer) {
      const school = String((offer as { school?: string }).school || '').trim();
      if (school) out.push(school);
    }
  }
  return out;
}

function clamp100(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function candidateToEngineInput(row: PredictionCandidateRow): PredictionEngineInput {
  const signalTypes = mapSignalTypes(row.signal_types);
  const ufFitScore = computeUfFitScore(
    ufFitIntelFromBigBoardRow(
      {
        id: row.id,
        uf_fit_score: row.uf_fit_score,
        scheme_score: row.scheme_score,
        character_score: row.character_score,
        athletic_score: row.athletic_score,
        timeline_score: row.timeline_score,
        uf_status: row.uf_status,
      },
      { signals: [] }
    )
  );

  const portalInput: PortalIntelInput = {
    id: row.id,
    lifecycle: row.status,
    portal_likelihood_stored: row.portal_likelihood_stored,
    signal_types: signalTypes,
    signals: [],
    depth_history: null,
    college_stats: null,
    college_snaps: null,
    stars: row.stars,
    composite_rating: row.composite_rating,
    hometown: row.hometown,
    state: row.state,
    college: row.college,
    previous_school: row.previous_school,
    uf_fit_score: ufFitScore,
    scheme_score: row.scheme_score,
    uf_status: row.uf_status,
    hs_offers: row.hs_offers ?? [],
  };

  return {
    playerId: row.id,
    lifecycle: row.status,
    committedTo: row.committed_to,
    portalInput,
    ufFitScore,
  };
}

/** Generate top model pick with 0–100 confidence. */
export function computeModelPrediction(input: PredictionEngineInput): ModelPrediction | null {
  const { portalInput, ufFitScore, committedTo, lifecycle } = input;

  if (committedTo) {
    const conf = committedTo.toLowerCase().includes('florida') ? clamp100(ufFitScore + 10) : 75;
    return { school: committedTo, confidence: Math.min(100, conf) };
  }

  const portalLikelihood = computePortalLikelihood(portalInput);
  const transferPicks = computeTransferPredictions(portalInput);

  const scores = new Map<string, number>();

  function add(school: string, weight: number) {
    if (!school) return;
    scores.set(school, (scores.get(school) ?? 0) + weight);
  }

  add('Florida', (ufFitScore / 100) * 45);

  if (portalInput.uf_status === 'TARGET') add('Florida', 12);
  if (portalInput.uf_status === 'PRIORITY') add('Florida', 18);
  if (portalInput.uf_status === 'COMMITTED') add('Florida', 25);
  if (hasSignalType(portalInput.signal_types, 'STAFF_FLAG')) add('Florida', 10);
  if (hasSignalType(portalInput.signal_types, 'OFFER')) {
    for (const s of schoolsFromOffers(portalInput.hs_offers)) add(s, 15);
  }

  for (const pick of transferPicks) {
    add(pick.school, pick.score * (30 + portalLikelihood * 20));
  }

  for (const school of schoolsFromOffers(portalInput.hs_offers)) {
    add(school, 12);
  }

  if (lifecycle === 'PORTAL' && portalInput.previous_school) {
    add(portalInput.previous_school, 5);
  }

  if (!scores.size) {
    if (ufFitScore >= 50) return { school: 'Florida', confidence: clamp100(ufFitScore * 0.7) };
    return null;
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [topSchool, topScore] = sorted[0];
  const secondScore = sorted[1]?.[1] ?? 0;
  const maxRaw = Math.max(...scores.values(), 1);

  let confidence = (topScore / maxRaw) * 70 + (ufFitScore / 100) * 25;
  if (topScore - secondScore > maxRaw * 0.15) confidence += 8;
  if (portalLikelihood > 0.5 && lifecycle !== 'HS') confidence += portalLikelihood * 10;

  return {
    school: topSchool,
    confidence: clamp100(confidence),
  };
}

export async function syncModelPredictionsForCandidates(
  candidates: PredictionCandidateRow[],
  upsert: (data: {
    player_id: string;
    school: string;
    confidence: number;
    source_type: 'MODEL';
    predictor_id: string;
  }) => Promise<unknown>
): Promise<number> {
  let count = 0;
  for (const row of candidates) {
    const input = candidateToEngineInput(row);
    const pick = computeModelPrediction(input);
    if (!pick || pick.confidence < 35) continue;
    await upsert({
      player_id: row.id,
      school: pick.school,
      confidence: pick.confidence,
      source_type: 'MODEL',
      predictor_id: 'system',
    });
    count += 1;
  }
  return count;
}
