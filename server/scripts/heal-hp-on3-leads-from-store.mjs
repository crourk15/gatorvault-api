#!/usr/bin/env node
/**
 * Heal HP chase-board ufRpmPct + competingSchools from store on3TopTeams
 * so VaultChaseCard "On3 lead" chrome matches industry board.
 *
 * Usage: node server/scripts/heal-hp-on3-leads-from-store.mjs [--year=2028] [--dry]
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { competingSchoolsFromRecruitingRecord } = require('../lib/underclassmen-intel.ts');
const { sanitizeRpmPct } = require('../lib/uf-probability-utils.js');

const yearArg = process.argv.find((a) => a.startsWith('--year='));
const year = Number(yearArg ? yearArg.split('=')[1] : 2028) || 2028;
const dry = process.argv.includes('--dry');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const playersPath = path.join(root, 'server/data/recruiting/players.json');
const hpPath = path.join(root, `server/data/recruiting/futurecast-runtime/high-priority-${year}.json`);

function isFlorida(s) {
  const t = String(s || '').toLowerCase();
  return (
    (t.includes('florida') || t === 'uf' || t.includes('gators')) &&
    !t.includes('state') &&
    !t.includes('atlantic') &&
    !t.includes('a&m') &&
    !/\bsouth florida\b/.test(t)
  );
}

function teamName(t) {
  if (!t) return '';
  if (typeof t === 'string') return t;
  return t.name || t.fullName || t.team?.name || '';
}

function floridaPctFromOn3(top) {
  const rows = (top || [])
    .map((r) => ({
      school: teamName(r.team) || teamName(r) || r.school || '',
      pct: Number(r.prediction ?? r.odds ?? r.pct ?? 0),
    }))
    .filter((r) => r.school && r.pct > 0);
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.pct));
  const scaled = rows.map((r) => ({ ...r, pct: max <= 1.5 ? r.pct * 100 : r.pct }));
  const fl = scaled.find((r) => isFlorida(r.school));
  if (!fl) return null;
  return sanitizeRpmPct(fl.pct);
}

function shortLead(s) {
  const low = String(s || '').toLowerCase();
  if (isFlorida(s)) return 'UF';
  if (low.includes('florida state') || low === 'fsu') return 'FSU';
  if (low.includes('ohio state')) return 'OSU';
  if (low.includes('alabama')) return 'ALA';
  if (low.includes('georgia tech')) return 'GT';
  if (low.includes('georgia')) return 'UGA';
  if (low.includes('miami')) return 'MIA';
  if (low.includes('clemson')) return 'CLEM';
  if (low.includes('notre dame')) return 'ND';
  if (low.includes('penn state')) return 'PSU';
  if (low.includes('tennessee')) return 'TENN';
  if (low.includes('auburn')) return 'AUB';
  if (low.includes('ole miss')) return 'MISS';
  if (low.includes('mississippi state')) return 'MSST';
  if (low.includes('south carolina')) return 'SC';
  if (low.includes('texas tech')) return 'TTU';
  if (low.includes('missouri')) return 'MIZ';
  if (low.includes('michigan state')) return 'MSU';
  if (low.includes('michigan')) return 'MICH';
  if (low.includes('smu')) return 'SMU';
  if (low.includes('nc state') || low.includes('north carolina state')) return 'NCSU';
  if (low.includes('stanford')) return 'STAN';
  if (low.includes('rutgers')) return 'RUT';
  if (low.includes('purdue')) return 'PUR';
  if (low.includes('kentucky')) return 'UK';
  if (low.includes('vanderbilt')) return 'VAN';
  if (low.includes('texas') && !low.includes('a&m')) return 'TEX';
  return String(s).slice(0, 12) || '—';
}

function trueOn3Lead(top) {
  const rows = (top || [])
    .map((r) => ({
      school: teamName(r.team) || teamName(r) || r.school || '',
      pct: Number(r.prediction ?? r.odds ?? r.pct ?? 0),
    }))
    .filter((r) => r.school && r.pct > 0);
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.pct));
  const scaled = rows.map((r) => ({ ...r, pct: max <= 1.5 ? r.pct * 100 : r.pct }));
  scaled.sort((a, b) => b.pct - a.pct);
  return { label: shortLead(scaled[0].school), pct: scaled[0].pct, top3: scaled.slice(0, 3) };
}

/** Mirror VaultChaseCard on3LeadLabel + fixed fake-lock threshold (>=99). */
function chromeLead(player) {
  const comps = (player.competingSchools || []).filter(
    (c) => c?.name && Number(c.pct) > 0 && !isFlorida(c.name)
  );
  let peers = [...comps].sort((a, b) => Number(b.pct) - Number(a.pct));
  const mid = peers.some((s) => {
    const n = Number(s.pct);
    return n >= 15 && n <= 90;
  });
  if (mid && Number(peers[0]?.pct) >= 99) {
    peers = peers.filter((s) => Number(s.pct) < 99);
  }
  const threat = peers[0];
  const uf =
    player.ufRpmPct != null && Number(player.ufRpmPct) > 0
      ? Math.round(Number(player.ufRpmPct))
      : null;
  if (threat && (uf == null || Number(threat.pct) >= uf)) return shortLead(threat.name);
  if (uf != null && uf > 0) return 'UF';
  if (threat) return shortLead(threat.name);
  return '—';
}

const list = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
const bySlug = new Map(list.map((p) => [p.slug || p.id, p]));
const hp = JSON.parse(fs.readFileSync(hpPath, 'utf8'));

let changed = 0;
const report = [];

for (const row of hp.players || []) {
  const store = bySlug.get(row.slug);
  const top = store?.on3TopTeams || store?.topTeams;
  const truth = trueOn3Lead(top);
  const before = chromeLead(row);

  if (Array.isArray(top) && top.length) {
    const comps = competingSchoolsFromRecruitingRecord(store) || [];
    const nextComps = comps.map((c) => ({ name: c.name, pct: c.pct }));
    const uf = floridaPctFromOn3(top);
    const sameComps = JSON.stringify(row.competingSchools || []) === JSON.stringify(nextComps);
    const prevUf = row.ufRpmPct ?? null;
    const nextUf = uf;
    if (!sameComps || prevUf !== nextUf) {
      row.competingSchools = nextComps;
      if (nextUf != null) row.ufRpmPct = nextUf;
      else delete row.ufRpmPct;
      changed += 1;
    }
  }

  const after = chromeLead(row);
  report.push({
    slug: row.slug,
    name: row.name,
    before,
    after,
    true: truth?.label || null,
    matchAfter: truth ? after === truth.label : null,
    ufRpm: row.ufRpmPct ?? null,
    peers: (row.competingSchools || []).slice(0, 3),
  });
}

const mismatches = report.filter((r) => r.matchAfter === false);
console.log(
  JSON.stringify(
    {
      year,
      dry,
      changed,
      withOn3: report.filter((r) => r.true).length,
      mismatchesAfter: mismatches.length,
      mismatches,
    },
    null,
    2
  )
);

if (!dry) {
  hp.updatedAt = new Date().toISOString();
  hp.lastUpdated = hp.updatedAt;
  fs.writeFileSync(hpPath, `${JSON.stringify(hp)}\n`);
  console.error(`Wrote ${hpPath} (${changed} rows updated)`);
}

if (mismatches.length) process.exitCode = 1;
