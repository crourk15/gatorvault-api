#!/usr/bin/env node
/**
 * Enrich Class of 2029 early targets from On3/Rivals:
 * - ranks / stars / position / school / rating on existing slugs
 * - add missing Florida Top 100 names as early targets
 * - refresh younger-prospects-soft.json for Lab Names to know
 *
 *   ON3_HTML_FALLBACK=true node server/scripts/enrich-2029-early-targets.js
 *   node server/scripts/enrich-2029-early-targets.js --dry-run
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'recruiting');
const PLAYERS_PATH = path.join(DATA_DIR, 'players.json');
const YOUNGER_SOFT_PATH = path.join(ROOT, 'data', 'futurecast', 'younger-prospects-soft.json');
const EARLY_WATCHLIST_PATH = path.join(ROOT, 'data', 'futurecast', 'early-watchlist.json');
const DELAY_MS = Math.max(150, parseInt(process.env.ON3_INGEST_DELAY_MS || '220', 10) || 220);

function parseArgs(argv) {
  const opts = { dryRun: false, skipAdd: false, limit: 0 };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--skip-add') opts.skipAdd = true;
    else if (arg.startsWith('--limit=')) opts.limit = Number(arg.split('=')[1]) || 0;
  }
  return opts;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugifyName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function localSlugFromOn3(on3Slug, name) {
  const base = String(on3Slug || '')
    .replace(/-\d+$/, '')
    .toLowerCase();
  return base || slugifyName(name);
}

function schoolLabel(profile) {
  const { schoolLabelFromOn3 } = require('../lib/on3-recruit-client');
  return schoolLabelFromOn3(profile) || profile.school || null;
}

function normalizeStars(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : null;
}

async function fetchTop100() {
  const { fetchOn3Html, extractNextDataJson } = require('../lib/on3-fetch');
  const { text } = await fetchOn3Html(
    'https://www.on3.com/rivals/rankings/player/football/2029/',
    { classYear: 2029 }
  );
  const list = extractNextDataJson(text)?.props?.pageProps?.playerData?.list || [];
  return list.map((row) => {
    const person = row.person || {};
    const rating = person.rating || {};
    const name =
      person.name || [person.firstName, person.lastName].filter(Boolean).join(' ') || null;
    const on3Slug = person.slug || null;
    const asset = person.defaultAsset || person.asset || null;
    const photoUrl = asset?.url || asset?.source?.url || null;
    return {
      overallRank: row.overallRank ?? rating.nationalRank ?? null,
      rivalsNatlRank: rating.nationalRank ?? row.overallRank ?? null,
      industryNatlRank: rating.consensusNationalRank ?? row.consensusOverallRank ?? null,
      industryPosRank: rating.consensusPositionRank ?? row.consensusPositionRank ?? null,
      industryStateRank: rating.consensusStateRank ?? row.consensusStateRank ?? null,
      name,
      on3Slug,
      pos: row.positionAbbreviation || rating.positionAbbr || null,
      state: row.stateAbbreviation || rating.stateAbbr || null,
      school: person.currentTeam?.name || person.highSchool?.name || null,
      stars: normalizeStars(rating.consensusStars ?? rating.stars),
      rating: rating.consensusRating ?? rating.rating ?? null,
      rivalsRating: rating.rating ?? null,
      photoUrl,
      on3Id: person.key || null,
    };
  });
}

function findExisting(players, on3Slug, name) {
  const key = String(on3Slug || '').toLowerCase();
  for (const p of players) {
    const url = String(p.on3ProfileUrl || p.on3Slug || '');
    const m = url.match(/\/rivals\/([^/?#]+)/i);
    const ps = String(p.on3Slug || m?.[1] || '').toLowerCase();
    if (key && ps === key) return p;
    if (name && String(p.name || '').toLowerCase() === String(name).toLowerCase() && Number(p.classYear) === 2029) {
      return p;
    }
  }
  return null;
}

function patchFromProfile(existing, profile, topRow) {
  const pos = String(profile.pos || topRow?.pos || existing.pos || '')
    .trim()
    .toUpperCase();
  const stars =
    normalizeStars(profile.stars) ||
    normalizeStars(topRow?.stars) ||
    normalizeStars(existing.stars);
  const natlRank =
    profile.natlRank ??
    topRow?.industryNatlRank ??
    topRow?.rivalsNatlRank ??
    existing.natlRank ??
    null;
  const posRank = profile.posRank ?? topRow?.industryPosRank ?? existing.posRank ?? null;
  const stateRank = profile.stateRank ?? topRow?.industryStateRank ?? existing.stateRank ?? null;
  const rating = profile.rating ?? topRow?.rating ?? existing.rating ?? null;
  const school = schoolLabel(profile) || topRow?.school || existing.school || null;
  const state = profile.state || topRow?.state || existing.state || null;
  const on3Slug = profile.slug || topRow?.on3Slug || existing.on3Slug || null;
  return {
    ...existing,
    name: profile.name || existing.name,
    pos: pos || existing.pos || 'ATH',
    position: pos || existing.position || 'ATH',
    stars,
    natlRank,
    posRank,
    stateRank,
    rating,
    displayRating: rating,
    school,
    state: state ? String(state).toUpperCase() : existing.state || null,
    htWt: profile.htWt || existing.htWt || null,
    height: profile.height ?? existing.height ?? null,
    weight: profile.weight ?? existing.weight ?? null,
    photoUrl: topRow?.photoUrl || existing.photoUrl || existing.imageUrl || null,
    imageUrl: topRow?.photoUrl || existing.imageUrl || existing.photoUrl || null,
    on3Slug,
    on3Id: existing.on3Id || topRow?.on3Id || (String(on3Slug || '').match(/-(\d+)$/) || [])[1] || null,
    on3ProfileUrl: profile.on3ProfileUrl || existing.on3ProfileUrl || (on3Slug ? `https://www.on3.com/rivals/${on3Slug}/` : null),
    on3Source: 'on3-2029-enrich',
    rivalsNatlRank: topRow?.rivalsNatlRank ?? existing.rivalsNatlRank ?? null,
    category: existing.category || 'target',
    status: existing.status || 'uncommitted',
    classYear: 2029,
    rankSyncedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function newTargetFromTop(row) {
  const on3Slug = row.on3Slug;
  const slug = localSlugFromOn3(on3Slug, row.name);
  const pos = String(row.pos || 'ATH').trim().toUpperCase();
  return {
    slug,
    name: row.name,
    classYear: 2029,
    category: 'target',
    status: 'uncommitted',
    pos,
    position: pos,
    school: row.school,
    state: row.state ? String(row.state).toUpperCase() : null,
    stars: row.stars,
    rating: row.rating,
    displayRating: row.rating,
    natlRank: row.industryNatlRank ?? row.rivalsNatlRank,
    posRank: row.industryPosRank,
    stateRank: row.industryStateRank,
    rivalsNatlRank: row.rivalsNatlRank,
    photoUrl: row.photoUrl,
    imageUrl: row.photoUrl,
    on3Slug,
    on3Id: row.on3Id,
    on3ProfileUrl: on3Slug ? `https://www.on3.com/rivals/${on3Slug}/` : null,
    on3Source: 'on3-2029-enrich',
    inState: String(row.state || '').toUpperCase() === 'FL',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rankSyncedAt: new Date().toISOString(),
  };
}

function rebuildYoungerSoft(allPlayers) {
  const early = JSON.parse(fs.readFileSync(EARLY_WATCHLIST_PATH, 'utf8'));
  const entries = [];
  const seen = new Set();
  for (const p of allPlayers) {
    const y = Number(p.classYear);
    if (y !== 2029 && y !== 2030) continue;
    const cat = String(p.category || '').toLowerCase();
    if (!(cat === 'target' || cat === 'recruit' || cat === '')) continue;
    const slug = String(p.slug || '').toLowerCase();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    entries.push({
      slug,
      name: p.name,
      classYear: y,
      tier: y >= 2030 ? 'watchlist' : 'target',
      pos: p.pos || p.position || null,
      school: p.school || p.highSchool || null,
      state: p.state || null,
      stars: normalizeStars(p.stars),
      natlRank: p.natlRank ?? null,
      posRank: p.posRank ?? null,
      stateRank: p.stateRank ?? null,
      rating: p.rating ?? null,
      rivalsNatlRank: p.rivalsNatlRank ?? null,
      photoUrl: p.photoUrl || p.imageUrl || null,
    });
  }
  for (const e of early.entries || []) {
    const slug = String(e.slug || '').toLowerCase();
    const y = Number(e.classYear);
    if (!slug || seen.has(slug) || (y !== 2029 && y !== 2030)) continue;
    seen.add(slug);
    entries.push({
      slug,
      name: e.name || slug,
      classYear: y,
      tier: e.tier || (y >= 2030 ? 'watchlist' : 'target'),
      pos: e.pos || e.position || null,
      school: e.school || null,
      state: e.state || null,
      stars: normalizeStars(e.stars),
      natlRank: e.natlRank ?? null,
      posRank: e.posRank ?? null,
      stateRank: e.stateRank ?? null,
      rating: e.rating ?? null,
      rivalsNatlRank: e.rivalsNatlRank ?? null,
      photoUrl: e.photoUrl || null,
    });
  }
  // Ranked first for Lab soft plate.
  entries.sort((a, b) => {
    if (a.classYear !== b.classYear) return a.classYear - b.classYear;
    const na = a.natlRank ?? a.rivalsNatlRank ?? 9999;
    const nb = b.natlRank ?? b.rivalsNatlRank ?? 9999;
    return na - nb || String(a.name).localeCompare(String(b.name));
  });
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    description:
      'Slim soft plate for Lab Names to know — enriched 2029 ranks/pos/stars from On3/Rivals Power drop.',
    entries,
  };
}

async function main() {
  if (!process.env.ON3_HTML_FALLBACK) process.env.ON3_HTML_FALLBACK = 'true';
  const opts = parseArgs(process.argv.slice(2));
  const store = require('../lib/recruiting-store');
  const { fetchRecruitProfile } = require('../lib/on3-recruit-client');

  console.log('[enrich-2029] fetching Rivals Top 100…');
  const top100 = await fetchTop100();
  console.log('[enrich-2029] top100', top100.length);

  let players = await store.getAllPlayers();
  const existing2029 = players.filter((p) => Number(p.classYear) === 2029);
  const flMissing = top100.filter((row) => {
    if (String(row.state || '').toUpperCase() !== 'FL') return false;
    return !findExisting(players, row.on3Slug, row.name);
  });

  const jobs = [];
  // Enrich every existing 2029 (prefer top100 row when present).
  for (const p of existing2029) {
    const on3 =
      p.on3Slug ||
      (String(p.on3ProfileUrl || '').match(/\/rivals\/([^/?#]+)/i) || [])[1] ||
      null;
    const top = top100.find(
      (r) =>
        r.on3Slug === on3 ||
        String(r.name || '').toLowerCase() === String(p.name || '').toLowerCase()
    );
    jobs.push({ kind: 'enrich', player: p, on3Slug: on3 || top?.on3Slug, top });
  }
  if (!opts.skipAdd) {
    for (const row of flMissing) {
      jobs.push({ kind: 'add', top: row, on3Slug: row.on3Slug });
    }
  }
  if (opts.limit > 0) jobs.splice(opts.limit);

  const summary = { enriched: 0, added: 0, failed: [], skipped: 0 };

  for (let i = 0; i < jobs.length; i += 1) {
    const job = jobs[i];
    const label = job.kind === 'add' ? job.top.name : job.player.slug;
    process.stdout.write(`[${i + 1}/${jobs.length}] ${job.kind} ${label} … `);
    try {
      if (!job.on3Slug) {
        summary.skipped += 1;
        console.log('skip no on3 slug');
        continue;
      }
      const profile = await fetchRecruitProfile(job.on3Slug, 2029);
      if (!profile || profile.error) {
        summary.failed.push({ label, error: profile?.error || 'empty' });
        console.log('fail', profile?.error || 'empty');
        continue;
      }
      if (job.kind === 'add') {
        const created = patchFromProfile(newTargetFromTop(job.top), profile, job.top);
        if (!opts.dryRun) await store.upsertPlayer(created);
        summary.added += 1;
        console.log('ADD', created.slug, created.pos, created.stars + '★', '#' + (created.natlRank || '—'));
      } else {
        const patched = patchFromProfile(job.player, profile, job.top);
        if (!opts.dryRun) await store.upsertPlayer(patched);
        summary.enriched += 1;
        console.log(
          'OK',
          patched.pos,
          (patched.stars || '—') + '★',
          '#' + (patched.natlRank || '—'),
          patched.school || ''
        );
      }
    } catch (err) {
      summary.failed.push({ label, error: err.message || String(err) });
      console.log('error', err.message || err);
    }
    if (i < jobs.length - 1) await sleep(DELAY_MS);
  }

  players = await store.getAllPlayers();
  if (!opts.dryRun) {
    fs.writeFileSync(PLAYERS_PATH, JSON.stringify(players, null, 2));
    const soft = rebuildYoungerSoft(players);
    fs.writeFileSync(YOUNGER_SOFT_PATH, JSON.stringify(soft, null, 2) + '\n');
    console.log('[enrich-2029] wrote', YOUNGER_SOFT_PATH, 'entries', soft.entries.length);
  }

  const out = {
    ok: true,
    dryRun: opts.dryRun,
    top100: top100.length,
    flMissingBefore: flMissing.length,
    ...summary,
    failed: summary.failed.slice(0, 40),
  };
  const reportPath = path.join(DATA_DIR, 'enrich-2029-early-targets-last.json');
  if (!opts.dryRun) fs.writeFileSync(reportPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error('[enrich-2029] failed:', err.message || err);
  process.exit(1);
});
