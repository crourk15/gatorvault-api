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

  it('commit board: untitled brief only — Vault Comp/Projection on profile, not card', async () => {
    const { buildHubCommits, getVaultScoutingForSlug } = require('../../lib/recruiting-hub-elite');
    const rows = await buildHubCommits(2027);
    const hiller = rows.find((r) => r.id === 'maxwell-hiller' || /Hiller/i.test(r.name));
    assert.ok(hiller, 'hiller on 2027 board');
    const skinny = String(hiller.skinny || '');
    assert.ok(skinny.length >= 40, 'brief present');
    assert.doesNotMatch(skinny, /^Vault Eval\b/i);
    // Card surface matches 2028: no Vault Comp / Projection slots.
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
  });
});
