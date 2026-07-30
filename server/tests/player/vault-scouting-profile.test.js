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

  it('commit board skinny stays short for film-desk commits', async () => {
    const { buildHubCommits } = require('../../lib/recruiting-hub-elite');
    const rows = await buildHubCommits(2027);
    const hiller = rows.find((r) => r.id === 'maxwell-hiller' || /Hiller/i.test(r.name));
    assert.ok(hiller, 'hiller on 2027 board');
    assert.ok((hiller.skinny || '').length <= 240, `skinny too long: ${hiller.skinny?.length}`);
    assert.doesNotMatch(hiller.skinny || '', /Fan comp:/i);
    assert.doesNotMatch(hiller.skinny || '', /All-American upside/i);
  });
});
