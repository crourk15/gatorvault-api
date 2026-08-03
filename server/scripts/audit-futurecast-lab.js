#!/usr/bin/env node
/**
 * End-to-end FutureCast Lab audit after Florida-offer corrections.
 *
 * Checks:
 *  1) Allowlist FL offer coverage (offer_logs + player.offers + chase flOffers)
 *  2) Hottest / High Priority top 18 all have FL offers
 *  3) Hero lead never markets elite-fit at single-digit Florida %
 *  4) Safety chase exists on the live board (need-board input)
 *  5) Named backfills (Smith / Jernigan / Dollard) are on the live board
 *
 * Usage:
 *   node server/scripts/audit-futurecast-lab.js
 *   node server/scripts/audit-futurecast-lab.js --year=2028 --strict
 */
'use strict';

const { scoreHotTargetBoard } = require('../lib/hot-florida-targets');
const { buildChaseFeatureIndex } = require('../lib/uf-chase-score');
const { getLiveBoardTargets } = require('../lib/live-board-targets');
const { ALLOWLIST_2028 } = require('../lib/recruiting-target-allowlist');
const { loadAdminAllowlist } = require('../lib/admin-allowlist-store');
const store = require('../lib/recruiting-store');
const desk = require('../lib/desk-intel-futurecast-feed');

const LAB_HERO_ELITE_FIT_MIN = 80;
const LAB_HERO_ELITE_UF_FLOOR = 25;
const LAB_HERO_ELITE_UF_BAND = 15;
const HP_LIMIT = 18;

function argValue(flag, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : fallback;
}

function ufPct(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function isFloridaSchool(school) {
  return /^florida$/i.test(String(school || '').trim()) || /^florida gators$/i.test(String(school || '').trim());
}

function playerHasFlOffer(player) {
  return [player?.offers, player?.offerList]
    .filter(Array.isArray)
    .some((list) => list.some((o) => isFloridaSchool(o?.school || o?.name || o)));
}

function pickLabHeroLead(top10) {
  if (!top10.length) return null;
  const topByPriority = top10[0];
  const realUfPool = top10.filter((p) => ufPct(p.ufProbability) >= LAB_HERO_ELITE_UF_FLOOR);
  const base =
    ufPct(topByPriority.ufProbability) >= LAB_HERO_ELITE_UF_FLOOR || !realUfPool.length
      ? topByPriority
      : realUfPool[0];
  const elite = [...(realUfPool.length ? realUfPool : top10)]
    .filter((p) => (p.fitScore ?? 0) >= LAB_HERO_ELITE_FIT_MIN)
    .sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0))[0];
  if (elite && ufPct(elite.ufProbability) >= ufPct(base.ufProbability) - LAB_HERO_ELITE_UF_BAND) {
    return elite;
  }
  return base;
}

function isLabHeroEliteFit(target) {
  if (!target) return false;
  return (target.fitScore ?? 0) >= LAB_HERO_ELITE_FIT_MIN && ufPct(target.ufProbability) >= LAB_HERO_ELITE_UF_FLOOR;
}

