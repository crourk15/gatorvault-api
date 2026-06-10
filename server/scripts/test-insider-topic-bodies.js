/**
 * Verify each program topic category produces distinct article bodies.
 */
const editorial = require('../lib/insider-articles-editorial');
const engine = require('../lib/insider-articles-engine');

function bodyFingerprint(body) {
  const overview = body.match(/<h2>Overview<\/h2>\s*<p>([\s\S]*?)<\/p>/i)?.[1] || '';
  return overview.slice(0, 120);
}

(async () => {
  const signals = await engine.collectSignals();
  const topics = engine.buildCandidateTopics(signals);
  const programTopics = topics.filter((t) =>
    ['depth_chart_movement', 'summer_preview', 'roster_analysis', 'game_week_preview', 'program_pulse'].includes(
      t.category
    )
  );

  const bodies = new Map();
  for (const topic of programTopics) {
    const draft = editorial.generateDraftForTopic(topic, signals);
    if (!draft?.body) {
      console.error('FAIL: no body for', topic.category, topic.topicKey);
      process.exitCode = 1;
      continue;
    }
    bodies.set(topic.category, draft.body);
    console.log('OK:', topic.category, '→', bodyFingerprint(draft.body).replace(/\s+/g, ' ').slice(0, 80) + '…');
  }

  const fps = [...bodies.values()].map(bodyFingerprint);
  const unique = new Set(fps);
  if (unique.size !== fps.length) {
    console.error('FAIL: duplicate overview bodies across categories');
    process.exitCode = 1;
  } else {
    console.log('OK: all program topic overviews are distinct');
  }

  const portalLead = 'roster construction includes';
  const nonPulse = [...bodies.entries()].filter(([cat]) => cat !== 'program_pulse');
  for (const [cat, body] of nonPulse) {
    if (body.includes(portalLead)) {
      console.error('FAIL:', cat, 'uses Program Pulse portal boilerplate');
      process.exitCode = 1;
    }
  }
  if (!process.exitCode) console.log('OK: non–program-pulse topics avoid portal-first boilerplate');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
