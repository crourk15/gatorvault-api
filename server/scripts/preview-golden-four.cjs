#!/usr/bin/env node
/** Print full golden-four tweets for human review. */
const voiceEngine = require('../lib/autoposter/voice-engine');
const { isCompleteSentence } = require('../lib/autoposter/strategy/strategy-sentences');
const { GOLDEN_BEATS, toSignal } = require('../tests/autoposter/fixtures/golden-beats');

process.env.VOICE_PHRASE_MEMORY = 'false';

const FOUR = ['drakeford', 'robinson', 'willingham', 'ham'];

for (const id of FOUR) {
  const beat = GOLDEN_BEATS.find((b) => b.id === id);
  const signal = toSignal(beat);
  const out = voiceEngine.autoposterCompose(signal);
  console.log(`\n=== ${id.toUpperCase()} ===`);
  if (!out.ok) {
    console.log('FAILED:', out.reason, out.metadata);
    continue;
  }
  console.log(`chars: ${out.text.length}`);
  console.log(out.text);
  console.log('--- blocks ---');
  console.log('identity:', out.blocks.identity?.line);
  console.log('intel:', out.blocks.intel, '| complete:', isCompleteSentence(out.blocks.intel));
  console.log('context:', out.blocks.context, '| complete:', isCompleteSentence(out.blocks.context));
  console.log('strategy:', out.blocks.strategy, '| complete:', isCompleteSentence(out.blocks.strategy));
}
