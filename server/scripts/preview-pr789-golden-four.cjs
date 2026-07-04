#!/usr/bin/env node
/** PR-6 vs PR-6+7/8/9 shadow preview — golden four. */
process.env.VOICE_PHRASE_MEMORY = 'false';
process.env.X_AUTOPOST_PR6_SHADOW = 'true';
process.env.X_AUTOPOST_PR6_ENABLED = 'false';
process.env.X_AUTOPOST_PR7_8_9_SHADOW = 'true';
process.env.X_AUTOPOST_PR7_8_9_ENABLED = 'false';

const voiceEngine = require('../lib/autoposter/voice-engine');
const { GOLDEN_BEATS, toSignal } = require('../tests/autoposter/fixtures/golden-beats');

const FOUR = ['drakeford', 'robinson', 'willingham', 'ham'];

for (const id of FOUR) {
  const signal = toSignal(GOLDEN_BEATS.find((b) => b.id === id));
  const out = voiceEngine.autoposterCompose(signal);

  console.log(`\n${'='.repeat(64)}`);
  console.log(`=== ${id.toUpperCase()} ===`);
  console.log('='.repeat(64));

  if (!out.ok) {
    console.log('PR-5 FAILED:', out.reason);
    continue;
  }

  console.log('\n--- PR-5 (publish) ---');
  console.log(`(${out.text.length} chars)`);
  console.log(out.text);

  const pr6 = out.metadata?.pr6Shadow;
  console.log('\n--- PR-6 (shadow) ---');
  if (pr6?.rewrittenTweet) {
    console.log(`ok: ${pr6.ok} | (${pr6.charCount} chars)`);
    console.log(pr6.rewrittenTweet);
  }

  const pr789 = out.metadata?.pr789Shadow;
  console.log('\n--- PR-6+7/8/9 (shadow) ---');
  if (pr789) {
    console.log(`ok: ${pr789.ok} | fallback: ${pr789.fallback} | (${pr789.charCount} chars)`);
    console.log(pr789.rewrittenTweet);
    if (!pr789.ok && pr789.violations?.length) {
      console.log('violations:', pr789.violations.map((v) => v.type).join(', '));
    }
  }
}
