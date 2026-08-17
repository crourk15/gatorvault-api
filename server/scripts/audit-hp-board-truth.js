#!/usr/bin/env node
/**
 * Audit HP plates vs recruiting store for Girton-style sole-board lies:
 * empty competingSchools + high Florida RPM while store topTeams show a rival lead.
 *
 * Usage:
 *   node --import tsx server/scripts/audit-hp-board-truth.js [--year=2028] [--fail]
 *   node --import tsx server/scripts/audit-hp-board-truth.js --live --fail
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { healHighPriorityRpmPoisonRow } = require('../api/futurecast/response-cache.ts');
const { resolveRecruitingDataDir, BUNDLE_DIR } = require('../lib/recruiting-data-dir');

function argVal(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function isFloridaName(name) {
  const n = String(name || '');
  return /\bflorida\b|\bgators\b/i.test(n) && !/florida state|south florida/i.test(n);
}

function peerComps(comps) {
  return (Array.isArray(comps) ? comps : []).filter((c) => {
    const n = String(c?.name || c?.school || '');
    return n && !isFloridaName(n);
  });
}

function loadPlayers() {
  const files = [
    path.join(resolveRecruitingDataDir(), 'players.json'),
    path.join(BUNDLE_DIR, 'players.json'),
  ];
  const bySlug = new Map();
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const rows = Array.isArray(raw) ? raw : raw.players || [];
    for (const p of rows) {
      const slug = String(p?.slug || '').toLowerCase();
      if (!slug || bySlug.has(slug)) continue;
      bySlug.set(slug, p);
    }
  }
  return bySlug;
}

function storePeers(player) {
  const teams = player?.topTeams || player?.on3TopTeams || [];
  const out = [];
  for (const t of teams) {
    const name = String(t?.team?.name || t?.team?.fullName || t?.name || '').trim();
    if (!name || isFloridaName(name)) continue;
    const raw = Number(t?.prediction ?? t?.pct ?? t?.score);
    if (!Number.isFinite(raw) || raw <= 0) continue;
    const pct = raw <= 1.5 ? raw * 100 : raw;
    if (pct >= 5) out.push({ name, pct: Math.round(pct * 10) / 10 });
  }
  const comps = player?.competitors || [];
  for (const c of comps) {
    const name = String(c?.school || c?.name || '').trim();
    if (!name || isFloridaName(name)) continue;
    const pct = Number(c?.pct ?? c?.score);
    if (!Number.isFinite(pct) || pct < 5) continue;
    out.push({ name, pct: Math.round(pct * 10) / 10 });
  }
  out.sort((a, b) => b.pct - a.pct);
  const seen = new Set();
  return out.filter((r) => {
    const k = r.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function storeFloridaPct(player) {
  const teams = player?.topTeams || player?.on3TopTeams || [];
  let best = null;
  for (const t of teams) {
    const name = String(t?.team?.name || t?.team?.fullName || t?.name || '').trim();
    if (!isFloridaName(name)) continue;
    const raw = Number(t?.prediction ?? t?.pct ?? t?.score);
    if (!Number.isFinite(raw) || raw <= 0) continue;
    const pct = raw <= 1.5 ? raw * 100 : raw;
    if (best == null || pct > best) best = pct;
  }
  const rpm = Number(player?.ufRpmPct);
  if (best == null && Number.isFinite(rpm)) best = rpm;
  return best;
}

function loadHp(year) {
  const runtime = path.join(
    resolveRecruitingDataDir(),
    'futurecast-runtime',
    `high-priority-${year}.json`
  );
  const bundledRuntime = path.join(
    BUNDLE_DIR,
    'futurecast-runtime',
    `high-priority-${year}.json`
  );
  for (const file of [runtime, bundledRuntime]) {
    if (!fs.existsSync(file)) continue;
    return { src: file, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
  }
  return null;
}

async function loadLive(year) {
  const base = process.env.GV_API_BASE || 'https://gatorvault-api.onrender.com';
  const url = `${base}/api/futurecast/high-priority?year=${year}&_=${Date.now()}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`live HP ${res.status}`);
  return { src: url, data: await res.json() };
}

function auditRows(rows, bySlug) {
  const issues = [];
  for (const r of rows) {
    const slug = String(r.slug || '').toLowerCase();
    const sp = bySlug.get(slug);
    const peers = peerComps(r.competingSchools);
    const ufRpm = Number(r.ufRpmPct);
    const uf = Number(r.ufProbability);
    const sPeers = sp ? storePeers(sp) : [];
    const sFl = sp ? storeFloridaPct(sp) : null;
    const flags = [];

    // Real sole locks (West/Dominick ~98%) correctly drop residual peers — not a lie.
    const realSoleLock = sFl != null && sFl >= 85;
    if (peers.length === 0 && Number.isFinite(ufRpm) && ufRpm >= 70 && sPeers.length > 0) {
      const top = sPeers[0];
      if (sFl != null && top.pct > sFl + 5) flags.push('SOLE_BOARD_LIE');
      else if (sFl != null && sFl + 40 < ufRpm) flags.push('SOLE_BOARD_LIE');
      else if (!realSoleLock && sFl == null && top.pct >= 12) flags.push('MISSING_PEERS_ON_HP');
      else if (!realSoleLock && sFl != null && sFl < 70 && top.pct >= 12) {
        flags.push('MISSING_PEERS_ON_HP');
      }
    } else if (peers.length === 0 && sPeers.length > 0 && !realSoleLock) {
      // Contested boards should keep rivals on the HP plate.
      if (sFl == null || sFl < 70) flags.push('MISSING_PEERS_ON_HP');
    }

    if (
      Number.isFinite(ufRpm) &&
      sFl != null &&
      ufRpm >= 70 &&
      sFl + 40 < ufRpm
    ) {
      flags.push('RPM_VS_STORE_POISON');
    }

    if (!flags.length) continue;

    const healed = healHighPriorityRpmPoisonRow({ ...r });
    const hPeers = peerComps(healed.competingSchools);
    if (flags.includes('SOLE_BOARD_LIE')) {
      if (hPeers.length === 0 && sPeers.length > 0) flags.push('HEAL_FAILED');
      else if (hPeers.length > 0) flags.push('HEAL_WOULD_FIX');
    } else if (flags.includes('MISSING_PEERS_ON_HP') && hPeers.length > 0) {
      flags.push('HEAL_WOULD_FIX');
    }

    issues.push({
      name: r.name,
      slug,
      flags,
      ufRpm,
      uf,
      storeFlorida: sFl,
      peerCount: peers.length,
      storePeerCount: sPeers.length,
      topStorePeers: sPeers.slice(0, 3),
      healed: {
        ufRpm: healed.ufRpmPct,
        uf: healed.ufProbability,
        peers: hPeers.slice(0, 3),
      },
    });
  }
  return issues;
}

async function main() {
  const year = Number(argVal('year', '2028')) || 2028;
  const fail = process.argv.includes('--fail');
  const live = process.argv.includes('--live');
  const bySlug = loadPlayers();

  let plate;
  if (live) {
    plate = await loadLive(year);
  } else {
    plate = loadHp(year);
    if (!plate) {
      console.error(`No HP plate found for ${year}`);
      process.exit(2);
    }
  }

  const rows = Array.isArray(plate.data.players) ? plate.data.players : [];
  const issues = auditRows(rows, bySlug);
  const lies = issues.filter((i) =>
    i.flags.some((f) => ['SOLE_BOARD_LIE', 'RPM_VS_STORE_POISON', 'HEAL_FAILED'].includes(f))
  );

  const summary = {
    year,
    src: plate.src,
    rowCount: rows.length,
    issueCount: issues.length,
    soleBoardLies: lies.filter((i) => i.flags.includes('SOLE_BOARD_LIE')).length,
    rpmPoison: lies.filter((i) => i.flags.includes('RPM_VS_STORE_POISON')).length,
    healFailed: lies.filter((i) => i.flags.includes('HEAL_FAILED')).length,
  };

  console.log(JSON.stringify({ summary, issues }, null, 2));

  if (fail && lies.length) {
    console.error(
      `[audit-hp-board-truth] FAIL: ${lies.length} poisoned row(s) — Girton-style sole-board / RPM lies`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
