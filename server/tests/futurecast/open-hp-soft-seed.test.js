'use strict';

require('tsx/cjs');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

describe('Open Class HP soft seed (2028 targets / Priority Chase)', () => {
  it('softOpenClassHighPriorityFromSeed returns allowlist open hunts', () => {
    const { softOpenClassHighPriorityFromSeed } = require('../../api/futurecast/high-priority.ts');
    const soft = softOpenClassHighPriorityFromSeed(2028);
    assert.equal(soft.degraded, 'open_seed');
    assert.equal(soft.classYear, 2028);
    assert.ok(Array.isArray(soft.players) && soft.players.length >= 20);
    assert.equal(
      soft.players.every((p) => !p.committedTo),
      true,
      'Open Class soft plate players must be open hunts only'
    );
  });

  it('high-priority GET wires softOnDeferred for Open Class 2028', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'high-priority.ts'),
      'utf8'
    );
    assert.match(src, /softOpenClassHighPriorityFromSeed/);
    assert.match(src, /open_seed/);
    assert.match(src, /isUnderclassmenHighPriorityYear/);
  });
});
