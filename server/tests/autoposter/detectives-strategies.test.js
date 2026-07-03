/** Voice-first Detectives strategy builder */
const test = require('node:test');
const assert = require('node:assert/strict');

const strategies = require('../../lib/autoposter/detectives-strategies');
const detectives = require('../../lib/autoposter/detectives');

const ZYLEN_BEAT =
  'Zylen Little (2027 EDGE) has been on campus multiple times this spring. Florida is firmly in the mix.';

test('voiceRequiredForCase is true when promotable metrics exist', () => {
  const caseItem = { skipReason: 'needs_resolution' };
  const hints = { metrics: { rpm: 19.2 }, beatText: ZYLEN_BEAT };
  assert.equal(strategies.voiceRequiredForCase(caseItem, hints), true);
});

test('buildStrategyCandidates skips beat_driven when voice is required', async () => {
  const caseItem = {
    id: 'det_voice_only',
    skipReason: 'needs_resolution',
    beatPost: { text: ZYLEN_BEAT, writerName: 'On3', publishedAt: '2026-07-03T12:00:00.000Z' }
  };
  const hints = detectives.extractHints(caseItem);
  hints.metrics = { rpm: 19.2 };
  const identity = {
    playerName: 'Zylen Little',
    playerSlug: 'zylen-little',
    classYear: 2027,
    pos: 'EDGE'
  };
  const platformContext = {
    hasFutureCastContext: true,
    url: 'https://gatorvaultinsider.com/vault/futurecast/player/zylen-little',
    slug: 'zylen-little'
  };

  const built = await strategies.buildStrategyCandidates(
    caseItem,
    hints,
    identity,
    platformContext,
    {},
    {
      markDetectivesCandidate: detectives.markDetectivesCandidate,
      buildBeatDrivenCandidate: detectives.buildBeatDrivenCandidate,
      formatResearchContextLine: detectives.formatResearchContextLine,
      formatResearchInsiderLine: detectives.formatResearchInsiderLine
    }
  );

  assert.ok(Array.isArray(built));
  for (const cand of built) {
    assert.notEqual(cand.validationMeta?.detectivesPath, 'beat_driven');
    assert.notEqual(cand.validationMeta?.detectivesPath, 'scouting_db');
    assert.notEqual(cand.validationMeta?.detectivesPath, 'elite_research');
    assert.notEqual(cand.validationMeta?.detectivesPath, 'research_ladder');
    if (cand.validationMeta?.voiceEngine) {
      assert.equal(strategies.isVoiceLayeredCandidate(cand), true);
    }
  }
});
