#!/usr/bin/env node
/**
 * Heal store rows where Florida ufRpmPct was poisoned 1�!100 (or similar)
 * while the On3-style field clearly belongs to another school.
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
  if (/florida/i.test(topName)) return null;
  const florida = real.find((c) => /florida/i.test(String(c.school || c.name || '')));
  const floridaPct = Number(florida?.pct || florida?.score || 0);
  if (floridaPct + 40 >= rpm) return null;
  return { rpm, topName, floridaPct };
}

function main() {
  const { file, raw, rows } = loadPlayers();
  const hits = [];
  for (const p of rows) {
    const bad = fieldMismatch(p);
    if (!bad) continue;
    hits.push({
      slug: p.slug,
      name: p.name,
      beforeRpm: p.ufRpmPct,
      beforeUf: p.ufProbability,
      ...bad,
    });
    if (APPLY) {
      // Prefer micro board truth when present; else clear poisoned RPM.
      const boardPath = path.join(resolveRecruitingDataDir(), '2028-target-board.json');
      let boardRpm = null;
      try {
        const board = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
        const brows = Array.isArray(board) ? board : board.targets || [];
        const row = brows.find((r) => String(r.slug || '').toLowerCase() === String(p.slug || '').toLowerCase());
        boardRpm = sanitizeRpmPct(row?.ufRpmPct);
      } catch {
        /* optional */
      }
      p.ufRpmPct = boardRpm != null && boardRpm < 10 ? boardRpm : null;
      if (p.ufProbability != null && Number(p.ufProbability) >= 85) {
        p.ufProbability = null;
      }
      if (p.futurecastProbability != null && Number(p.futurecastProbability) >= 85) {
        p.futurecastProbability = null;
      }
      p.rpmHealAt = new Date().toISOString();
      p.rpmHealReason = 'field_mismatch_one_to_hundred';
    }
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
