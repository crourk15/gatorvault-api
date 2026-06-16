const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseBeatPostForVisitIntel } = require('../../lib/beat-writer-ingest');
const { matchIntelToPlayer } = require('../../lib/autoposter/identity-matcher');
const { isEligibleIntel } = require('../../lib/autoposter/autoposter-policy');
const { enrichContext } = require('../../lib/autoposter/context-enrichment');
const { rewriteIntel } = require('../../lib/autoposter/rewrite-engine');

const BEAT_TWEET =
  '2027 WR Easton Royal will take an official visit to Florida from June 11–13.';

describe('Easton Royal official visit flow', () => {
  it('parses Corey/Tyler beat tweet into structured intel row', () => {
    const row = parseBeatPostForVisitIntel(
      {
        text: BEAT_TWEET,
        handle: 'ttjharden8',
        writerName: 'Tyler',
        publishedAt: '2026-06-10T12:00:00.000Z',
        id: 'test-easton-ov'
      },
      { logSkips: false }
    );

    assert.ok(row, 'expected beat row');
    assert.equal(row.playerName, 'Easton Royal');
    assert.equal(row.classYear, 2027);
    assert.equal(row.pos, 'WR');
    assert.equal(row.eventType, 'official_visit');
    assert.equal(row.visitDates, '2026-06-11 to 2026-06-13');
    assert.equal(row.sourceHandle, 'ttjharden8');
    assert.equal(row.ufRelevant, true);
    assert.match(row.text, /official visit/i);
  });

  it('matches intel to roster player and passes autoposter eligibility', () => {
    const intel = {
      playerName: 'Easton Royal',
      playerSlug: 'easton-royal',
      classYear: 2027,
      pos: 'WR',
      eventType: 'official_visit',
      visitDates: '2026-06-11 to 2026-06-13',
      ufRelevant: true,
      text: BEAT_TWEET,
      sourceType: 'beat',
      isDuplicate: false
    };

    const player = matchIntelToPlayer(intel);
    assert.ok(player, 'expected player match');
    assert.equal(player.playerId, 'easton-royal');
    assert.equal(isEligibleIntel(intel, player), true);
  });

  it('enriches context and produces GM2 insider rewrite', async () => {
    const player = matchIntelToPlayer({
      playerName: 'Easton Royal',
      playerSlug: 'easton-royal',
      classYear: 2027
    });
    const intel = {
      eventType: 'official_visit',
      visitDates: '2026-06-11 to 2026-06-13',
      visitStart: '2026-06-11',
      visitEnd: '2026-06-13',
      text: BEAT_TWEET
    };

    const context = enrichContext(player, intel);
    assert.equal(context.visitType, 'official_visit');
    assert.ok(context.visitDates);

    const rewrite = await rewriteIntel(player, context, intel);
    assert.equal(rewrite.quality.ok, true);
    assert.match(rewrite.text, /UF/i);
    assert.match(rewrite.text, /visit/i);
    assert.ok(rewrite.text.split(/\s+/).length >= 40);
  });
});
