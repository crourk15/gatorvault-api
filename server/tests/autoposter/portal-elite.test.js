/** Portal elite compose — portal_in / portal_out / portal_landing golden beats. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { composePortalElitePost, THIN_FALLBACK_RE, eliteComposeEnabled } = require('../../lib/autoposter/portal/portal-compose');
const { extractPortalFacts } = require('../../lib/autoposter/portal/portal-fact-extractor');
const { computePortalDedupeKey } = require('../../lib/autoposter/portal/portal-dedupe');
const { passesPortalDetectionGate, validatePortalCompose } = require('../../lib/autoposter/portal/portal-gates');

const PORTAL_IN_BEAT =
  'Jayden Daniels entered the transfer portal — Florida among programs tracking per the beat report.';
const PORTAL_OUT_BEAT =
  'DJ Lagway entered the transfer portal from the Florida roster, staff source confirms.';
const PORTAL_LANDING_BEAT =
  'Former Georgia QB Carson Beck is transferring to Florida via the portal, per On3.';
const RUMOR_BEAT =
  'Hearing rumors a portal name could land at Florida — nothing confirmed yet.';

test('elite compose enabled unless env disables', () => {
  assert.equal(eliteComposeEnabled(), process.env.X_AUTOPOST_PORTAL_ELITE_COMPOSE !== 'false');
});

test('portal_in golden compose', () => {
  const facts = extractPortalFacts(PORTAL_IN_BEAT, { portalEventType: 'portal_in' });
  assert.equal(facts.player_name, 'Jayden Daniels');
  const built = composePortalElitePost({
    beatText: PORTAL_IN_BEAT,
    source: 'Beat intel',
    portalEventType: 'portal_in',
    playerName: 'Jayden Daniels'
  });
  assert.equal(built.ok, true, built.reason || JSON.stringify(built));
  assert.equal(built.arc, 'portal_in');
  assert.match(built.text, /Portal · UF target/i);
  assert.match(built.text, /Jayden Daniels/i);
  assert.match(built.text, /transfer portal/i);
  assert.doesNotMatch(built.text, THIN_FALLBACK_RE);
  assert.ok(computePortalDedupeKey(built.facts));
});

test('portal_out golden compose', () => {
  const built = composePortalElitePost({
    beatText: PORTAL_OUT_BEAT,
    source: 'Beat intel',
    portalEventType: 'portal_out',
    playerName: 'DJ Lagway'
  });
  assert.equal(built.ok, true, built.reason || JSON.stringify(built));
  assert.equal(built.arc, 'portal_out');
  assert.match(built.text, /Portal · UF exit/i);
  assert.match(built.text, /DJ Lagway/i);
});

test('portal_landing golden compose', () => {
  const built = composePortalElitePost({
    beatText: PORTAL_LANDING_BEAT,
    source: 'On3',
    portalEventType: 'portal_landing',
    playerName: 'Carson Beck'
  });
  assert.equal(built.ok, true, built.reason || JSON.stringify(built));
  assert.equal(built.arc, 'portal_landing');
  assert.match(built.text, /Portal · Florida/i);
  assert.match(built.text, /Carson Beck/i);
  assert.match(built.text, /transferring to Florida/i);
});

test('rumor blocked', () => {
  const gate = passesPortalDetectionGate(RUMOR_BEAT);
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, 'rumor_blocked');
  const built = composePortalElitePost({ beatText: RUMOR_BEAT, source: 'Beat intel', playerName: 'Test Player' });
  assert.equal(built.ok, false);
});

test('THIN_FALLBACK blocks legacy portal one-liner', () => {
  const legacy = 'Entered the transfer portal; Florida is among the programs tracking.';
  assert.equal(validatePortalCompose(legacy).ok, false);
});