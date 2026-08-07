#!/usr/bin/env node
/**
 * Child-process warm for Starter: build hub bundle / FutureCast HP and write to disk.
 * Parent API process stays alive if this worker OOMs.
 *
 * Usage:
 *   node scripts/spaced-elite-warm-worker.js --job=bundle --year=2028
 *   node scripts/spaced-elite-warm-worker.js --job=hp --year=2028
 */
'use strict';

const fs = require('fs');
const path = require('path');

function arg(name, fallback) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value), 'utf8');
}

async function warmBundle(year) {
  process.env.HUB_BUNDLE_SEQUENTIAL = process.env.HUB_BUNDLE_SEQUENTIAL || 'true';
  const { resolveRecruitingDataDir } = require('../lib/recruiting-data-dir');
  const elite = require('../lib/recruiting-hub-elite');
  const value = await elite.buildHubBundle(year);
  const filePath = path.join(resolveRecruitingDataDir(), 'hub-runtime', String(year), 'bundle.json');
  const doc = {
    ok: true,
    status: 'ready',
    meta: {
      generatedAt: new Date().toISOString(),
      snapshot: true,
      endpoint: 'bundle',
      year,
      source: 'spaced-elite-warm-worker',
    },
    ...value,
  };
  writeJson(filePath, doc);
  return { ok: true, job: 'bundle', year, filePath, bytes: Buffer.byteLength(JSON.stringify(doc)) };
}

async function warmHp(year) {
  const { resolveRecruitingDataDir } = require('../lib/recruiting-data-dir');
  const { buildHighPriorityPayload } = require('../api/futurecast/high-priority.ts');
  const value = await buildHighPriorityPayload(year);
  const filePath = path.join(
    resolveRecruitingDataDir(),
    'futurecast-runtime',
    `high-priority-${year}.json`
  );
  writeJson(filePath, value);
  return { ok: true, job: 'hp', year, filePath, bytes: Buffer.byteLength(JSON.stringify(value)) };
}

(async () => {
  const job = String(arg('job', '')).toLowerCase();
  const year = parseInt(arg('year', '2028'), 10);
  if (!Number.isFinite(year)) {
    console.error(JSON.stringify({ ok: false, error: 'bad year' }));
    process.exit(2);
  }
  try {
    let result;
    if (job === 'bundle') result = await warmBundle(year);
    else if (job === 'hp' || job === 'high-priority') result = await warmHp(year);
    else {
      console.error(JSON.stringify({ ok: false, error: `unknown job ${job}` }));
      process.exit(2);
    }
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (err) {
    console.error(JSON.stringify({ ok: false, job, year, error: err.message || String(err) }));
    process.exit(1);
  }
})();
