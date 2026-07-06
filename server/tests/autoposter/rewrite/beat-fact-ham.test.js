/** Beat-fact extraction + facts-only PR-789 — Ham proof case. */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractBeatFacts,
  selectAngleFromFacts,
  composeFromFacts
} = require('../../../lib/autoposter/rewrite/beat-fact-extractor');
const { resolveValidCompSchools } = require('../../../lib/autoposter/rewrite/comp-sourcing');
const { validateBannedPhrases, hasFactCompletenessForPr789 } = require('../../../lib/autoposter/rewrite/fact-gates');
const { GOLDEN_BEATS } = require('../fixtures/golden-beats');

const HAM_BEAT = GOLDEN_BEATS.find((b) => b.id === 'ham');

test('comp sourcing rejects high school and keeps Auburn/Vanderbilt', () => {
  const pack = resolveValidCompSchools({
    beatText: HAM_BEAT.beatText,
    metrics: HAM_BEAT.metrics,
    player: HAM_BEAT.player,
    intel: { competitors: [{ school: 'Marietta' }] }
  });
  assert.deepEqual(pack.schools, ['Auburn', 'Vanderbilt']);
  assert.equal(pack.schools.includes('Marietta'), false);
});

test('comp sourcing keeps Purdue and rejects high school names', () => {
  const pack = resolveValidCompSchools({
    metrics: {
      rpmTop: [
        { school: 'Purdue', pct: 23 },
        { school: 'Louisville', pct: 9.4 },
        { school: 'Tennessee', pct: 7.9 }
      ]
    },
    player: { school: 'IMG Academy', state: 'FL' }
  });
  assert.deepEqual(
    pack.rpmTop.map((r) => r.school),
    ['Purdue', 'Louisville', 'Tennessee']
  );
});

test('Ham beat extracts staff energy, quote, visit, and rpmTop', () => {
  const facts = extractBeatFacts(HAM_BEAT.beatText, {
    metrics: HAM_BEAT.metrics,
    player: HAM_BEAT.player
  });
  assert.equal(facts.staffEnergy, true);
  assert.match(facts.quote, /loved the energy/i);
  assert.equal(facts.visit?.when, 'early March');
  assert.equal(facts.followUpSince, 'June 15');
  assert.deepEqual(
    facts.rpmTop.map((r) => r.school),
    ['Auburn', 'Vanderbilt']
  );
  assert.equal(hasFactCompletenessForPr789(facts), true);
});

test('Ham angle is staff/energy not competition', () => {
  const facts = extractBeatFacts(HAM_BEAT.beatText, {
    metrics: HAM_BEAT.metrics,
    player: HAM_BEAT.player
  });
  const pick = selectAngleFromFacts(facts, HAM_BEAT.beatText);
  assert.equal(pick.angle, 'staff');
});

test('Ham elite insider paragraph matches editorial flow', () => {
  const facts = extractBeatFacts(HAM_BEAT.beatText, {
    metrics: HAM_BEAT.metrics,
    player: HAM_BEAT.player
  });
  const pick = selectAngleFromFacts(facts, HAM_BEAT.beatText);
  const out = composeFromFacts(facts, pick, { lastName: 'Ham' }, { mode: 'elite' });
  const banned = validateBannedPhrases(out.narrative);
  assert.equal(banned.ok, true, JSON.stringify(banned.violations));
  assert.match(out.narrative, /early March/i);
  assert.match(out.narrative, /— he said he loved the energy he saw from UF staff\./);
  assert.match(out.narrative, /That same pitch has only picked up since June 15/i);
  assert.match(out.narrative, /lead his RPM board/i);
  assert.match(out.narrative, /staff sell is landing/i);
  assert.doesNotMatch(out.narrative, /face time|Marietta|lane widening/i);
});

test('Ham dual-mode quote paraphrase avoids first-person I saw', () => {
  const facts = extractBeatFacts(HAM_BEAT.beatText, {
    metrics: HAM_BEAT.metrics,
    player: HAM_BEAT.player
  });
  const pick = selectAngleFromFacts(facts, HAM_BEAT.beatText);
  const out = composeFromFacts(facts, pick, { lastName: 'Ham' }, { mode: 'dual' });
  assert.match(out.narrative1, /loved the energy he saw from UF staff/i);
  assert.doesNotMatch(out.narrative1, /that I saw/i);
  assert.match(out.narrative2, /June 15/i);
  assert.match(out.narrative2, /Auburn and Vanderbilt/i);
});

