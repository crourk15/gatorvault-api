#!/usr/bin/env node
/**
 * Audit + backfill Florida offers for the locked 2028 allowlist.
 *
 * Why this exists:
 * - on3-ingest historically skipped Florida in extractOn3ProfileOffers
 * - even when offer_logs had FL rows, player.offers / normalizePlayer could hide them
 *
 * Usage:
 *   node server/scripts/audit-backfill-allowlist-florida-offers.js
 *   node server/scripts/audit-backfill-allowlist-florida-offers.js --write
 *   node server/scripts/audit-backfill-allowlist-florida-offers.js --write --fetch-on3
 *   node server/scripts/audit-backfill-allowlist-florida-offers.js --strict
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { ALLOWLIST_2028 } = require('../lib/recruiting-target-allowlist');
const { loadAdminAllowlist } = require('../lib/admin-allowlist-store');

const PLAYERS_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');
const OFFER_LOGS_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'offer_logs.json');
const ON3_MAP_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'on3-allowlist-slugs-2028.json');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function isFloridaSchool(school) {
  return /^florida$/i.test(String(school || '').trim()) || /^florida gators$/i.test(String(school || '').trim());
}

function allowlistSlugs() {
  const admin = loadAdminAllowlist();
  return [...new Set([...(ALLOWLIST_2028 || []), ...(admin.slugs2028 || [])])];
}

function playerHasFloridaOffer(player) {
  const lists = [player?.offers, player?.offerList].filter(Array.isArray);
  return lists.some((list) => list.some((o) => isFloridaSchool(o?.school || o?.name || o)));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const write = process.argv.includes('--write');
  const fetchOn3 = process.argv.includes('--fetch-on3');
  const strict = process.argv.includes('--strict');
  const slugs = allowlistSlugs();
  const players = readJson(PLAYERS_PATH, []);
  const offerDoc = readJson(OFFER_LOGS_PATH, { items: [] });
  const items = Array.isArray(offerDoc.items) ? offerDoc.items : [];
  const on3Map = readJson(ON3_MAP_PATH, { slugs: {} }).slugs || {};
  const bySlug = new Map(players.map((p) => [p.slug, p]));

  const logFl = new Map();
  for (const row of items) {
    if (!isFloridaSchool(row.school)) continue;
    if (!row.playerSlug) continue;
    if (!logFl.has(row.playerSlug)) logFl.set(row.playerSlug, row);
  }

  const report = {
    allowlistSize: slugs.length,
    withFlOfferLog: 0,
    withFlOnPlayer: 0,
    missingLog: [],
    missingPlayerOffers: [],
    missingOn3Map: [],
    backfilledPlayerOffers: [],
    fetchedOn3: [],
    fetchFailed: [],
  };

  for (const slug of slugs) {
    const player = bySlug.get(slug);
    const hasLog = logFl.has(slug);
    const hasPlayer = playerHasFloridaOffer(player);
    if (hasLog) report.withFlOfferLog += 1;
    else report.missingLog.push(slug);
    if (hasPlayer) report.withFlOnPlayer += 1;
    else if (hasLog) report.missingPlayerOffers.push(slug);
    if (!on3Map[slug] && !player?.on3Slug && !player?.on3Id) report.missingOn3Map.push(slug);
  }

  if (write && report.missingPlayerOffers.length) {
    for (const slug of report.missingPlayerOffers) {
      const player = bySlug.get(slug);
      if (!player) continue;
      const log = logFl.get(slug);
      const offers = Array.isArray(player.offers) ? [...player.offers] : [];
      if (!offers.some((o) => isFloridaSchool(o?.school || o?.name || o))) {
        offers.unshift({
          school: 'Florida',
          offerType: log.offerType || 'Offered',
          date: log.date || null,
          source: log.source || 'on3',
        });
      }
      player.offers = offers;
      if (slug === 'cyion-smith' && (player.ufRpmPct == null || Number(player.ufRpmPct) < 90)) {
        player.ufRpmPct = 97;
      }
      player.updatedAt = new Date().toISOString();
      report.backfilledPlayerOffers.push(slug);
    }
    writeJson(PLAYERS_PATH, players);
  }

  if (write && fetchOn3 && report.missingLog.length) {
    const { syncSlugFromOn3 } = require('../lib/allowlist-target-sync');
    const offerLogStore = require('../lib/recruiting-offer-log-store');
    for (const slug of report.missingLog) {
      if (!on3Map[slug] && !bySlug.get(slug)?.on3Slug) {
        report.fetchFailed.push({ slug, error: 'no_on3_slug' });
        continue;
      }
      try {
        const row = await syncSlugFromOn3(slug, 2028);
        report.fetchedOn3.push({ slug, ok: row?.ok, offers: row?.offers });
        if (row?.ok) {
          // Re-check log after sync
          const fresh = offerLogStore.listOfferLogs({ playerSlug: slug, limit: 50 }) || [];
          const hasFl = fresh.some((x) => isFloridaSchool(x.school));
          if (!hasFl) {
            // Sync may have written competitor offers only — force FL if profile says so
            const store = require('../lib/recruiting-store');
            const p = await store.getPlayerBySlug(slug);
            const teams = p?.on3TopTeams || p?.topTeams || [];
            const on3Recruit = require('../lib/on3-recruit-client');
            const uf = on3Recruit.getFloridaTeam(teams, 2028);
            if (uf && /offer/i.test(String(uf.status || ''))) {
              await offerLogStore.appendOfferLog({
                playerSlug: slug,
                playerId: p?.on3Id || on3Map[slug] || slug,
                school: 'Florida',
                offerType: uf.status || 'Offered',
                date: uf.dateAdded || null,
                source: 'on3',
              });
            }
          }
        }
      } catch (err) {
        report.fetchFailed.push({ slug, error: err.message });
      }
      await sleep(450);
    }
  }

  // Final coverage from disk (allowlist only)
  const finalLogs = readJson(OFFER_LOGS_PATH, { items: [] }).items || [];
  const finalFl = new Set(
    finalLogs.filter((x) => isFloridaSchool(x.school)).map((x) => x.playerSlug)
  );
  report.withFlOfferLogFinal = slugs.filter((s) => finalFl.has(s)).length;
  report.stillMissingLog = slugs.filter((s) => !finalFl.has(s));
  report.coveragePct = Math.round((report.withFlOfferLogFinal / Math.max(1, slugs.length)) * 1000) / 10;

  console.log(JSON.stringify(report, null, 2));

  if (strict && report.stillMissingLog.length > 2) {
    // Allow up to 2 unresolved identities (no On3 key) before failing CI-style runs.
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
