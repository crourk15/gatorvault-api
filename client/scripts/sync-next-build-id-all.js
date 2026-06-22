#!/usr/bin/env node
/**
 * Sync Next.js RSC buildId in every exported HTML shell.
 * Landing had this; vault/recruiting/futurecast pages did not — causing hydration/chunk mismatches.
 */
const fs = require('fs');
const path = require('path');
const { readNextBuildId, syncBuildIdInHtml } = require('./inject-landing-export.js');

const serverDir = path.join(__dirname, '..', '..', 'server');

function walkHtml(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, out);
    else if (entry.name === 'index.html') out.push(full);
  }
  return out;
}

function syncAll() {
  const nextBuildId = readNextBuildId();
  if (!nextBuildId) {
    console.warn('[sync-next-build-id] Next buildId folder not found under _next/static');
    return { updated: 0, buildId: null };
  }

  const files = walkHtml(serverDir);
  let updated = 0;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('"buildId":"')) continue;
    const patched = syncBuildIdInHtml(html, nextBuildId);
    if (patched !== html) {
      fs.writeFileSync(file, patched);
      updated += 1;
    }
  }
  console.log(`[sync-next-build-id] buildId=${nextBuildId} synced in ${updated}/${files.length} HTML shells`);
  return { updated, buildId: nextBuildId };
}

if (require.main === module) syncAll();

module.exports = { syncAll };
