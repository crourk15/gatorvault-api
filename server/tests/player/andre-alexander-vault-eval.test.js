'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('andre-alexander vault film desk', () => {
  it('War Room carries Kwon Alexander comp + Y2–3 SEC starter projection', () => {
    const { getVaultScoutingForSlug } = require('../../lib/recruiting-hub-elite');
    const scouting = getVaultScoutingForSlug('andre-alexander');
    assert.ok(scouting);
    assert.match(String(scouting.evaluation || ''), /second-level|wrap|boundary/i);
    assert.match(String(scouting.comparison || ''), /Kwon Alexander/);
    assert.match(String(scouting.projection || ''), /Year 2.?3 SEC starter|All-SEC/i);
  });
});
