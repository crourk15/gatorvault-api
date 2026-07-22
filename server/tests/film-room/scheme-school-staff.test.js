const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../../../client/lib/scheme-school-data.ts');

describe('Scheme School staff accuracy', () => {
  const src = fs.readFileSync(SRC, 'utf8');

  it('credits Phil Trautwein on OL Technique (not Robbie)', () => {
    assert.match(src, /Phil Trautwein — Offensive Line/);
    assert.doesNotMatch(src, /Robbie Trautwein/);
  });

  it('uses current Sumrall staff names only', () => {
    const forbidden = [
      'Robbie Trautwein',
      'A.J. Craddock',
      'Tim Chatman',
      'Mike Whitt',
      'Cormani Collins',
      'Will Harris',
      "Napier's",
    ];
    for (const bad of forbidden) {
      assert.equal(src.includes(bad), false, `stale staff label still present: ${bad}`);
    }
    for (const good of [
      'Phil Trautwein',
      'Joe Craddock',
      'Evan McKissack',
      'Gerald Chatman',
      'Bam Hardmon',
      'Chris Collins',
      'Brandon Harris',
      'Rusty Whitt',
      'Greg Gasparato',
    ]) {
      assert.ok(src.includes(good), `missing expected staff: ${good}`);
    }
  });
});
