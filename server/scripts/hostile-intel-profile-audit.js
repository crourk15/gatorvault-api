#!/usr/bin/env node
/**
 * Hostile-intel profile audit — proves last-good depth without live On3.
 * Exit 0 only when Cyion + sample allowlist peers retain elite profile fields.
 */
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const players = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'recruiting', 'players.json'), 'utf8')
);
const board = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'recruiting', '2028-target-board.json'), 'utf8')
);
const {
  applyEditorialPositionToPlayer,
  isWeakPosition,
} = require('../lib/recruiting-editorial-positions');

const REQUIRED = ['cyion-smith', 'cassell-cruickshank', 'malakhi-dudley', 'xander-edwards'];

function bySlug(list, slug) {
  return (list || []).find((p) => String(p.slug || '').toLowerCase() === slug);
}

function auditSlug(slug) {
  const local = bySlug(players, slug);
  const boardRow = bySlug(board.targets, slug);
  assert.ok(local, `${slug}: missing players.json`);
  assert.ok(boardRow?.pos, `${slug}: missing board pos`);

  // Simulate store thin after On3 403 (ATH + no measurements)
  const thin = applyEditorialPositionToPlayer({
    slug,
    classYear: 2028,
    pos: 'ATH',
    position: 'ATH',
    school: local.school,
  });

  assert.ok(!isWeakPosition(thin.pos), `${slug}: pos still weak (${thin.pos})`);
  assert.equal(String(thin.pos).toUpperCase(), String(boardRow.pos).toUpperCase());

  const htWt = thin.htWt || local.htWt || boardRow.htWt;
  const skinny = thin.skinny || local.skinny || boardRow.skinny;
  assert.ok(htWt && String(htWt).trim(), `${slug}: missing htWt`);
  assert.ok(skinny && String(skinny).trim(), `${slug}: missing skinny`);
  assert.ok(Number(local.stars || thin.stars || boardRow.stars) > 0, `${slug}: missing stars`);

  return {
    slug,
    pos: thin.pos,
    htWt: String(htWt),
    skinny: String(skinny).slice(0, 80),
    stars: Number(local.stars || thin.stars || boardRow.stars),
    ok: true,
  };
}

const results = REQUIRED.map(auditSlug);
const out = {
  generatedAt: new Date().toISOString(),
  ok: results.every((r) => r.ok),
  results,
};
console.log(JSON.stringify(out, null, 2));
if (!out.ok) process.exit(1);
