'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('full-profile vaultScouting', () => {
  it('attaches Evaluation / Comp / Projection from War Room for Hiller', () => {
    const { getVaultScoutingForSlug } = require('../../lib/recruiting-hub-elite');
    const scouting = getVaultScoutingForSlug('maxwell-hiller');
    assert.ok(scouting, 'vaultScouting present');
    assert.match(String(scouting.evaluation || ''), /Hiller|interior|mass/i);
    assert.match(String(scouting.comparison || ''), /DeCastro/);
    assert.match(String(scouting.projection || ''), /SEC starter|All-American|All-SEC/i);
  });

  it('2028 targets match Pearl card shape (lead + On tape + Comp + Year/Ceiling projection)', () => {
    const { getVaultScoutingForSlug } = require('../../lib/recruiting-hub-elite');
    const scouting = getVaultScoutingForSlug('asher-ghioto');
    assert.ok(scouting, 'asher vaultScouting present');
    assert.match(String(scouting.evaluation || ''), /Ghioto is a long/i);
    assert.doesNotMatch(String(scouting.evaluation || ''), /Vault film desk/i);
    assert.ok((scouting.strengths || []).length >= 3);
    assert.match(String(scouting.comparison || ''), /Burns/i);
    assert.match(String(scouting.projection || ''), /Year 2 SEC starter/i);
    assert.match(String(scouting.projection || ''), /Ceiling:/i);
  });

  it('commit board: short commit line like 2026 — Vault Scouting on profile only', async () => {
    const { buildHubCommits, getVaultScoutingForSlug } = require('../../lib/recruiting-hub-elite');
    const rows = await buildHubCommits(2027);
    const hiller = rows.find((r) => r.id === 'maxwell-hiller' || /Hiller/i.test(r.name));
    assert.ok(hiller, 'hiller on 2027 board');
    const skinny = String(hiller.skinny || '');
    assert.match(skinny, /committed to Florida/i);
    assert.doesNotMatch(skinny, /^Vault Eval\b/i);
    // No mini-eval on the card surface.
    assert.doesNotMatch(skinny, /college-ready interior|true 300-pound mass/i);
    assert.equal(hiller.playerComp, null);
    assert.equal(hiller.projection, null);
    assert.equal(hiller.strengths, null);
    const meta = String(hiller.metaLine || hiller.rankNote || '');
    assert.match(meta, /IOL|#\d+\s*natl/i);
    assert.match(meta, /#\d+\s*natl/i);
    assert.match(meta, /#\d+\s*IOL/i);
    assert.match(meta, /#\d+\s*PA/i);
    // Scouting vault remains on the player profile.
    const scouting = getVaultScoutingForSlug('maxwell-hiller');
    assert.match(String(scouting?.comparison || ''), /DeCastro/);
    assert.match(String(scouting?.projection || ''), /SEC starter|All-American|All-SEC/i);
    assert.match(String(scouting?.evaluation || ''), /Hiller|interior|mass/i);
  });

  it('2026 and 2027 commit cards share the same surface shape', async () => {
    const { buildHubCommits } = require('../../lib/recruiting-hub-elite');
    const y26 = await buildHubCommits(2026);
    const y27 = await buildHubCommits(2027);
    const groce = y26.find((r) => /Groce/i.test(r.name));
    const pearl = y27.find((r) => /Pearl/i.test(r.name));
    assert.ok(groce && pearl);
    assert.match(String(groce.skinny || ''), /committed to Florida/i);
    assert.match(String(pearl.skinny || ''), /committed to Florida/i);
    assert.equal(groce.playerComp, null);
    assert.equal(pearl.playerComp, null);
    assert.equal(groce.projection, null);
    assert.equal(pearl.projection, null);
  });
});
