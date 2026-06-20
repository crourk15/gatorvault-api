#!/usr/bin/env node
/**
 * Integrity checks for recruiting intel JSON stores.
 * Exit 0 when clean; exit 1 with actionable errors when not.
 */
const fs = require('fs');
const path = require('path');
const { isBlockedRecruit } = require('../lib/recruiting-blocked-players');
const {
  HUB_CLASS_YEARS,
  validateVerifiedCommits,
  countVerifiedHubCommits,
} = require('../lib/recruiting-verified-commits');
const { validateStoreTargets } = require('../lib/recruiting-target-allowlist');

const DATA_DIR = path.join(__dirname, '..', 'data', 'recruiting');
const STALE_EVENT_MS = 120 * 24 * 60 * 60 * 1000;

const REQUIRED_PLAYER_FIELDS = ['slug', 'name', 'classYear', 'pos', 'category'];

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return { __parseError: err.message, __fallback: fallback };
  }
}

function assertJson(filePath, data, errors) {
  if (data && data.__parseError) {
    errors.push({ file: path.basename(filePath), reason: 'malformed_json', detail: data.__parseError });
    return data.__fallback;
  }
  return data;
}

function checkPlayerFields(players, errors) {
  for (const p of players || []) {
    const missing = REQUIRED_PLAYER_FIELDS.filter((f) => p[f] == null || p[f] === '');
    if (missing.length) {
      errors.push({
        file: 'players.json',
        slug: p.slug || p.name,
        reason: 'missing_required_fields',
        detail: missing.join(', '),
      });
    }
  }
}

function checkHubClassYears(players, errors) {
  for (const p of players || []) {
    const year = Number(p.classYear);
    if (!HUB_CLASS_YEARS.has(year)) {
      errors.push({
        file: 'players.json',
        slug: p.slug,
        reason: 'invalid_hub_class_year',
        detail: String(p.classYear),
      });
    }
    if (year === 2026) {
      errors.push({
        file: 'players.json',
        slug: p.slug,
        reason: 'stale_2026_player_in_hub_pool',
      });
    }
  }
}

function checkPortalInRecruitingPool(players, errors) {
  for (const p of players || []) {
    const cat = String(p.category || '').toLowerCase();
    const lc = String(p.lifecycle || '').toUpperCase();
    if (cat === 'portal' || lc === 'PORTAL' || lc === 'ROSTER') {
      errors.push({
        file: 'players.json',
        slug: p.slug,
        reason: 'portal_or_roster_in_recruiting_pool',
        detail: `${cat}/${lc}`,
      });
    }
    if (String(p.status || '').toLowerCase() === 'enrolled') {
      errors.push({
        file: 'players.json',
        slug: p.slug,
        reason: 'enrolled_in_recruiting_pool',
      });
    }
  }
}

function checkBlockedPlayers(players, errors) {
  for (const p of players || []) {
    if (isBlockedRecruit(p)) {
      errors.push({
        file: 'players.json',
        slug: p.slug,
        reason: 'blocked_player_present',
      });
    }
  }
}

function checkStaleEvents(events, playerSlugs, errors) {
  const now = Date.now();
  for (const evt of events || []) {
    const slug = String(evt.playerSlug || evt.playerId || '').toLowerCase();
    const eventType = String(evt.eventType || '').toLowerCase();
    if (slug && !playerSlugs.has(slug) && eventType !== 'ranking_change' && slug !== 'class-2027') {
      errors.push({
        file: 'events.json',
        id: evt.id,
        reason: 'orphan_event_player',
        detail: slug,
      });
    }
    const ts = new Date(evt.createdAt || evt.timestamp || 0).getTime();
    if (Number.isFinite(ts) && now - ts > STALE_EVENT_MS) {
      errors.push({
        file: 'events.json',
        id: evt.id,
        reason: 'stale_event',
        detail: evt.createdAt || evt.timestamp,
      });
    }
    if (!evt.eventType && !evt.title) {
      errors.push({
        file: 'events.json',
        id: evt.id,
        reason: 'missing_event_type_or_title',
      });
    }
  }
}

function checkIntelItems(intelDoc, playerSlugs, errors) {
  for (const row of intelDoc.items || []) {
    const slug = String(row.playerSlug || row.player_slug || '').toLowerCase();
    if (!slug) {
      errors.push({ file: 'intel.json', id: row.id, reason: 'intel_missing_player_slug' });
      continue;
    }
    if (!playerSlugs.has(slug)) {
      errors.push({ file: 'intel.json', id: row.id, reason: 'orphan_intel_player', detail: slug });
    }
    const year = Number(row.classYear);
    if (year && !HUB_CLASS_YEARS.has(year)) {
      errors.push({ file: 'intel.json', id: row.id, reason: 'intel_invalid_class_year', detail: year });
    }
    if (!row.detail && !row.status && !row.eventType) {
      errors.push({ file: 'intel.json', id: row.id, reason: 'intel_missing_content' });
    }
    if (/placeholder|lorem ipsum|fake intel|synthetic/i.test(String(row.detail || row.status || ''))) {
      errors.push({ file: 'intel.json', id: row.id, reason: 'placeholder_intel_text' });
    }
  }
}

function main() {
  const errors = [];
  const playersPath = path.join(DATA_DIR, 'players.json');
  const eventsPath = path.join(DATA_DIR, 'events.json');
  const intelPath = path.join(DATA_DIR, 'intel.json');

  const players = assertJson(playersPath, readJson(playersPath, []), errors);
  const events = assertJson(eventsPath, readJson(eventsPath, []), errors);
  const intelDoc = assertJson(intelPath, readJson(intelPath, { version: 1, items: [] }), errors);

  if (!Array.isArray(players)) {
    errors.push({ file: 'players.json', reason: 'expected_array' });
    report(errors);
    return;
  }

  checkPlayerFields(players, errors);
  checkHubClassYears(players, errors);
  checkPortalInRecruitingPool(players, errors);
  checkBlockedPlayers(players, errors);

  for (const row of validateVerifiedCommits(players)) {
    errors.push({ file: 'players.json', ...row });
  }

  for (const row of validateStoreTargets(players)) {
    errors.push({ file: 'players.json', ...row });
  }

  const playerSlugs = new Set(players.map((p) => String(p.slug || '').toLowerCase()).filter(Boolean));
  checkStaleEvents(events, playerSlugs, errors);
  checkIntelItems(intelDoc, playerSlugs, errors);

  const uf2027 = countVerifiedHubCommits(players, 2027);
  console.log('[validate-intel-store] players:', players.length);
  console.log('[validate-intel-store] events:', (events || []).length);
  console.log('[validate-intel-store] intel items:', (intelDoc.items || []).length);
  console.log('[validate-intel-store] 2027 verified UF commits:', uf2027);

  if (uf2027 !== 3) {
    errors.push({
      file: 'players.json',
      reason: 'wrong_2027_commit_count',
      detail: `expected 3, got ${uf2027}`,
    });
  }

  report(errors);
}

function report(errors) {
  if (!errors.length) {
    console.log('[validate-intel-store] OK — all checks passed');
    process.exit(0);
  }
  console.error('[validate-intel-store] FAILED —', errors.length, 'issue(s):');
  for (const err of errors.slice(0, 40)) {
    console.error(' -', JSON.stringify(err));
  }
  if (errors.length > 40) {
    console.error(` ... and ${errors.length - 40} more`);
  }
  process.exit(1);
}

main();
