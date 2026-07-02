/** Detectives handoff allowlist — UF recruiting intel only. */
const test = require('node:test');
const assert = require('node:assert/strict');
const handoff = require('../../lib/autoposter/detectives-handoff');

const TORY =
  'Tory Clark (2028 DL, Woodward Academy) is at The Swamp for Friday Night Lights. Big night for UF recruiting.';
const EMMITT = 'My top 10 greatest runs — No. 1 — Emmitt Smith\'s 96-yard TD vs Georgia.';
const COREY =
  'Corey Bender (2028 IOL) has Florida in his top three after his Swamp visit. #Gators recruiting heat.';
const OREGON = 'Oregon Ducks land another commit. Ducks rolling on the trail.';

test('blocks missing_uf_context regardless of text', () => {
  assert.equal(handoff.shouldHandoff('missing_uf_context', { beatPost: { text: TORY } }), false);
});

test('blocks junk listicle beat text', () => {
  assert.equal(
    handoff.shouldHandoff('needs_resolution', { beatPost: { text: EMMITT } }),
    false
  );
});

test('allows Tory Clark Swamp FNL needs_resolution', () => {
  assert.equal(
    handoff.shouldHandoff('needs_resolution', { beatPost: { text: TORY } }),
    true
  );
});

test('allows Corey Bender no_recruiting_signal false negative', () => {
  assert.equal(
    handoff.shouldHandoff('no_recruiting_signal', { beatPost: { text: COREY } }),
    true
  );
});

test('blocks other-program commit without UF signal', () => {
  assert.equal(
    handoff.shouldHandoff('no_recruiting_signal', { beatPost: { text: OREGON } }),
    false
  );
});

test('priority ranks named UF targets above junk FIFO order', () => {
  const tory = {
    skipReason: 'needs_resolution',
    beatPost: { text: TORY },
    createdAt: '2026-06-01T00:00:00.000Z',
    attempts: 0,
    investigationLog: [],
  };
  const emmitt = {
    skipReason: 'needs_resolution',
    beatPost: { text: EMMITT },
    createdAt: '2026-05-01T00:00:00.000Z',
    attempts: 0,
    investigationLog: [],
  };
  const sorted = handoff.sortCasesForProcessing([emmitt, tory]);
  assert.equal(sorted[0], tory);
  assert.ok(handoff.casePriority(tory) > handoff.casePriority(emmitt));
});

test('isDismissibleCase flags junk pile rows', () => {
  assert.equal(handoff.isDismissibleCase({ skipReason: 'missing_uf_context', beatPost: { text: TORY } }), true);
  assert.equal(handoff.isDismissibleCase({ skipReason: 'needs_resolution', beatPost: { text: TORY } }), false);
});
