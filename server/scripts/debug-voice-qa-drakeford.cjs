#!/usr/bin/env node
process.env.VOICE_PHRASE_MEMORY = 'false';
const voiceEngine = require('../lib/autoposter/voice-engine');
const qa = require('../lib/autoposter/recruiting-post-qa');
const voiceQa = require('../lib/autoposter/voice-qa');
const strategies = require('../lib/autoposter/detectives-strategies');
const detectives = require('../lib/autoposter/detectives');

const beatText =
  'NEW: Florida made a big impression on 2028 safety Ryan Drakeford during his first trip to The Swamp. Florida is one of those schools at the top of my board.';
const identity = { playerName: 'Ryan Drakeford', playerSlug: 'ryan-drakeford', classYear: 2028, pos: 'S' };
const hints = { beatText, metrics: {}, writerName: 'Blake Alderman', publishedAt: '2026-07-03T20:15:13.000Z' };
const platformContext = {
  hasFutureCastContext: true,
  url: 'https://gatorvaultinsider.com/vault/futurecast/player/ryan-drakeford',
  slug: 'ryan-drakeford'
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
  console.log('layers', voiceQa.hasVoiceLayers(blocks), {
    ctx: String(blocks.context || '').length,
    strat: String(blocks.strategy || '').length,
    hook: String(blocks.hook || '').length,
    cta: String(blocks.cta || '').length,
    strategy: blocks.strategy,
    cta: blocks.cta
  });
  const raw = {
    text: built.text,
    playerName: built.playerName,
    playerSlug: built.playerSlug,
    templateBlocks: built.templateBlocks,
    validationMeta: built.validationMeta,
    identityConfirmed: true
  };
  const marked = detectives.markDetectivesCandidate(raw, caseItem, 'voice_promote', hints, platformContext);
  console.log('passesPublishGate', qa.passesPublishGate(marked));
  console.log('rejectReason', qa.rejectReason(marked));
  console.log('isVoiceLayered', strategies.isVoiceLayeredCandidate(marked));
  console.log('text\n', marked.text);
  console.log('hasPlayerUrl', /futurecast\/player\//i.test(marked.text));
  if (!qa.passesPublishGate(marked)) {
    const gate = voiceQa.runQualityGate(
      { type: 'recruiting', beatText, metrics: {}, player: { name: 'Ryan Drakeford' } },
      blocks,
      marked.text,
      marked,
      { requireFullLayers: true }
    );
    console.log('gate', gate);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
