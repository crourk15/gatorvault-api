const test = require('node:test');
const assert = require('node:assert/strict');

const telemetry = require('../../lib/autoposter/detectives-telemetry');
const composeObs = require('../../lib/autoposter/compose-observability');
const { logComposeSkip } = require('../../lib/autoposter/compose-skip-log');

test('buildDetectivesTelemetry shapes G2 payload', () => {
  const row = telemetry.buildDetectivesTelemetry({
    ok: false,
    phase: 'elite_compose_miss',
    caseId: 'det_test',
    playerSlug: 'cale-britt',
    lastReason: 'thin_fallback',
    enrichPassesTried: ['trigger_beat', 'full_enrich'],
    gaps: ['missing_quote']
  });
  assert.equal(row.subsystem, 'autoposter:detectives');
  assert.equal(row.details.phase, 'elite_compose_miss');
  assert.equal(row.details.playerSlug, 'cale-britt');
  assert.deepEqual(row.details.enrichPassesTried, ['trigger_beat', 'full_enrich']);
});

test('deriveComposeRouting maps elite and gap outcomes', () => {
  assert.equal(composeObs.deriveComposeRouting({ eliteBuild: { ok: true }, publishGate: true }), 'elite');
  assert.equal(
    composeObs.deriveComposeRouting({ eliteBuild: { ok: false, reason: 'elite_enrich_exhausted' }, publishGate: false }),
    'archived_with_gaps'
  );
  assert.equal(composeObs.deriveComposeRouting({ eliteBuild: { ok: true }, publishGate: false }), 'qa_blocked');
});

test('listComposeFailureReport returns skip log entries', async () => {
  logComposeSkip({
    slug: 'probe-test-slug',
    reason: 'elite_enrich_exhausted',
    lastReason: 'recruiting_qa',
    enrichPassesTried: ['visit_metrics'],
    gaps: ['thin_beat']
  });
  const report = await composeObs.listComposeFailureReport({ slug: 'probe-test-slug', limit: 5 });
  assert.equal(report.ok, true);
  assert.ok(Array.isArray(report.entries));
  assert.ok(report.entries.some((e) => e.slug === 'probe-test-slug'));
});