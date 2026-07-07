const test = require('node:test');
const assert = require('node:assert/strict');

const detectivesElite = require('../../lib/autoposter/detectives-elite-compose');
const { GOLDEN_MATRIX } = require('../../lib/autoposter/golden-recruiting-matrix');

test('composeDetectivesEliteCase returns elite for golden Merrick Ham beat', async () => {
  const fixture = GOLDEN_MATRIX.find((row) => row.specSlug === 'merrick-ham');
  assert.ok(fixture);
  const out = await detectivesElite.composeDetectivesEliteCase({
    slug: fixture.slug,
    hints: { beatText: fixture.beatText },
    identity: {
      playerSlug: fixture.slug,
      playerName: fixture.playerName,
      classYear: fixture.classYear,
      pos: fixture.pos
    }
  });
  assert.equal(out.outcome, 'elite');
  assert.equal(out.ok, true);
  assert.ok(out.candidate?.text);
  assert.ok(out.dominantAngle);
  assert.equal(out.qa.pass, true);
});

test('composeDetectivesEliteCase archives thin beat without enqueue', async () => {
  const out = await detectivesElite.composeDetectivesEliteCase({
    slug: 'thin-prospect',
    hints: { beatText: 'Florida is tracking this prospect quietly.' },
    identity: { playerSlug: 'thin-prospect', playerName: 'Thin Prospect', classYear: 2028, pos: 'WR' }
  });
  assert.equal(out.outcome, 'archived_with_gaps');
  assert.equal(out.ok, false);
  assert.equal(out.qa.pass, false);
});