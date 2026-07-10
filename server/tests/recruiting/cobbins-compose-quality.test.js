/** Cobbins On3 team-news must surface visit intel + RPM — not generic program-pitch filler. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { composeGoldenFourFactPost } = require('../../lib/player-intelligence/golden-four-compose');
const { extractBeatFacts, selectAngleFromFacts } = require('../../lib/autoposter/rewrite/beat-fact-extractor');
const { hasFactCompletenessForPr789, validateBannedPhrases } = require('../../lib/autoposter/rewrite/fact-gates');
const store = require('../../lib/x-autoposter-store');

const COBBINS_BEAT =
  "The Florida Gators' defensive back history and coaching staff continue standing out to one of the country's top 2028 prospects.";

test('Cobbins beat text does not extract a false quote from Gators possessive', () => {
  const facts = extractBeatFacts(COBBINS_BEAT, { player: { name: 'Jermaine Cobbins' } });
  assert.equal(facts.quote, null);
  assert.equal(facts.visit, null);
  assert.equal(facts.programPitch, true);
  assert.equal(hasFactCompletenessForPr789(facts, COBBINS_BEAT), true);
  const angle = selectAngleFromFacts(facts, COBBINS_BEAT);
  assert.equal(angle.angle, 'program_pitch');
});

test('Cobbins fused compose uses April visit log — not generic DB tradition template', () => {
  const facts = extractBeatFacts(COBBINS_BEAT, {
    slug: 'jermaine-cobbins',
    player: { name: 'Jermaine Cobbins' }
  });
  assert.ok(facts.visit?.when, 'visit log should enrich Cobbins');
  assert.equal(facts.visit.source, 'visit_log');

  const built = composeGoldenFourFactPost({
    slug: 'jermaine-cobbins',
    intel: { playerName: 'Jermaine Cobbins', detail: COBBINS_BEAT, classYear: 2028, pos: 'CB' },
    playerRow: {
      name: 'Jermaine Cobbins',
      classYear: 2028,
      pos: 'CB',
      natlRank: 42,
      posRank: 4,
      stateRank: 1,
      stars: 4,
      competitors: [
        { school: 'Ohio State', pct: 22 },
        { school: 'Alabama', pct: 18 }
      ]
    },
    on3Sync: {
      rankingTokens: {
        on3Stars: 4,
        on3NationalRank: 42,
        on3PositionRank: 4,
        on3StateRank: 1
      }
    }
  });
  assert.equal(built.ok, true, built.reason || 'compose failed');
  assert.match(built.text, /Florida's campus in early April|Gainesville/i);
  assert.doesNotMatch(built.text, /DB tradition and staff pitch are standing out early/i);
  assert.match(built.text, /RPM board/i);
  assert.doesNotMatch(built.text, /campus in campus/i);
  assert.doesNotMatch(built.text, /he said he "defensive back/i);
  assert.equal(built.validationMeta?.dominantAngle, 'visit');
  assert.equal(built.validationMeta?.composePath, 'pr789_beat_facts');
  const banned = validateBannedPhrases(built.text);
  assert.equal(banned.ok, true, JSON.stringify(banned.violations));
  assert.equal(store.isThinRecruitingPostText(built.text), false);
});
