/** Detectives PR2 metrics repair tests */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const metrics = require('../../lib/autoposter/detectives-metrics');

test('metricsGaps detects missing rpm, visit, comp', () => {
  assert.deepEqual(metrics.metricsGaps({}), ['no_rpm', 'no_visit', 'no_comp']);
  assert.deepEqual(metrics.metricsGaps({ rpm: 62, visitDate: '2026-08-12', compSchools: ['FSU'] }), []);
});

test('persistMetricsRepair writes hints.metrics and repairActions', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'det-metrics-'));
  process.env.X_AUTOPOST_DETECTIVES_DATA_DIR = dir;
  const storePath = require.resolve('../../lib/autoposter/detectives-store');
  const metricsPath = require.resolve('../../lib/autoposter/detectives-metrics');
  delete require.cache[storePath];
  delete require.cache[metricsPath];
  const store = require(storePath);
  const metricsMod = require(metricsPath);

  try {
    const added = store.addCase({
      skipReason: 'strategy_data_missing',
      beatPost: { text: 'Florida RPM pick for Raheem Floyd.' },
      hints: { playerSlug: 'raheem-floyd' }
    });
    const pack = {
      metrics: { rpm: 62, visitDate: '2026-08-12', compSchools: ['FSU', 'Miami'] },
      repairActions: [metricsMod.buildRepairAction('pull_board_rpm', true, '62')],
      gapsBefore: ['no_rpm', 'no_visit', 'no_comp'],
      gapsAfter: [],
      gapsFilled: ['no_rpm', 'no_visit', 'no_comp']
    };
    metricsMod.persistMetricsRepair(added.case.id, pack);
    const row = store.getCase(added.case.id);
    assert.equal(row.hints.metrics.rpm, 62);
    assert.equal(row.repairActions.length, 1);
    assert.equal(row.investigationLog.at(-1).phase, 'repair');
  } finally {
    delete process.env.X_AUTOPOST_DETECTIVES_DATA_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('enrichCaseMetrics fills rpm from identity ufRpmPct', async () => {
  const pack = await metrics.enrichCaseMetrics({
    caseItem: { id: 'det_test' },
    hints: { beatText: 'Raheem Floyd RPM pick for Florida.', playerSlug: 'raheem-floyd' },
    identity: { playerName: 'Raheem Floyd', playerSlug: 'raheem-floyd', ufRpmPct: 58 },
    platformContext: { slug: 'raheem-floyd', player: { ufRpmPct: 58 }, intelRows: [] }
  });
  assert.equal(pack.metrics.rpm, 58);
  assert.ok(pack.repairActions.some((a) => a.action === 'pull_board_rpm' && a.success));
});
