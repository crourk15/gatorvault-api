/** Recruiting narrative elite compose — golden beats. */
const test = require('node:test');
const assert = require('node:assert/strict');

const copy = require('../../lib/x-autoposter-copy');
const ingest = require('../../lib/beat-writer-ingest');
const { composeRecruitingNarrativeElitePost, eliteComposeEnabled } = require('../../lib/autoposter/recruiting-narrative/narrative-compose');
const { extractNarrativeFacts } = require('../../lib/autoposter/recruiting-narrative/narrative-fact-extractor');
const { passesNarrativeDetectionGate } = require('../../lib/autoposter/recruiting-narrative/narrative-gates');
const { isFreshOfferBeat, isRetrospectiveOfferBeat } = require('../../lib/autoposter/recruiting-offer-disambiguation');

const DION_BEAT =
  "Florida offered Top-100 prospect Dion Edwards in April. Months later, the 4-star safety says the Gators are cementing themselves as a major contender. 'That honesty has made it easy to build trust.'";
const CONTENDER_BEAT =
  '4-star WR Caleb Mitchell says Florida is cementing itself as a major contender in his recruitment, per the beat report.';
const RUMOR_BEAT =
  'Hearing rumors a recruit could lean Florida — nothing confirmed yet.';
const FRESH_OFFER_BEAT =
  'Florida just offered 2027 QB Jaylen Smith today, sources confirm the offer.';
const RETRO_QUOTE_BEAT =
  "Florida offered Dion Edwards in April. Months later he says 'That honesty has made it easy to build trust.'";
const COLLISION_BEAT =
  'Florida offered Top-100 prospect Jaylen Cole in April but re-offered today, per the beat report.';

test('elite compose enabled unless env disables', () => {
  assert.equal(eliteComposeEnabled(), process.env.X_AUTOPOST_RECRUITING_NARRATIVE_ELITE_COMPOSE !== 'false');
});

test('Dion full beat golden compose', () => {
  assert.equal(copy.extractPlayerFromText(DION_BEAT), 'Dion Edwards');
  assert.equal(ingest.resolveRecruitingEventType(DION_BEAT), 'recruiting_narrative');
  assert.equal(copy.detectBeatNewsEvent(DION_BEAT), null);
  const built = composeRecruitingNarrativeElitePost({
    beatText: DION_BEAT,
    source: 'Beat intel',
    playerName: 'Dion Edwards'
  });
  assert.equal(built.ok, true, built.reason || JSON.stringify(built));
  assert.equal(built.arc, 'trust');
  assert.match(built.text, /Dion Edwards/i);
  assert.match(built.text, /That honesty has made it easy to build trust/i);
});

test('narrative-only contender beat', () => {
  const built = composeRecruitingNarrativeElitePost({
    beatText: CONTENDER_BEAT,
    source: 'Beat intel',
    playerName: 'Caleb Mitchell'
  });
  assert.equal(built.ok, true, built.reason || JSON.stringify(built));
  assert.equal(built.arc, 'contender');
  assert.match(built.text, /Caleb Mitchell/i);
});

test('rumor blocked', () => {
  const gate = passesNarrativeDetectionGate(RUMOR_BEAT);
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, 'rumor_blocked');
});

test('fresh offer today stays offer not narrative', () => {
  assert.equal(isFreshOfferBeat(FRESH_OFFER_BEAT), true);
  assert.equal(ingest.resolveRecruitingEventType(FRESH_OFFER_BEAT), 'offer');
  assert.equal(copy.detectBeatNewsEvent(FRESH_OFFER_BEAT), 'received an offer from UF');
  const gate = passesNarrativeDetectionGate(FRESH_OFFER_BEAT, { playerName: 'Jaylen Smith' });
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, 'fresh_offer');
});

test('retrospective offer + quote routes narrative and not fresh offer line', () => {
  assert.equal(isRetrospectiveOfferBeat(RETRO_QUOTE_BEAT), true);
  assert.equal(copy.detectBeatNewsEvent(RETRO_QUOTE_BEAT), null);
  const facts = extractNarrativeFacts(RETRO_QUOTE_BEAT, { playerName: 'Dion Edwards' });
  assert.equal(facts.has_retrospective_offer, true);
  assert.ok(facts.quote);
});

test('fresh + retrospective collision fresh wins', () => {
  assert.equal(isFreshOfferBeat(COLLISION_BEAT), true);
  assert.equal(isRetrospectiveOfferBeat(COLLISION_BEAT), false);
  assert.equal(ingest.resolveRecruitingEventType(COLLISION_BEAT), 'offer');
});