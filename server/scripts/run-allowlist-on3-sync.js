#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { syncAllowlistTargetsFromOn3 } = require('../lib/allowlist-target-sync');

function parseArg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const raw = hit.split('=')[1];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : raw;
}

async function main() {
  const classYear = parseArg('class-year', 2028);
  const limit = parseArg('limit', 0);
  const result = await syncAllowlistTargetsFromOn3({
    classYear: Number(classYear),
    limit: Number(limit) || undefined,
  });
  console.log(JSON.stringify({ ok: true, classYear, limit: limit || null, result }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
