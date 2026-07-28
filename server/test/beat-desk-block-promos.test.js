/**
 * Beat Desk must not turn Athletic / Gators Online promos into player packets.
 * Run: node --test server/test/beat-desk-block-promos.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isValidPlayerName } = require('../lib/x-autoposter-player-context');
const {
  isSubscribePromoIntel,
  isGenericNonPlayerIntel,
  isTeamEventIntel,
} = require('../lib/beat-intel-prefilter');
const { extractPlayerFromText } = require('../lib/x-autoposter-copy');

const PROMO = `FALL CAMP is almost here. Right now, you can join Gators Online for $1

You'll get ...
✅Complete preseason coverage
✅Elite team/recruiting intel
✅Transfer Portal movement
✅Message Board
+ full year of access to The Athletic

JOIN TODAY! https://t.co/RylV3nG7qF`;

describe('Beat Desk promo / fall-camp guard', () => {
  it('rejects FALL CAMP as a player name', () => {
    assert.equal(isValidPlayerName('FALL CAMP'), false);
    assert.equal(isValidPlayerName('Fall Camp'), false);
    assert.equal(isValidPlayerName('Spring Practice'), false);
    assert.equal(isValidPlayerName('DJ Lagway'), true);
  });

  it('does not extract FALL CAMP from the Alderman promo', () => {
    assert.equal(extractPlayerFromText(PROMO), null);
  });

  it('flags Athletic / Gators Online $1 soft-sell as subscribe promo', () => {
    assert.equal(isSubscribePromoIntel(PROMO), true);
    assert.equal(isGenericNonPlayerIntel(PROMO), true);
    assert.equal(
      isSubscribePromoIntel('DJ Lagway earned a Florida offer this morning.'),
      false
    );
  });

  it('treats fall camp language as team-event (not a desk player)', () => {
    assert.equal(isTeamEventIntel('Fall camp is almost here for the Gators.'), true);
  });
});
