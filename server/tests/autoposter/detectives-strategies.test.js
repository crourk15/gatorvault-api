/** Voice-first Detectives strategy builder */
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.X_AUTOPOST_PR789_ONLY_RECRUITING = 'false';
process.env.X_AUTOPOST_ELITE_MODE = 'false';
process.env.X_AUTOPOST_ELITE_RECRUITING_COMPOSE = 'false';

const strategies = require('../../lib/autoposter/detectives-strategies');
const detectives = require('../../lib/autoposter/detectives');

const ZYLEN_BEAT =
  'Zylen Little (2027 EDGE) has been on campus multiple times this spring. Florida is firmly in the mix.';

test('voiceRequiredForCase is true when promotable metrics exist', () => {
  const caseItem = { skipReason: 'needs_resolution' };
  const hints = { metrics: { rpm: 19.2 }, beatText: ZYLEN_BEAT };
  assert.equal(strategies.voiceRequiredForCase(caseItem, hints), true);
});

test('voiceRequiredForCase is true for quality_gate handoffs', () => {
  const caseItem = { skipReason: 'quality_gate' };
  const hints = { beatText: ZYLEN_BEAT, metrics: {} };
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

test('buildStrategyCandidates keeps voice promote after phrase memory records hook', async () => {
  process.env.VOICE_PHRASE_MEMORY = 'true';
  const phraseMemory = require('../../lib/autoposter/voice-phrase-memory');
  phraseMemory.recordHook('Circle this one.');

  const caseItem = {
    id: 'det_phrase_mem',
    skipReason: 'strategy_data_missing',
    beatPost: {
      text: 'NEW: Florida made a big impression on 2028 safety Ryan Drakeford during his first trip to The Swamp.',
      writerName: 'On3',
      publishedAt: '2026-07-03T12:00:00.000Z'
    }
  };
  const hints = detectives.extractHints(caseItem);
  const identity = {
    playerName: 'Ryan Drakeford',
    playerSlug: 'ryan-drakeford',
    classYear: 2028,
    pos: 'S'
  };
  const platformContext = {
    hasFutureCastContext: true,
    url: 'https://gatorvaultinsider.com/vault/futurecast/player/ryan-drakeford',
    slug: 'ryan-drakeford'
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

  assert.ok(built.length >= 1, 'expected at least one voice strategy after compose');
  assert.ok(built.some((c) => c.validationMeta?.detectivesPath === 'voice_promote'));
});
