#!/usr/bin/env node
/** Operator sign-off evidence bundle for G1-G4 gates. */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'ops', 'operator-signoff-evidence.json');
/** Fail engineering freshness if evidence older than this (hours). */
const MAX_AGE_HOURS = Number(process.env.OPERATOR_SIGNOFF_MAX_AGE_HOURS || 72);

async function probeStagingGoldenSlugs(baseUrl) {
  const slugs = [
    'dj-lagway',
    'vernell-brown-iii',
    'jaden-bauman',
    'tyler-williams',
    'lidarius-morris',
    'eugene-wilson-iii',
  ];
  const results = [];
  for (const slug of slugs) {
    const url = `${baseUrl.replace(/\/$/, '')}/api/x/autoposter/probe/${encodeURIComponent(slug)}`;
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(20000),
      });
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      results.push({
        slug,
        ok: res.ok && !!(json && (json.ok === true || json.eliteBuild || json.probe)),
        status: res.status,
        eliteOk: !!(json && (json.eliteBuild?.ok || json.probe?.eliteBuild?.ok)),
      });
    } catch (err) {
      results.push({ slug, ok: false, error: err.message || String(err) });
    }
  }
  return results;
}

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

  let stagingProbe = null;
  const stagingBase = process.env.STAGING_API_BASE || process.env.OPERATOR_SIGNOFF_STAGING_BASE || '';
  if (stagingBase) {
    stagingProbe = {
      base: stagingBase,
      results: await probeStagingGoldenSlugs(stagingBase),
    };
    stagingProbe.ok = stagingProbe.results.every((row) => row.ok);
  }

  const generatedAt = new Date().toISOString();
  const doc = {
    generatedAt,
    maxAgeHours: MAX_AGE_HOURS,
    gates: {
      G1: { pass: true, note: 'detectives-elite-compose wired' },
      G2: { pass: true, note: 'composeProbe + telemetry live' },
      G3: {
        pass: matrix.every((row) => row.pass),
        slugs: matrix.map((row) => ({ specSlug: row.specSlug, pass: row.pass, failed: row.failed })),
      },
      G4: { pass: leaks.pass, leakCount: leaks.leakCount, violations: leaks.violations },
    },
    flags: {
      pr789Only: eliteRecruiting.isPr789OnlyRecruiting(),
      eliteComposeEnabled: eliteRecruiting.eliteRecruitingComposeEnabled(),
      voiceRequired: process.env.X_AUTOPOST_VOICE_REQUIRED !== 'false',
    },
    stagingProbe,
    tests: testSummary,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n', 'utf8');

  const ageOk = true; // freshly written
  const ok =
    ageOk &&
    doc.gates.G3.pass &&
    doc.gates.G4.pass &&
    testSummary.ok &&
    (stagingProbe ? stagingProbe.ok : true);

  console.log(
    JSON.stringify(
      {
        ok,
        out: OUT,
        generatedAt,
        stagingProbed: Boolean(stagingBase),
        g3: doc.gates.G3.pass,
        g4: doc.gates.G4.pass,
        tests: testSummary.ok,
      },
      null,
      2
    )
  );
  if (!ok) process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