function needRoom(pos) {
  const p = String(pos || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (p === 'S' || p === 'FS' || p === 'SS' || p === 'SAFETY') return 'S';
  return p;
}

async function main() {
  const year = Number(argValue('--year', '2028')) || 2028;
  const strict = process.argv.includes('--strict');
  const admin = loadAdminAllowlist();
  const slugs = [...new Set([...(ALLOWLIST_2028 || []), ...(admin.slugs2028 || [])])];
  const offerItems = require('../data/recruiting/offer_logs.json').items || [];
  const flLog = new Set(
    offerItems.filter((x) => isFloridaSchool(x.school)).map((x) => x.playerSlug)
  );

  const live = await getLiveBoardTargets(year);
  const scored = scoreHotTargetBoard(live, { classYear: year }).sort(
    (a, b) => (b.hotScore || 0) - (a.hotScore || 0)
  );
  const index = buildChaseFeatureIndex({ classYear: year });
  const hp = scored.slice(0, HP_LIMIT);
  const issues = [];

  for (const slug of slugs) {
    const feat = index.bySlug.get(slug);
    const player = await store.getPlayerBySlug(slug);
    if (!flLog.has(slug)) issues.push({ severity: 'critical', kind: 'missing_fl_offer_log', slug });
    if (!playerHasFlOffer(player)) {
      issues.push({ severity: 'critical', kind: 'missing_player_offers_fl', slug });
    }
    if (!feat || feat.flOffers < 1) {
      issues.push({ severity: 'critical', kind: 'chase_missing_flOffers', slug });
    }
    if (player && !desk.floridaOfferedOnPlayer(player)) {
      issues.push({ severity: 'high', kind: 'desk_intel_not_offered', slug });
    }
    if (!live.some((p) => p.slug === slug)) {
      issues.push({ severity: 'high', kind: 'missing_from_live_board', slug });
    }
  }

  for (const row of hp) {
    const feat = index.bySlug.get(row.slug);
    if (!feat?.flOffers) {
      issues.push({ severity: 'high', kind: 'hp_without_fl_offer', slug: row.slug });
    }
  }

  const top10 = hp.slice(0, 10).map((r) => ({
    slug: r.slug,
    name: r.name,
    position: r.pos,
    fitScore: r.fitScore ?? r.lanes?.mustGetFit ?? null,
    ufProbability: r.ufRpmPct ?? r.ufProbability ?? 0,
    priorityScore: r.hotScore,
  }));
  // Prefer recruiting-store fitScore for hero audit (matches underclassmen HP path).
  for (const row of top10) {
    const p = await store.getPlayerBySlug(row.slug);
    if (p?.fitScore != null && Number(p.fitScore) > 0) row.fitScore = Number(p.fitScore);
    if (p?.ufRpmPct != null && Number(p.ufRpmPct) > 0) row.ufProbability = Number(p.ufRpmPct);
  }

  const lead = pickLabHeroLead(top10);
  if (lead && isLabHeroEliteFit(lead) === false && (lead.fitScore ?? 0) >= LAB_HERO_ELITE_FIT_MIN && ufPct(lead.ufProbability) < LAB_HERO_ELITE_UF_FLOOR) {
    issues.push({ severity: 'critical', kind: 'hero_elite_label_low_uf', lead });
  }
  if (lead && ufPct(lead.ufProbability) < LAB_HERO_ELITE_UF_FLOOR) {
    const realUfInTop10 = top10.some((p) => ufPct(p.ufProbability) >= LAB_HERO_ELITE_UF_FLOOR);
    if (realUfInTop10) {
      issues.push({
        severity: 'critical',
        kind: 'hero_low_uf_despite_real_uf_pool',
        lead: { slug: lead.slug, uf: ufPct(lead.ufProbability), fit: lead.fitScore },
      });
    }
  }

  const safeties = scored.filter((r) => needRoom(r.pos) === 'S');
  if (!safeties.length) {
    issues.push({ severity: 'critical', kind: 'no_safeties_on_live_board' });
  } else if (!hp.some((r) => needRoom(r.pos) === 'S')) {
    issues.push({
      severity: 'info',
      kind: 'safety_outside_hp18_need_board_must_use_full_chase',
      safeties: safeties.map((s) => ({
        slug: s.slug,
        hotRank: scored.findIndex((x) => x.slug === s.slug) + 1,
        hot: s.hotScore,
        chase: s.chaseScore,
      })),
    });
  }

  for (const slug of ['cyion-smith', 'zaiden-jernigan', 'nate-dollard']) {
    const row = scored.find((x) => x.slug === slug);
    const player = await store.getPlayerBySlug(slug);
    if (!row) issues.push({ severity: 'critical', kind: 'backfill_not_on_live_board', slug });
    if (!index.bySlug.get(slug)?.flOffers) {
      issues.push({ severity: 'critical', kind: 'backfill_chase_no_offer', slug });
    }
    if (!desk.floridaOfferedOnPlayer(player)) {
      issues.push({ severity: 'critical', kind: 'backfill_desk_not_offered', slug });
    }
  }

  const report = {
    year,
    allowlist: slugs.length,
    liveBoard: live.length,
    flOfferLogCoverage: slugs.filter((s) => flLog.has(s)).length,
    flOfferLogPct: Math.round((slugs.filter((s) => flLog.has(s)).length / Math.max(1, slugs.length)) * 1000) / 10,
    hottestTop5: scored.slice(0, 5).map((r, i) => ({
      rank: i + 1,
      slug: r.slug,
      pos: r.pos,
      hot: r.hotScore,
      chase: r.chaseScore,
      flOffers: index.bySlug.get(r.slug)?.flOffers || 0,
    })),
    heroLead: lead
      ? {
          slug: lead.slug,
          name: lead.name,
          uf: ufPct(lead.ufProbability),
          fit: lead.fitScore,
          eliteLabel: isLabHeroEliteFit(lead),
        }
      : null,
    top10: top10.map((p, i) => ({
      rank: i + 1,
      slug: p.slug,
      uf: ufPct(p.ufProbability),
      fit: p.fitScore,
      hot: p.priorityScore,
    })),
    safeties: safeties.map((s) => ({
      slug: s.slug,
      hotRank: scored.findIndex((x) => x.slug === s.slug) + 1,
      hot: s.hotScore,
      chase: s.chaseScore,
      flOffers: index.bySlug.get(s.slug)?.flOffers || 0,
    })),
    namedBackfills: Object.fromEntries(
      await Promise.all(
        ['cyion-smith', 'zaiden-jernigan', 'nate-dollard', 'ryan-drakeford'].map(async (slug) => {
          const row = scored.find((x) => x.slug === slug);
          const player = await store.getPlayerBySlug(slug);
          return [
            slug,
            {
              hotRank: row ? scored.indexOf(row) + 1 : null,
              hot: row?.hotScore ?? null,
              chase: row?.chaseScore ?? null,
              flOffers: index.bySlug.get(slug)?.flOffers || 0,
              ufRpm: player?.ufRpmPct ?? null,
              deskOffered: desk.floridaOfferedOnPlayer(player),
            },
          ];
        })
      )
    ),
    issues,
    critical: issues.filter((i) => i.severity === 'critical').length,
    high: issues.filter((i) => i.severity === 'high').length,
    ok: issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length === 0,
  };

  console.log(JSON.stringify(report, null, 2));
  if (strict && !report.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
