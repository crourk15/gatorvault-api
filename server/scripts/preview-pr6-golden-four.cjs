#!/usr/bin/env node
/** PR-6 shadow preview — golden four PR-5 vs PR-6 side by side. */
process.env.VOICE_PHRASE_MEMORY = 'false';
process.env.X_AUTOPOST_PR6_SHADOW = 'true';
process.env.X_AUTOPOST_PR6_ENABLED = 'false';

const voiceEngine = require('../lib/autoposter/voice-engine');
const { GOLDEN_BEATS, toSignal } = require('../tests/autoposter/fixtures/golden-beats');

const FOUR = ['drakeford', 'robinson', 'willingham', 'ham'];

for (const id of FOUR) {
  const signal = toSignal(GOLDEN_BEATS.find((b) => b.id === id));
  const out = voiceEngine.autoposterCompose(signal);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`=== ${id.toUpperCase()} ===`);
  console.log('='.repeat(60));

  if (!out.ok) {
    console.log('PR-5 FAILED:', out.reason, out.metadata);
    continue;
  }

  console.log('\n--- PR-5 (publish path) ---');
  console.log(`chars: ${out.text.length}`);
  console.log(out.text);

  const pr6 = out.metadata?.pr6Shadow;
  if (!pr6) {
    console.log('\n--- PR-6 ---');
    console.log('SHADOW: not run (X_AUTOPOST_PR6_SHADOW=false?)');
    continue;
  }

  console.log('\n--- PR-6 (shadow) ---');
  console.log(`ok: ${pr6.ok} | reason: ${pr6.reason || 'none'} | chars: ${pr6.charCount}`);
  if (pr6.rewrittenTweet) console.log(pr6.rewrittenTweet);
  if (pr6.trace?.violations?.length) {
    console.log('violations:', JSON.stringify(pr6.trace.violations, null, 2));
  }
}
