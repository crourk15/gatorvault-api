'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('andre-alexander vault film desk', () => {
  it('War Room carries deep Eval + Kwon Comp + Florida Y2–3 / All-SEC projection', () => {
    const { getVaultScoutingForSlug } = require('../../lib/recruiting-hub-elite');
    const scouting = getVaultScoutingForSlug('andre-alexander');
    assert.ok(scouting);
    const evaluation = String(scouting.evaluation || '');
    assert.ok(evaluation.length > 280, 'Eval must be multi-sentence depth');
    assert.match(evaluation, /second-level|wrap|boundary|on film/i);
    assert.doesNotMatch(evaluation, /sophomore|freshman reel|hudl/i);
    assert.match(String(scouting.comparison || ''), /Kwon Alexander/);
    const projection = String(scouting.projection || '');
    assert.match(projection, /Year 2.?3|All-SEC/i);
    assert.match(projection, /not a day-one|day.one/i);
  });
});
