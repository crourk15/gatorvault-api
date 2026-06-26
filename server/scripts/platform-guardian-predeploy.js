#!/usr/bin/env node
/**
 * Platform Guardian — pre-deploy gate (Self-Runner 3.0).
 * Blocks bad wiring, blueprint drift, and schema violations before Render deploy.
 *
 * Usage (from server/):
 *   node scripts/platform-guardian-predeploy.js
 *   node scripts/platform-guardian-predeploy.js --json
 */
const { verifyPlatformWiring } = require('../lib/guardian/platform-wiring');
const { verifyBlueprints } = require('../lib/guardian/blueprint-validator');
const { alertGuardian } = require('../lib/guardian/guardian-alerts');
const fs = require('node:fs');
const path = require('node:path');

function runVerifyServerModules() {
  const root = path.join(__dirname, '..');
  const modules = [
    'lib/visit-intel-utils.js',
    'lib/uf-probability-utils.js',
    'lib/flip-watch-utils.js',
    'lib/x-autoposter-visit-guard.js',
    'lib/push-alert-service.js',
    'lib/push-alert-routes.js',
    'lib/push-subscription-persistence.js',
    'lib/push-alert-filters.js',
    'lib/staff-note-picker.js',
    'lib/alert-email-persistence.js',
    'lib/alert-email-prefs-service.js',
    'lib/visit-intel-email-digest.js',
    'lib/movement-narrative.js',
    'lib/uf-trend-snapshot.js',
    'lib/uf-trend-snapshot-build.js',
  ];
  const errors = [];
  for (const rel of modules) {
    const file = path.join(root, rel);
    try {
      const buf = fs.readFileSync(file);
      if (buf[0] === 0xff && buf[1] === 0xfe) {
        throw new Error('UTF-16 LE encoding detected');
      }
      if (buf.includes(0)) {
        throw new Error('NUL bytes detected — likely UTF-16');
      }
      require(file);
    } catch (err) {
      errors.push(`${rel}: ${err.message}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

async function runSmokeChecks() {
  const errors = [];
  const { runVerifyVisitIntelApi } = require('./verify-visit-intel-api');
  const visitIntel = runVerifyVisitIntelApi();
  if (!visitIntel.ok) errors.push('visit-intel-api smoke failed');

  const { runVerifyAutoposterGuard } = require('./verify-autoposter-guard');
  const autoposter = runVerifyAutoposterGuard();
  if (!autoposter.ok) errors.push('autoposter-guard smoke failed');

  const { runEncodingCheck } = require('./encoding-check');
  const encoding = runEncodingCheck();
  if (!encoding.ok) errors.push(...encoding.errors.map((e) => `encoding: ${e}`));

  const modules = runVerifyServerModules();
  if (!modules.ok) errors.push(...modules.errors);
  return errors;
}

async function main() {
  const jsonOut = process.argv.includes('--json');
  const wiring = verifyPlatformWiring({ simulate: true });
  const blueprints = verifyBlueprints({ criticalOnly: true });
  const smokeErrors = await runSmokeChecks();
  const ok = wiring.ok && blueprints.ok && smokeErrors.length === 0;
  const errors = [...wiring.errors, ...blueprints.errors, ...smokeErrors];

  const result = {
    ok,
    wiring,
    blueprints,
    errors,
    checkedAt: new Date().toISOString()
  };

  if (jsonOut) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('[guardian] Pre-deploy check —', ok ? 'PASS' : 'FAIL');
    console.log('  Wiring:', wiring.ok ? 'OK' : `${wiring.errors.length} error(s)`);
    console.log(
      '  Blueprints:',
      blueprints.ok ? 'OK' : `${blueprints.errors.length} error(s)`
    );
    console.log('  Smoke:', smokeErrors.length ? `${smokeErrors.length} error(s)` : 'OK');
    if (errors.length) {
      for (const err of errors) console.error('  ✗', err);
    } else {
      console.log('  ✓ require paths, exports, HTML hooks, CSS tokens, JSON schemas');
    }
  }

  if (!ok) {
    const headline = errors[0] || 'platform guardian failed';
    try {
      require('../lib/deploy-monitor').recordGuardianCheck({
        ok: false,
        phase: 'pre',
        errors,
        checkedAt: result.checkedAt
      });
    } catch {
      /* optional */
    }
    if (process.env.GUARDIAN_ALERT_ON_CI === 'true') {
      await alertGuardian({
        type: 'predeploy_blocked',
        severity: 'critical',
        title: 'Deploy blocked',
        message: headline,
        meta: { errors: errors.slice(0, 10), source: 'platform-guardian-predeploy' }
      });
    }
    if (process.env.GUARDIAN_BOOT_LENIENT === 'true') {
      console.warn('[guardian] GUARDIAN_BOOT_LENIENT=true — continuing despite pre-deploy FAIL');
      process.exit(0);
    }
    process.exit(1);
  }
  try {
    require('../lib/deploy-monitor').recordGuardianCheck({
      ok: true,
      phase: 'pre',
      errors: [],
      checkedAt: result.checkedAt
    });
  } catch {
    /* optional */
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[guardian] platform-guardian-predeploy failed:', err.message);
  process.exit(1);
});
