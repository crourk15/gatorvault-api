#!/usr/bin/env node
/**
 * Refresh On3 Industry Consensus ranks/rating/stars on recruiting profiles.
 *
 * Scope: class years 2026–2029 with an On3 id/slug (commits + targets).
 *
 *   ON3_HTML_FALLBACK=true node server/scripts/sync-on3-industry-profile-ranks.js
 *   node server/scripts/sync-on3-industry-profile-ranks.js --limit=20 --dry-run
 *   node server/scripts/sync-on3-industry-profile-ranks.js --slug=brysen-wright
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'recruiting');
const PLAYERS_PATH = path.join(DATA_DIR, 'players.json');
const YEARS = new Set([2026, 2027, 2028, 2029]);
const DELAY_MS = Math.max(120, parseInt(process.env.ON3_INGEST_DELAY_MS || '200', 10) || 200);

function parseArgs(argv) {
  const opts = { dryRun: false, limit: 0, slug: null, years: null, slugsFile: null };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg.startsWith('--limit=')) opts.limit = Number(arg.split('=')[1]) || 0;
    else if (arg.startsWith('--slug=')) opts.slug = String(arg.split('=')[1] || '').trim().toLowerCase();
    else if (arg.startsWith('--slugs-file=')) opts.slugsFile = String(arg.split('=')[1] || '').trim();
    else if (arg.startsWith('--years=')) {
      opts.years = new Set(
        String(arg.split('=')[1] || '')
          .split(',')
          .map((y) => Number(y.trim()))
          .filter((y) => Number.isFinite(y))
      );
    }
  }
  return opts;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveOn3Slug(player) {
  if (player.on3Slug) return String(player.on3Slug).replace(/^\/+/, '');
  const url = String(player.on3ProfileUrl || '');
  const m = url.match(/\/rivals\/([^/?#]+)/i);
  if (m) return m[1];
  if (player.on3Id && player.name) {
    const { slugify } = require('../lib/slug');
    return `${slugify(player.name)}-${player.on3Id}`;
  }
  return null;
}

function isInScope(player, years) {
  if (!player || !years.has(Number(player.classYear))) return false;
  if (!resolveOn3Slug(player)) return false;
  const st = String(player.status || '').toLowerCase();
  const cat = String(player.category || '').toLowerCase();
  if (['committed', 'enrolled', 'signed', 'uncommitted'].includes(st)) return true;
  if (['target', 'recruit'].includes(cat)) return true;
  return false;
}

function changedRankFields(before, after) {
  const keys = ['natlRank', 'posRank', 'stateRank', 'rating', 'stars'];
  const diffs = {};
  for (const k of keys) {
    const a = before?.[k];
    const b = after?.[k];
    if (a == null && b == null) continue;
    if (Number(a) !== Number(b) && String(a) !== String(b)) diffs[k] = { from: a ?? null, to: b ?? null };
  }
  return diffs;
}

async function main() {
  if (!process.env.ON3_HTML_FALLBACK) process.env.ON3_HTML_FALLBACK = 'true';

  const opts = parseArgs(process.argv.slice(2));
  const years = opts.years && opts.years.size ? opts.years : YEARS;
  const store = require('../lib/recruiting-store');
  const { fetchRecruitProfile, pickOn3IndustryRanks } = require('../lib/on3-recruit-client');

  let players = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
  if (!Array.isArray(players)) throw new Error('players.json must be an array');

  let jobs = players.filter((p) => isInScope(p, years));
  if (opts.slugsFile) {
    const slugs = new Set(
      JSON.parse(fs.readFileSync(opts.slugsFile, 'utf8')).map((x) => String(x).toLowerCase())
    );
    jobs = jobs.filter((p) => slugs.has(String(p.slug).toLowerCase()));
  }
  if (opts.slug) jobs = jobs.filter((p) => String(p.slug).toLowerCase() === opts.slug);
  // Prefer wrong-looking / hot names first, then the rest by class year desc.
  jobs.sort((a, b) => {
    const score = (p) => {
      let s = 0;
      const r = Number(p.rating);
      const n = Number(p.natlRank);
      if (Number.isFinite(r) && r >= 97 && Number.isFinite(n) && n > 50) s += 100;
      if (Number(p.stars) >= 5 && Number.isFinite(n) && n > 30) s += 50;
      if (Number(p.classYear) === 2028) s += 10;
      if (Number(p.classYear) === 2027) s += 5;
      return s;
    };
    return score(b) - score(a) || Number(b.classYear) - Number(a.classYear);
  });
  if (opts.limit > 0) jobs = jobs.slice(0, opts.limit);

  const summary = {
    considered: jobs.length,
    fetched: 0,
    updated: 0,
    unchanged: 0,
    failed: [],
    notable: [],
  };

  for (let i = 0; i < jobs.length; i += 1) {
    const player = jobs[i];
    const on3Slug = resolveOn3Slug(player);
    process.stdout.write(`[${i + 1}/${jobs.length}] ${player.slug} … `);
    try {
      const profile = await fetchRecruitProfile(on3Slug, player.classYear || 2028);
      summary.fetched += 1;
      if (!profile || profile.error) {
        summary.failed.push({ slug: player.slug, error: profile?.error || 'empty' });
        console.log('fail', profile?.error || 'empty');
        continue;
      }
      const industry = pickOn3IndustryRanks(profile.rankingsPlayer || {}, {});
      const next = {
        natlRank: industry.natlRank,
        posRank: industry.posRank,
        stateRank: industry.stateRank,
        rating: industry.rating ?? profile.rating ?? null,
        stars: industry.stars ?? profile.stars ?? player.stars ?? null,
      };
      // If Industry stack missing, keep last-good rather than wiping.
      for (const k of Object.keys(next)) {
        if (next[k] == null || next[k] === '') next[k] = player[k] ?? null;
      }
      const diffs = changedRankFields(player, next);
      if (!Object.keys(diffs).length) {
        summary.unchanged += 1;
        console.log('ok (unchanged)', next.natlRank, next.posRank, next.stateRank);
      } else {
        summary.updated += 1;
        summary.notable.push({ slug: player.slug, diffs, next });
        console.log(
          'UPDATE',
          `natl ${player.natlRank ?? '—'}→${next.natlRank ?? '—'}`,
          `pos ${player.posRank ?? '—'}→${next.posRank ?? '—'}`,
          `st ${player.stateRank ?? '—'}→${next.stateRank ?? '—'}`,
          `rtg ${player.rating != null ? Number(player.rating).toFixed(2) : '—'}→${
            next.rating != null ? Number(next.rating).toFixed(2) : '—'
          }`
        );
        if (!opts.dryRun) {
          const patch = {
            ...player,
            ...next,
            displayRating: next.rating,
            on3Source: 'on3-board-sync',
            on3Slug,
            on3Id: player.on3Id || (String(on3Slug).match(/-(\d+)$/) || [])[1] || null,
            on3ProfileUrl: player.on3ProfileUrl || `https://www.on3.com/rivals/${on3Slug}/`,
            rankSyncedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await store.upsertPlayer(patch);
          try {
            const boardPath = path.join(DATA_DIR, '2028-target-board.json');
            if (Number(player.classYear) === 2028 && fs.existsSync(boardPath)) {
              const board = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
              const t = (board.targets || []).find((row) => String(row.slug || '').toLowerCase() === player.slug);
              if (t) {
                if (next.natlRank != null) t.natlRank = next.natlRank;
                if (next.posRank != null) t.posRank = next.posRank;
                if (next.stateRank != null) t.stateRank = next.stateRank;
                if (next.rating != null) t.rating = next.rating;
                if (next.stars != null) t.stars = next.stars;
                fs.writeFileSync(boardPath, JSON.stringify(board, null, 2));
              }
            }
          } catch {
            /* optional board mirror */
          }
          const idx = players.findIndex((p) => p.slug === player.slug);
          if (idx >= 0) players[idx] = { ...players[idx], ...patch };
        }
      }
    } catch (err) {
      summary.failed.push({ slug: player.slug, error: err.message || String(err) });
      console.log('error', err.message || err);
    }
    if (i < jobs.length - 1) await sleep(DELAY_MS);
  }

  if (!opts.dryRun) {
    // Reload from store so preservePlayerFields / normalize stick.
    players = await store.getAllPlayers();
    fs.writeFileSync(PLAYERS_PATH, JSON.stringify(players, null, 2));
  }

  const outPath = path.join(DATA_DIR, 'on3-industry-rank-sync-last.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        dryRun: opts.dryRun,
        summary: {
          ...summary,
          notable: summary.notable.slice(0, 80),
          failed: summary.failed.slice(0, 80),
        },
      },
      null,
      2
    )
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: opts.dryRun,
        considered: summary.considered,
        fetched: summary.fetched,
        updated: summary.updated,
        unchanged: summary.unchanged,
        failed: summary.failed.length,
        report: outPath,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error('[sync-on3-industry-profile-ranks] failed:', err.message || err);
  process.exit(1);
});