test('Ham facts-only copy avoids banned filler and mentions real rivals', () => {
  const facts = extractBeatFacts(HAM_BEAT.beatText, {
    metrics: HAM_BEAT.metrics,
    player: HAM_BEAT.player
  });
  const pick = selectAngleFromFacts(facts, HAM_BEAT.beatText);
  const out = composeFromFacts(facts, pick, { lastName: 'Ham' }, { mode: 'single', compact: false });
  const banned = validateBannedPhrases(out.narrative);
  assert.equal(banned.ok, true, JSON.stringify(banned.violations));
  assert.match(out.narrative, /early March/i);
  assert.match(out.narrative, /loved the energy|energy he saw/i);
  assert.match(out.narrative, /June 15/i);
  assert.match(out.narrative, /Auburn and Vanderbilt/i);
  assert.doesNotMatch(out.narrative, /Marietta/i);
  assert.doesNotMatch(out.narrative, /face time/i);
  assert.doesNotMatch(out.narrative, /lane widening/i);
});

const DRAKEFORD_BEAT = GOLDEN_BEATS.find((b) => b.id === 'drakeford');

test('Drakeford beat extracts quote and board signal from Swamp visit beat', () => {
  const facts = extractBeatFacts(DRAKEFORD_BEAT.beatText, {
    metrics: DRAKEFORD_BEAT.metrics,
    player: DRAKEFORD_BEAT.player
  });
  assert.match(facts.quote, /top of my board/i);
  assert.equal(facts.boardSignal, true);
  assert.equal(facts.visit?.school, 'Florida');
  const pick = selectAngleFromFacts(facts, DRAKEFORD_BEAT.beatText);
  assert.equal(pick.angle, 'visit');
});

