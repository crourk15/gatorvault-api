/** G3 — Golden recruiting acceptance matrix (operator spec Groups A-D). */
const test = require('node:test');
const assert = require('node:assert/strict');

const matrix = require('../../lib/autoposter/golden-recruiting-matrix');
const { composeGoldenFourFactPost } = require('../../lib/player-intelligence/golden-four-compose');
const { extractBeatFacts, selectAngleFromFacts } = require('../../lib/autoposter/rewrite/beat-fact-extractor');
const { passesEliteRecruitingGate } = require('../../lib/autoposter/elite-recruiting-compose');

let matrixReport = null;

test('G3 golden matrix — Groups A-D for all operator slugs', async () => {
  matrixReport = await matrix.runGoldenAcceptanceMatrix();
  const bad = matrixReport.filter((row) => !row.pass);
  assert.equal(bad.length, 0, JSON.stringify(bad.map((b) => ({ slug: b.specSlug, failed: b.failed })), null, 2));
});

for (const entry of matrix.GOLDEN_MATRIX) {
  test(`G3 ${entry.specSlug} — fixture compose is elite (Group B)`, () => {
    const built = composeGoldenFourFactPost({
      slug: entry.slug,
      intel: {
        playerName: entry.playerName,
        detail: entry.beatText,
        classYear: entry.classYear,
        pos: entry.pos
      },
      on3Sync: entry.on3Sync,
      playerRow: entry.playerRow,
      composePath: 'elite_pr789'
    });
    assert.equal(built.ok, true, `${entry.specSlug}: ${built.reason || JSON.stringify(built)}`);
    const leak = matrix.assertNoLeakText(built.text);
    assert.equal(leak.ok, true, leak.reason || '');
    for (const re of entry.expectText || []) {
      assert.match(built.text, re, `${entry.specSlug} missing ${re}`);
    }
  });
}

test('G3 A-004 — thin intel detected, compose blocked', () => {
  const thin = 'UF is positioned early in this cycle for this recruit.';
  const angle = selectAngleFromFacts(
    extractBeatFacts(thin, { player: { name: 'Test Player', classYear: 2028, pos: 'LB' } }),
    thin
  );
  assert.notEqual(angle?.angle, 'head_coach_offer');
  const gate = passesEliteRecruitingGate(
    {
      ok: true,
      text: '2028 LB Test Player\nUF is positioned early in this cycle.\nfuturecast/player/test',
      playerName: 'Test Player',
      templateBlocks: {
        identity: '2028 LB Test Player',
        context: 'UF is positioned early in this cycle.',
        insider: 'Staff contact has picked up.'
      }
    },
    'test-player'
  );
  assert.equal(gate.ok, false);
});

test('G3 A-005 — identity mismatch blocked for mis-tagged Kalu beat', () => {
  const badBeat =
    'Florida didn\'t need an offer to get DL Isaac Kalubi Lukuni\'s attention.. "I really like the Gators."';
  const built = composeGoldenFourFactPost({
    slug: 'dk-kalu',
    intel: { playerName: 'DK Kalu', detail: badBeat, classYear: 2026, pos: 'DL' },
    on3Sync: {
      rankingTokens: { on3Stars: 3, on3NationalRank: 684, on3PositionRank: 73, on3StateRank: 108 },
      stars: 3,
      natlRank: 684,
      posRank: 73,
      stateRank: 108
    },
    playerRow: { name: 'DK Kalu', classYear: 2026, pos: 'DL', state: 'TX' },
    composePath: 'elite_pr789'
  });
  assert.equal(built.ok, false);
  assert.equal(built.reason, 'beat_identity_mismatch');
});