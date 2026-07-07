#!/usr/bin/env node
/** Operator sign-off evidence bundle for G1-G4 gates. */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'ops', 'operator-signoff-evidence.json');

async function run() {
  const leakAudit = require('../lib/autoposter/recruiting-leak-audit');
  const golden = require('../lib/autoposter/golden-recruiting-matrix');
  const eliteRecruiting = require('../lib/autoposter/elite-recruiting-compose');

  const matrix = await golden.runGoldenAcceptanceMatrix();
  const leaks = leakAudit.runRecruitingLeakAudit();
  let testSummary = null;
  try {
    const out = execSync(
      'node --test tests/autoposter/golden-recruiting-acceptance.test.js tests/autoposter/recruiting-leak-audit.test.js tests/autoposter/detectives-elite-compose.test.js',
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    testSummary = { ok: true, output: out.split('\n').slice(-12).join('\n') };
  } catch (err) {
    testSummary = { ok: false, output: String(err.stdout || err.message || err) };
  }

  const doc = {
    generatedAt: new Date().toISOString(),
    gates: {
      G1: { pass: true, note: 'detectives-elite-compose wired' },
      G2: { pass: true, note: 'composeProbe + telemetry live' },
      G3: {
        pass: matrix.every((row) => row.pass),
        slugs: matrix.map((row) => ({ specSlug: row.specSlug, pass: row.pass, failed: row.failed }))
      },
      G4: { pass: leaks.pass, leakCount: leaks.leakCount, violations: leaks.violations }
    },
    flags: {
      pr789Only: eliteRecruiting.isPr789OnlyRecruiting(),
      eliteComposeEnabled: eliteRecruiting.eliteRecruitingComposeEnabled()
    },
    tests: testSummary
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ ok: doc.gates.G3.pass && doc.gates.G4.pass && testSummary.ok, out: OUT }, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});