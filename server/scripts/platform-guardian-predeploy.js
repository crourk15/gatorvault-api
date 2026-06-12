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

async function main() {
  const jsonOut = process.argv.includes('--json');
  const wiring = verifyPlatformWiring({ simulate: true });
  const blueprints = verifyBlueprints({ criticalOnly: true });
  const ok = wiring.ok && blueprints.ok;
  const errors = [...wiring.errors, ...blueprints.errors];

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
    if (errors.length) {
      for (const err of errors) console.error('  ✗', err);
    } else {
      console.log('  ✓ require paths, exports, HTML hooks, CSS tokens, JSON schemas');
    }
  }

  if (!ok) {
    const headline = errors[0] || 'platform guardian failed';
    if (process.env.GUARDIAN_ALERT_ON_CI === 'true') {
      await alertGuardian({
        type: 'predeploy_blocked',
        severity: 'critical',
        title: 'Deploy blocked',
        message: headline,
        meta: { errors: errors.slice(0, 10), source: 'platform-guardian-predeploy' }
      });
    }
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[guardian] platform-guardian-predeploy failed:', err.message);
  process.exit(1);
});
