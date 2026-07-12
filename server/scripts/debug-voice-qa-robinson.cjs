#!/usr/bin/env node
process.env.VOICE_PHRASE_MEMORY = 'false';
const voiceEngine = require('../lib/autoposter/voice-engine');
const qa = require('../lib/autoposter/recruiting-post-qa');
const voiceQa = require('../lib/autoposter/voice-qa');
const strategies = require('../lib/autoposter/detectives-strategies');
const detectives = require('../lib/autoposter/detectives');

const beatText =
  'NEW: Man Robinson says Florida has all three of their DB coaches texting him — and after his first visit to Gainesville, the Gators just cracked his early leaderboard.';
const identity = { playerName: 'Man Robinson', playerSlug: 'man-robinson', classYear: null, pos: null };
const hints = { beatText, metrics: {}, writerName: 'Blake Alderman', publishedAt: '2026-07-03T19:24:14.000Z' };
const platformContext = {
  hasFutureCastContext: true,
  url: 'https://gatorvaultinsider.com/vault/futurecast/player/man-robinson',
  slug: 'man-robinson'
};
const caseItem = { id: 'test', skipReason: 'strategy_data_missing' };

(async () => {
  const built = await voiceEngine.composeFromDetectiveCase({
    hints,
    identity,
    platformContext,
    research: {},
    detectiveOverride: {}
  });
  console.log('compose', { ok: built.ok, len: built.text?.length, reason: built.reason });
  const blocks = built.validationMeta?.voiceBlocks || {};
  console.log('layers', voiceQa.hasVoiceLayers(blocks));
  const marked = detectives.markDetectivesCandidate(
    {
      text: built.text,
      playerName: built.playerName,
      playerSlug: built.playerSlug,
      templateBlocks: built.templateBlocks,
      validationMeta: built.validationMeta,
      identityConfirmed: true
    },
    caseItem,
    'voice_promote',
    hints,
    platformContext
  );
  console.log('passesPublishGate', qa.passesPublishGate(marked));
  console.log('rejectReason', qa.rejectReason(marked));
  console.log('isVoiceLayered', strategies.isVoiceLayeredCandidate(marked));
  console.log('text\n', marked.text);
  if (!qa.passesPublishGate(marked)) {
    console.log(
      'gate',
      voiceQa.runQualityGate(
        { type: 'recruiting', beatText, metrics: {}, player: { name: 'Man Robinson' } },
        blocks,
        marked.text,
        marked,
        { requireFullLayers: true }
      )
    );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