test('Drakeford elite visit arc keeps Swamp hook and embeds beat quote', () => {
  const facts = extractBeatFacts(DRAKEFORD_BEAT.beatText, {
    metrics: DRAKEFORD_BEAT.metrics,
    player: DRAKEFORD_BEAT.player
  });
  const pick = selectAngleFromFacts(facts, DRAKEFORD_BEAT.beatText);
  const out = composeFromFacts(
    facts,
    pick,
    { lastName: 'Drakeford', beatText: DRAKEFORD_BEAT.beatText },
    { mode: 'elite' }
  );
  const banned = validateBannedPhrases(out.narrative);
  assert.equal(banned.ok, true, JSON.stringify(banned.violations));
  assert.match(out.narrative, /first trip to The Swamp/i);
  assert.match(out.narrative, /he said Florida is one of those schools at the top of my board\./);
  assert.doesNotMatch(out.narrative, /he said he "Florida/i);
  assert.doesNotMatch(out.narrative, /campus connection is real/i);
  assert.doesNotMatch(out.narrative, /left with the Gators on his board early/i);
});

const ROBINSON_BEAT = GOLDEN_BEATS.find((b) => b.id === 'robinson');

test('Robinson beat extracts staff contact, visit, and board signal — not staff energy', () => {
  const facts = extractBeatFacts(ROBINSON_BEAT.beatText, {
    metrics: ROBINSON_BEAT.metrics,
    player: ROBINSON_BEAT.player
  });
  assert.equal(facts.staffContact, true);
  assert.equal(facts.staffEnergy, false);
  assert.equal(facts.visit?.when, 'his first Gainesville visit');
  assert.equal(facts.boardSignal, true);
  assert.doesNotMatch(String(facts.quote || ''), /^all three\.?$/i);
  const pick = selectAngleFromFacts(facts, ROBINSON_BEAT.beatText);
  assert.equal(pick.angle, 'staff_contact');
  assert.equal(hasFactCompletenessForPr789(facts, ROBINSON_BEAT.beatText), true);
});

test('Robinson elite staff-contact arc uses DB coach signal — no energy filler or quote fragment', () => {
  const facts = extractBeatFacts(ROBINSON_BEAT.beatText, {
    metrics: {
      ...ROBINSON_BEAT.metrics,
      ufRpmPct: 20.2,
      rpmTop: [
        { school: 'Purdue', pct: 23.1 },
        { school: 'Louisville', pct: 9.4 }
      ]
    },
    player: ROBINSON_BEAT.player
  });
  const pick = selectAngleFromFacts(facts, ROBINSON_BEAT.beatText);
  const out = composeFromFacts(
    facts,
    pick,
    { lastName: 'Robinson', beatText: ROBINSON_BEAT.beatText },
    { mode: 'elite' }
  );
  const banned = validateBannedPhrases(out.narrative);
  assert.equal(banned.ok, true, JSON.stringify(banned.violations));
  assert.match(out.narrative, /first trip to Gainesville/i);
  assert.match(out.narrative, /all three DB coaches on UF's staff have been in contact/i);
  assert.match(out.narrative, /Purdue leads his RPM board, but Florida is second at 20%/i);
  assert.doesNotMatch(out.narrative, /Louisville and Tennessee lead his RPM board/i);
  assert.match(out.narrative, /staff attention is real/i);
  assert.doesNotMatch(out.narrative, /staff energy is still the story/i);
  assert.doesNotMatch(out.narrative, /staff pitch is resonating/i);
  assert.doesNotMatch(out.narrative, /he said he "all three/i);
  assert.doesNotMatch(out.narrative, /"all three\./i);
});

test('Drakeford elite visit arc appends RPM rivals when rpmTop is present', () => {
  const facts = extractBeatFacts(DRAKEFORD_BEAT.beatText, {
    metrics: {
      ...DRAKEFORD_BEAT.metrics,
      rpmTop: [
        { school: 'Auburn', pct: 24 },
        { school: 'Georgia Tech', pct: 19 }
      ]
    },
    player: DRAKEFORD_BEAT.player
  });
  const pick = selectAngleFromFacts(facts, DRAKEFORD_BEAT.beatText);
  const out = composeFromFacts(
    facts,
    pick,
    { lastName: 'Drakeford', beatText: DRAKEFORD_BEAT.beatText },
    { mode: 'elite' }
  );
  assert.match(out.narrative, /Auburn and Georgia Tech lead his RPM board/i);
  assert.match(out.narrative, /he said Florida is one of those schools at the top of my board\./);
  assert.match(out.narrative, /clearly in the picture after that first look/i);
});

test('Swamp visit without quote still uses board fallback line', () => {
  const beat =
    'Florida made a big impression on 2028 safety Ryan Drakeford during his first trip to The Swamp.';
  const facts = extractBeatFacts(beat, { metrics: {}, player: DRAKEFORD_BEAT.player });
  const pick = selectAngleFromFacts(facts, beat);
  const out = composeFromFacts(
    facts,
    pick,
    { lastName: 'Drakeford', beatText: beat },
    { mode: 'elite' }
  );
  assert.match(out.narrative, /left with the Gators on his board early/i);
  assert.doesNotMatch(out.narrative, /he said he/i);
});

const WILLINGHAM_BEAT = GOLDEN_BEATS.find((b) => b.id === 'willingham');

test('Willingham beat extracts spring practice visit, quote, and board signal', () => {
  const facts = extractBeatFacts(WILLINGHAM_BEAT.beatText, {
    metrics: WILLINGHAM_BEAT.metrics,
    player: WILLINGHAM_BEAT.player
  });
  assert.match(facts.quote, /Definitely one of my top schools/i);
  assert.equal(facts.visit?.when, 'this spring');
  assert.equal(facts.boardSignal, true);
  const pick = selectAngleFromFacts(facts, WILLINGHAM_BEAT.beatText);
  assert.equal(pick.angle, 'board');
  assert.equal(hasFactCompletenessForPr789(facts, WILLINGHAM_BEAT.beatText), true);
});

test('Willingham elite board arc embeds quote and spring practice context', () => {
  const facts = extractBeatFacts(WILLINGHAM_BEAT.beatText, {
    metrics: {
      ...WILLINGHAM_BEAT.metrics,
      rpmTop: [
        { school: 'Penn State', pct: 25 },
        { school: 'Maryland', pct: 20 }
      ]
    },
    player: WILLINGHAM_BEAT.player
  });
  const pick = selectAngleFromFacts(facts, WILLINGHAM_BEAT.beatText);
  const out = composeFromFacts(
    facts,
    pick,
    { lastName: 'Willingham', beatText: WILLINGHAM_BEAT.beatText },
    { mode: 'elite' }
  );
  const banned = validateBannedPhrases(out.narrative);
  assert.equal(banned.ok, true, JSON.stringify(banned.violations));
  assert.match(out.narrative, /spring practice visit/i);
  assert.match(out.narrative, /Definitely one of my top schools/i);
  assert.match(out.narrative, /Penn State and Maryland lead his RPM board/i);
  assert.doesNotMatch(out.narrative, /positioned early in this cycle/i);
});
