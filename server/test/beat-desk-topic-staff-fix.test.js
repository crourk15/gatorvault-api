/**
 * Beat Desk: coaches/promos must not become TOPIC/PLAYER rows.
 * Run: node --test server/test/beat-desk-topic-staff-fix.test.js
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resolvePlayerFromTextSync } = require('../lib/beat-recruiting-ingest-gate');
const { extractPlayerFromText, extractAllPlayerNameCandidates } = require('../lib/x-autoposter-copy');
const { isSubscribePromoIntel } = require('../lib/beat-intel-prefilter');
const { isStaffOrCoachName, isStaffPlayerSlug } = require('../lib/recruiting-staff-directory');
const { isValidPlayerName } = require('../lib/x-autoposter-player-context');

describe('Beat Desk topic staff/promo fix', () => {
  it('knows Brandon Harris / Phil Trautwein as UF staff', () => {
    assert.equal(isStaffOrCoachName('Brandon Harris'), true);
    assert.equal(isStaffOrCoachName('Phil Trautwein'), true);
    assert.equal(isStaffPlayerSlug('brandon-harris'), true);
    assert.equal(isStaffPlayerSlug('phil-trautwein'), true);
  });

  it('does not resolve coach-led 2028-class headlines to the coach', () => {
    const text =
      "Brandon Harris — UF's best bet at every spot in the 2028 class is out — and one target's commitment calendar is heating up.";
    assert.equal(extractPlayerFromText(text), null);
    assert.equal(resolvePlayerFromTextSync(text), null);
  });

  it('prefers the OT recruit over Phil Trautwein in coach-impression beats', () => {
    const text =
      'NEW: Florida OL coach Phil Trautwein made a strong first impression on 2028 OT target Jaxen Smith from Jacksonville';
    const hit = resolvePlayerFromTextSync(text);
    assert.ok(hit);
    assert.equal(hit.playerName, 'Jaxen Smith');
    assert.equal(hit.playerSlug, 'jaxen-smith');
    assert.notEqual(hit.playerSlug, 'phil-trautwein');
    const candidates = extractAllPlayerNameCandidates(text);
    assert.ok(!candidates.includes('Phil Trautwein'));
    assert.ok(candidates.includes('Jaxen Smith'));
  });

  it('blocks BEST DEAL / Gators Online affiliate promos', () => {
    const promo =
      "BEST DEAL WE'VE EVER HAD Join @GatorsOnline and get 75% off your 1st year of elite Gator coverage";
    assert.equal(isSubscribePromoIntel(promo), true);
    assert.equal(isValidPlayerName("BEST DEAL WE'VE"), false);
    assert.equal(resolvePlayerFromTextSync(promo), null);
  });

  it('blocks GatorsFB birthday tributes from becoming recruit topics', () => {
    const { isPersonalTributeIntel } = require('../lib/beat-intel-prefilter');
    const text = 'Happy Birthday 1️⃣5️⃣ @TimTebow | #GoGators https://t.co/R1ffTF8iij';
    assert.equal(isPersonalTributeIntel(text), true);
    assert.equal(isSubscribePromoIntel(text), true);
    assert.equal(isValidPlayerName('Happy Birthday'), false);
    assert.equal(extractPlayerFromText(text), null);
    assert.equal(resolvePlayerFromTextSync(text), null);
  });

  it('still resolves real named recruits', () => {
    const text = 'Florida RBs coach Chris Foster has made a great impression on 2028 RB Jacez Walton early.';
    const hit = resolvePlayerFromTextSync(text);
    assert.ok(hit);
    assert.equal(hit.playerName, 'Jacez Walton');
    assert.equal(hit.playerSlug, 'jacez-walton');
  });
});
