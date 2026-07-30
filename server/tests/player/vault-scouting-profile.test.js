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

  it('commit board: Vault Eval/Comp/Projection, no Strengths, full rank meta', async () => {
    const { buildHubCommits } = require('../../lib/recruiting-hub-elite');
    const rows = await buildHubCommits(2027);
    const hiller = rows.find((r) => r.id === 'maxwell-hiller' || /Hiller/i.test(r.name));
    assert.ok(hiller, 'hiller on 2027 board');
    assert.match(String(hiller.skinny || ''), /^Vault Eval —/i);
    assert.match(String(hiller.playerComp || ''), /^Vault Comp —/i);
    assert.match(String(hiller.projection || ''), /^Vault Projection —/i);
    assert.equal(hiller.strengths, null);
    const meta = String(hiller.metaLine || hiller.rankNote || '');
    assert.match(meta, /IOL|#\d+\s*natl/i);
    assert.match(meta, /#\d+\s*natl/i);
    assert.match(meta, /#\d+\s*IOL/i);
    assert.match(meta, /#\d+\s*PA/i);
  });
});
