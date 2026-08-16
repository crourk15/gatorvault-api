/**
 * Beat Desk: block subscribe promos; keep real team/staff/camp as hub topics.
 * Run: node --test server/test/beat-desk-block-promos.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isValidPlayerName } = require('../lib/x-autoposter-player-context');
const { isSubscribePromoIntel, isTeamEventIntel } = require('../lib/beat-intel-prefilter');
const { extractPlayerFromText } = require('../lib/x-autoposter-copy');
const {
  classifyHubDeskBeat,
  isHubDeskSlug,
  hubDeskSlug,
} = require('../lib/hub-desk-topics');
const { buildHubDeskBrief } = require('../lib/beat-brief-packet');

const PROMO = `FALL CAMP is almost here. Right now, you can join Gators Online for $1

You'll get ...
✅Complete preseason coverage
✅Elite team/recruiting intel
✅Transfer Portal movement
✅Message Board
+ full year of access to The Athletic

JOIN TODAY! https://t.co/RylV3nG7qF`;

const REAL_CAMP = 'Fall camp is almost here for the Gators. First practice sets the tone for September.';
const REAL_STAFF = 'Florida has hired a new defensive coordinator and the staff room is reshaping fast.';

describe('Beat Desk promo vs hub topics', () => {
  it('rejects subscribe CTA headers as player names', () => {
    assert.equal(isValidPlayerName('FINAL DAYS'), false);
    assert.equal(isValidPlayerName('DEAL ENDS SOON'), false);
    assert.equal(isValidPlayerName('JOIN GO'), false);
    assert.equal(isValidPlayerName('App Store'), false);
    assert.equal(isValidPlayerName('INSIDER NOTES'), false);
    assert.equal(isValidPlayerName('LIVE CHAT'), false);
    assert.equal(isValidPlayerName('SIGN UP'), false);
    assert.equal(isValidPlayerName('Prince Avenue Christian'), false);
    assert.equal(isValidPlayerName('Tyree Mannings Jr'), true);
    assert.equal(extractPlayerFromText('FINAL DAYS to join Gators Online for $1'), null);
  });

  it('rejects FALL CAMP / Transfer Portal as player names', () => {
    assert.equal(isValidPlayerName('FALL CAMP'), false);
    assert.equal(isValidPlayerName('Transfer Portal'), false);
    assert.equal(extractPlayerFromText(PROMO), null);
  });

  it('blocks Athletic $1 soft-sell from hub classification', () => {
    assert.equal(isSubscribePromoIntel(PROMO), true);
    assert.equal(classifyHubDeskBeat(PROMO), null);
  });

  it('routes real fall camp / staff beats to TEAM hub slugs', () => {
    assert.equal(isTeamEventIntel(REAL_CAMP), true);
    const camp = classifyHubDeskBeat(REAL_CAMP);
    assert.ok(camp);
    assert.equal(camp.deskKind, 'team');
    assert.equal(camp.playerSlug, hubDeskSlug('team', camp.topicType));
    assert.match(camp.playerName, /camp|practice|Team/i);
    assert.ok(isHubDeskSlug(camp.playerSlug));

    const staff = classifyHubDeskBeat(REAL_STAFF);
    assert.ok(staff);
    assert.equal(staff.deskKind, 'team');
    assert.match(staff.topicType, /staff|general/);
  });

  it('builds a hub brief without FutureCast thin_board', async () => {
    const brief = await buildHubDeskBrief('uf-team-camp');
    assert.equal(brief.ok, true);
    assert.equal(brief.hubTopic, true);
    assert.match(brief.pasteText, /HUB BRIEF|team \/ program/i);
    assert.match(brief.pasteText, /n\/a — hub team\/program/i);
    assert.doesNotMatch(brief.pasteText, /thin_board/);
  });
});
