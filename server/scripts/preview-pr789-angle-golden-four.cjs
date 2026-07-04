#!/usr/bin/env node
/** PR-789 dominant angle shadow — golden four vs live PR-789. */
process.env.VOICE_PHRASE_MEMORY = 'false';
process.env.X_AUTOPOST_PR6_SHADOW = 'true';
process.env.X_AUTOPOST_PR6_ENABLED = 'true';
process.env.X_AUTOPOST_PR7_8_9_SHADOW = 'true';
process.env.X_AUTOPOST_PR7_8_9_ENABLED = 'true';
process.env.X_AUTOPOST_PR789_ANGLE_SHADOW = 'true';
process.env.X_AUTOPOST_PR789_ANGLE_ENABLED = 'false';

const voiceEngine = require('../lib/autoposter/voice-engine');
const { GOLDEN_BEATS, toSignal } = require('../tests/autoposter/fixtures/golden-beats');

const FOUR = ['drakeford', 'robinson', 'willingham', 'ham'];

for (const id of FOUR) {
  const signal = toSignal(GOLDEN_BEATS.find((b) => b.id === id));
  signal.playerSlug = id;
  const out = voiceEngine.autoposterCompose(signal);
  console.log('\n================================================================');
  console.log('===', id.toUpperCase(), '===');
  console.log('================================================================\n');
  if (!out.ok) {
    console.log('COMPOSE FAILED:', out.reason);
    continue;
  }
  console.log('--- LIVE (PR-789) ---');
  console.log('(' + out.text.length + ' chars)');
  console.log(out.text);
  const angle = out.metadata?.pr789AngleShadow;
  console.log('\n--- DOMINANT ANGLE (shadow) ---');
  if (!angle) {
    console.log('no pr789AngleShadow');
    continue;
  }
  console.log('ok:', angle.ok, '| angle:', angle.dominantAngle, '| fallback:', angle.fallback);
  if (angle.rewrittenTweet) {
    console.log('(' + angle.charCount + ' chars)');
    console.log(angle.rewrittenTweet);
    if (angle.takeaway) console.log('\ntakeaway:', angle.takeaway);
  } else if (angle.reason) {
    console.log('reason:', angle.reason);
  }
}
