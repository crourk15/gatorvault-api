'use strict';

/**
 * Compare prod recruiting board vs locked allowlist (from local players.json truth).
 * Usage:
 *   node server/scripts/audit-prod-allowlist-board.js
 *   API_URL=https://gatorvault-api.onrender.com node server/scripts/audit-prod-allowlist-board.js --year=2027
 */
const { ALLOWLIST_2027, ALLOWLIST_2028 } = require('../lib/recruiting-target-allowlist');
const { loadPlayersJson } = require('../lib/sync-json-players-to-store');
const { isCommittedElsewhere } = require('../lib/recruiting-target-filters');
const { isPlaceholderSchool, isPlaceholderSkinny } = require('../lib/recruiting-placeholder-school');

const API_URL = (process.env.API_URL || 'https://gatorvault-api.onrender.com').replace(/\/$/, '');
const yearArg = process.argv.find((a) => a.startsWith('--year='));
const YEAR = yearArg ? parseInt(yearArg.split('=')[1], 10) : 2027;

function expectedActiveSlugs(classYear) {
  const allowlist = classYear === 2027 ? ALLOWLIST_2027 : ALLOWLIST_2028;
  const bySlug = new Map(loadPlayersJson().map((p) => [String(p.slug || '').toLowerCase(), p]));
  return allowlist.filter((slug) => {
    const p = bySlug.get(slug);
    if (!p) return false;
    if (p.category !== 'target') return false;
    if (isCommittedElsewhere(p)) return false;
    return true;
  });
}

async function fetchProdBoard(classYear) {
  const res = await fetch(`${API_URL}/api/recruiting/board?year=${classYear}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'GatorVault-Prod-Audit/1.0' },
  });
  if (!res.ok) throw new Error(`board HTTP ${res.status}`);
  const body = await res.json();
  return (body.targets || []).map((p) => String(p.slug || '').toLowerCase());
}

async function fetchProdHighPriority(classYear) {
  const res = await fetch(`${API_URL}/api/futurecast/high-priority?year=${classYear}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'GatorVault-Prod-Audit/1.0' },
  });
  if (!res.ok) throw new Error(`high-priority HTTP ${res.status}`);
  const body = await res.json();
  return (body.players || body.targets || []).map((p) => String(p.slug || '').toLowerCase());
}

async function main() {
  const expected = expectedActiveSlugs(YEAR);
  const [boardSlugs, hpSlugs] = await Promise.all([fetchProdBoard(YEAR), fetchProdHighPriority(YEAR)]);
  const boardSet = new Set(boardSlugs);
  const hpSet = new Set(hpSlugs);
  const bySlug = new Map(loadPlayersJson().map((p) => [String(p.slug || '').toLowerCase(), p]));

  const missingBoard = expected.filter((s) => !boardSet.has(s));
  const missingHp = expected.filter((s) => !hpSet.has(s));
  const quality = [];

  for (const slug of expected) {
    const local = bySlug.get(slug);
    if (isPlaceholderSchool(local?.school)) quality.push(`${slug}: placeholder school in JSON`);
    if (isPlaceholderSkinny(local?.skinny)) quality.push(`${slug}: placeholder skinny in JSON`);
  }

  console.log(`[audit-prod-board] year=${YEAR} api=${API_URL}`);
  console.log(`  expected active allowlist: ${expected.length}`);
  console.log(`  prod board targets: ${boardSlugs.length}`);
  console.log(`  prod high-priority: ${hpSlugs.length}`);

  if (missingBoard.length) {
    console.error('[audit-prod-board] MISSING from prod board:');
    missingBoard.forEach((s) => console.error('  -', s));
  }
  if (missingHp.length) {
    console.error('[audit-prod-board] MISSING from prod high-priority:');
    missingHp.forEach((s) => console.error('  -', s));
  }
  if (quality.length) {
    console.warn('[audit-prod-board] JSON quality flags:');
    quality.forEach((q) => console.warn('  -', q));
  }

  const ok = !missingBoard.length && !missingHp.length && !quality.length;
  if (ok) {
    console.log('[audit-prod-board] OK');
    return;
  }

  if (!missingBoard.length && !missingHp.length) {
    console.log('[audit-prod-board] OK (board sync); fix JSON quality before prod sync');
    process.exit(quality.length ? 1 : 0);
  }

  console.error('[audit-prod-board] FAIL — run:');
  console.error('  npm run sync:recruiting:2027-board');
  process.exit(1);
}

main().catch((err) => {
  console.error('[audit-prod-board] error:', err.message);
  process.exit(1);
});
