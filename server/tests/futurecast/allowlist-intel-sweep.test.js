const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('Allowlist continuous intel sweep', () => {
  it('exports sweep + coverage helpers', () => {
    const mod = require('../../lib/allowlist-intel-sweep');
    assert.equal(typeof mod.runAllowlistIntelSweep, 'function');
    assert.equal(typeof mod.measureAllowlistIntelCoverage, 'function');
  });

  it('is wired into recruiting-light cron + ops jobs + API route', () => {
    const cron = fs.readFileSync(
      path.join(__dirname, '..', '..', 'scripts', 'render-recruiting-light-cron.js'),
      'utf8'
    );
    assert.match(cron, /allowlist-intel\/sweep/);
    const ops = fs.readFileSync(path.join(__dirname, '..', '..', 'lib', 'ops-jobs.js'), 'utf8');
    assert.match(ops, /allowlist-intel-sweep/);
    const routes = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'recruiting-routes.js'),
      'utf8'
    );
    assert.match(routes, /allowlist-intel\/sweep/);
  });

  it('dry-run sweep reports targets without requiring network', async () => {
    const { runAllowlistIntelSweep } = require('../../lib/allowlist-intel-sweep');
    const result = await runAllowlistIntelSweep({ classYear: 2028, dryRun: true, maxCreates: 20 });
    assert.equal(result.ok, true);
    assert.ok(result.targetCount >= 20);
    assert.ok(result.coverage && typeof result.coverage.coveragePct === 'number');
  });

  it('chase scores intel family breadth, not only raw volume', () => {
    const { intelSourceFamily } = require('../../lib/uf-chase-score');
    assert.equal(intelSourceFamily('auto:allowlist-intel-sweep', 'visit'), 'visit');
    assert.equal(intelSourceFamily('auto:allowlist-intel-sweep', 'offer'), 'offer');
    assert.equal(intelSourceFamily('auto:beat-writer', 'beat'), 'beat');
  });
});
