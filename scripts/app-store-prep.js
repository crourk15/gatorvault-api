#!/usr/bin/env node
/** Orchestrate App Store Connect prep checks (no Apple login required). */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'app-store');
const OUT_JSON = path.join(OUT_DIR, 'prep-report.json');

function runStep(name, scriptRel, { optional = false, skipReason = null } = {}) {
  if (skipReason) {
    return { name, status: 'SKIP', message: skipReason };
  }
  const script = path.join(ROOT, scriptRel.replace(/\//g, path.sep));
  const started = Date.now();
  const proc = spawnSync(process.execPath, [script], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  const output = `${proc.stdout || ''}${proc.stderr || ''}`.trim();
  let ok = proc.status === 0;
  if (!ok && optional && output.includes('"fail": 0')) {
    ok = true;
  }
  if (ok) {
    return { name, status: 'PASS', message: `ok (${Date.now() - started}ms)`, output: output.slice(0, 2000) };
  }
  if (optional) {
    return { name, status: 'WARN', message: `exit ${proc.status}`, output: output.slice(0, 2000) };
  }
  return { name, status: 'FAIL', message: `exit ${proc.status}`, output: output.slice(0, 2000) };
}

function main() {
  const steps = [
    runStep('ios-iap-wiring', 'client/scripts/verify-ios-iap-wiring.js'),
    runStep('screenshots', 'scripts/verify-app-store-screenshots.js'),
    runStep('aasa', 'server/scripts/verify-aasa.js', { optional: true }),
  ];

  if (process.env.APP_REVIEW_PASSWORD) {
    steps.push(runStep('smoke', 'scripts/app-store-smoke.js', { optional: true }));
  } else {
    steps.push(runStep('smoke', 'scripts/app-store-smoke.js', { skipReason: 'APP_REVIEW_PASSWORD not set' }));
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    pass: steps.filter((s) => s.status === 'PASS').length,
    fail: steps.filter((s) => s.status === 'FAIL').length,
    warn: steps.filter((s) => s.status === 'WARN').length,
    skip: steps.filter((s) => s.status === 'SKIP').length,
    steps,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.fail > 0 ? 1 : 0);
}

main();
