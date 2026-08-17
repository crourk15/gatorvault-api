#!/usr/bin/env node
/**
 * Heal store rows where Florida ufRpmPct was poisoned (1->100 or similar)
 * while the On3-style field / topTeams board clearly belongs elsewhere.
 *
 * Also re-sync ufRpmPct + competitors from On3 topTeams when present.
 *
 *   node server/scripts/heal-rpm-field-mismatch.js
 *   node server/scripts/heal-rpm-field-mismatch.js --apply
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { resolveRecruitingDataDir } = require('../lib/recruiting-data-dir');
const { sanitizeRpmPct } = require('../lib/uf-probability-utils');

const APPLY = process.argv.includes('--apply');

function loadPlayers() {
  const file = path.join(resolveRecruitingDataDir(), 'players.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = Array.isArray(raw) ? raw : raw.players || [];
  return { file, raw, rows };
}

function isFloridaName(name) {
  return /\bflorida\b|\bgators\b|\buf\b/i.test(String(name || ''));
}

function teamName(row) {
  return String(row?.team?.name || row?.team?.fullName || row?.name || row?.school || '').trim();
}

function teamPrediction(row) {
  const n = Number(row?.prediction ?? row?.pct ?? row?.score);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Lightweight topTeams reader — avoids pulling on3-board-hydrate (node-fetch). */
function topTeamsBoard(player) {
  const teams = player.topTeams || player.on3TopTeams || [];
  if (!Array.isArray(teams) || !teams.length) return null;
  const classYear = Number(player.classYear) || 2028;
  const yearRows = teams.filter((t) => {
    const y = Number(t?.year ?? t?.classYear ?? classYear);
    return !Number.isFinite(y) || y === classYear;
  });
  const rows = yearRows.length ? yearRows : teams;
  const scored = rows
    .map((t) => ({ name: teamName(t), pct: teamPrediction(t) }))
    .filter((t) => t.name && t.pct != null);
  if (!scored.length) return null;

  // Detect 0-1 fraction boards vs percent boards.
  const max = Math.max(...scored.map((t) => t.pct));
  const scale = max <= 1.5 ? 100 : 1;
  const normalized = scored
    .map((t) => ({ name: t.name, pct: Math.round(t.pct * scale * 10) / 10 }))
    .filter((t) => t.pct > 0)
    .sort((a, b) => b.pct - a.pct);

  const florida = normalized.find((t) => isFloridaName(t.name));
  const peers = normalized
    .filter((t) => !isFloridaName(t.name))
    .map((t) => ({
      school: t.name,
      name: t.name,
      score: t.pct,
      pct: t.pct,
      source: 'on3_top_teams',
      updatedAt: new Date().toISOString(),
    }));

  return {
    boardRpm: florida ? sanitizeRpmPct(florida.pct) : null,
    peers,
  };
}

function fieldMismatch(player) {
  const rpm = sanitizeRpmPct(player.ufRpmPct);
  if (rpm == null || rpm < 85) return null;
  const comps = player.competitors || player.competingSchools || [];
  const real = comps.filter((c) => Number(c?.pct || c?.score || 0) >= 5);
  if (!real.length) return null;
  const top = [...real].sort(
    (a, b) => Number(b.pct || b.score || 0) - Number(a.pct || a.score || 0)
  )[0];
  const topName = top?.school || top?.name || '';
  if (isFloridaName(topName)) return null;
  const florida = real.find((c) => isFloridaName(c.school || c.name));
  const floridaPct = Number(florida?.pct || florida?.score || 0);
  if (floridaPct + 40 >= rpm) return null;
  return { rpm, topName, floridaPct, kind: 'field_mismatch' };
}

function needsTopTeamsSync(player, truth) {
  if (!truth) return null;
  const storeRpm = sanitizeRpmPct(player.ufRpmPct);
  const issues = [];
  if (truth.boardRpm != null && storeRpm != null && Math.abs(storeRpm - truth.boardRpm) >= 15) {
    issues.push(`rpm ${storeRpm}->${truth.boardRpm}`);
  }
  if (truth.boardRpm != null && storeRpm == null) {
    issues.push(`rpm null->${truth.boardRpm}`);
  }
  if (truth.boardRpm != null && storeRpm != null && storeRpm >= 85 && truth.boardRpm + 40 < storeRpm) {
    issues.push(`poison ${storeRpm}->${truth.boardRpm}`);
  }
  const topPeer = truth.peers[0];
  if (
    topPeer &&
    Number(topPeer.pct) >= 12 &&
    truth.boardRpm != null &&
    Number(topPeer.pct) > truth.boardRpm &&
    storeRpm != null &&
    storeRpm >= 70
  ) {
    issues.push(`rival_led ${topPeer.school} ${Math.round(topPeer.pct)} > UF ${truth.boardRpm}`);
  }
  if (!issues.length) return null;
  return { ...truth, issues, kind: 'top_teams_sync' };
}

function main() {
  const { file, raw, rows } = loadPlayers();
  const hits = [];

  for (const p of rows) {
    const mismatch = fieldMismatch(p);
    const truth = topTeamsBoard(p);
    const sync = needsTopTeamsSync(p, truth);
    if (!mismatch && !sync) continue;

    hits.push({
      slug: p.slug,
      name: p.name,
      beforeRpm: p.ufRpmPct,
      beforeUf: p.ufProbability,
      mismatch,
      sync: sync
        ? { boardRpm: sync.boardRpm, topPeer: sync.peers[0]?.school, issues: sync.issues }
        : null,
    });

    if (!APPLY) continue;

    if (sync?.boardRpm != null) {
      p.ufRpmPct = sync.boardRpm;
    } else if (mismatch) {
      const boardPath = path.join(resolveRecruitingDataDir(), '2028-target-board.json');
      let boardRpm = null;
      try {
        const board = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
        const brows = Array.isArray(board) ? board : board.targets || [];
        const row = brows.find(
          (r) => String(r?.slug || '').toLowerCase() === String(p.slug || '').toLowerCase()
        );
        boardRpm = sanitizeRpmPct(row?.ufRpmPct);
      } catch {
        /* optional */
      }
      p.ufRpmPct = boardRpm != null && boardRpm < 100 ? boardRpm : null;
    }

    if (sync?.peers?.length) {
      const legacy = (Array.isArray(p.competitors) ? p.competitors : []).filter(
        (c) => String(c?.source || '').toLowerCase() === 'legacy'
      );
      p.competitors = [...sync.peers, ...legacy];
    }

    const rpmNow = sanitizeRpmPct(p.ufRpmPct);
    if (rpmNow != null && rpmNow < 20) {
      if (p.ufProbability != null && Number(p.ufProbability) >= 50) p.ufProbability = null;
      if (p.futurecastProbability != null && Number(p.futurecastProbability) >= 50) {
        p.futurecastProbability = null;
      }
    } else if (
      p.ufProbability != null &&
      Number(p.ufProbability) >= 85 &&
      (rpmNow == null || rpmNow < 50)
    ) {
      p.ufProbability = null;
    }

    p.rpmHealAt = new Date().toISOString();
    p.rpmHealReason = sync?.kind || mismatch?.kind || 'heal_rpm_field_mismatch';
  }

  console.log(JSON.stringify({ apply: APPLY, file, healed: hits.length, hits }, null, 2));
  if (APPLY && hits.length) {
    if (Array.isArray(raw)) {
      fs.writeFileSync(file, `${JSON.stringify(rows, null, 2)}\n`);
    } else {
      raw.players = rows;
      fs.writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`);
    }
    console.log('wrote', file);
  }
}

main();
