const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolvePredictionEvent,
  buildPredictionChangeText
} = require('../../lib/rivals-prediction-ingest');
const { matchIntelToPlayer } = require('../../lib/autoposter/identity-matcher');
const { isEligibleIntel } = require('../../lib/autoposter/autoposter-policy');
const { enrichContext } = require('../../lib/autoposter/context-enrichment');
const { rewriteIntel } = require('../../lib/autoposter/rewrite-engine');

const PREDICTION_INTEL_TEXT =
  'Rivals PM now has UF as the pick for 2026 CB Jayden Harris, confidence up from 40% to 70%.';

describe('Jayden Harris prediction_change flow', () => {
  it('detects confidence movement as prediction_change', () => {
    const row = {
      pickKey: 'pick_jayden_harris',
      playerName: 'Jayden Harris',
      playerSlug: 'jayden-harris',
      classYear: 2026,
      pos: 'CB',
      confidence: 70,
      timestamp: '2026-06-16T12:00:00.000Z'
    };
    const snapshot = {
      pickState: {
        pick_jayden_harris: { confidence: 40, timestamp: '2026-06-10T12:00:00.000Z' }
      }
    };

    const event = resolvePredictionEvent(row, snapshot);
    assert.equal(event.eventType, 'prediction_change');
    assert.equal(event.priorConfidence, 40);
    assert.equal(event.movementDelta, 30);
    assert.equal(buildPredictionChangeText(row, 40), PREDICTION_INTEL_TEXT);
  });

  it('matches intel to roster player and passes autoposter eligibility', () => {
    const intel = {
      playerName: 'Jayden Harris',
      playerSlug: 'jayden-harris',
      classYear: 2026,
      pos: 'CB',
      eventType: 'prediction_change',
      ufRelevant: true,
      source: 'rivals_pm',
      confidencePct: 70,
      priorConfidencePct: 40,
      movementDelta: 30,
      text: PREDICTION_INTEL_TEXT,
      isDuplicate: false
    };

    const player = matchIntelToPlayer(intel);
    assert.ok(player, 'expected player match');
    assert.equal(player.playerId, 'jayden-harris');
    assert.equal(isEligibleIntel(intel, player), true);
  });

  it('enriches movement context and produces GM2 prediction rewrite', async () => {
    const player = matchIntelToPlayer({
      playerName: 'Jayden Harris',
      playerSlug: 'jayden-harris',
      classYear: 2026
    });
    const intel = {
      eventType: 'prediction_change',
      confidencePct: 70,
      priorConfidencePct: 40,
      movementDelta: 30,
      predictionSchool: 'Florida Gators',
      source: 'rivals_pm',
      analystName: 'Rivals PM',
      text: PREDICTION_INTEL_TEXT
    };

    const context = enrichContext(player, intel);
    assert.equal(context.priorConfidence, 40);
    assert.equal(context.movementDelta, 30);
    assert.ok(context.ufProbability >= 70);

    const rewrite = await rewriteIntel(player, context, intel);
    assert.equal(rewrite.quality.ok, true);
    assert.match(rewrite.text, /UF/i);
    assert.match(rewrite.text, /movement|confidence|FutureCast|trending/i);
    assert.ok(rewrite.text.split(/\s+/).length >= 40);
  });
});
