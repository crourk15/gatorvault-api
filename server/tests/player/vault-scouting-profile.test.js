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

  it('commit board uses Vault Eval / Comp / Projection card copy', async () => {
    const { buildHubCommits } = require('../../lib/recruiting-hub-elite');
    const rows = await buildHubCommits(2027);
    const hiller = rows.find((r) => r.id === 'maxwell-hiller' || /Hiller/i.test(r.name));
    assert.ok(hiller, 'hiller on 2027 board');
    assert.match(String(hiller.skinny || ''), /^Vault Eval —/i);
    assert.match(String(hiller.skinny || ''), /interior|mass/i);
    assert.doesNotMatch(String(hiller.skinny || ''), /Fan comp:/i);
    assert.ok(hiller.strengths, 'strengths slot');
    assert.match(String(hiller.playerComp || ''), /^Vault Comp —/i);
    assert.match(String(hiller.playerComp || ''), /DeCastro/);
    assert.match(String(hiller.projection || ''), /^Vault Projection —/i);
    assert.match(String(hiller.projection || ''), /SEC starter|All-American|All-SEC/i);
  });
});
