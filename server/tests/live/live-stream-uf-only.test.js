'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const prefilter = require('../../lib/beat-intel-prefilter');
const publicAlerts = require('../../lib/recruiting-public-alerts');

describe('Live Stream UF football-only', () => {
  it('blocks generic Trace Hawkins recruiting intel with no UF signal', () => {
    const intel = {
      playerName: 'Trace Hawkins',
      playerSlug: 'trace-hawkins',
      identityConfirmed: true,
      eventType: 'staff_note',
      status: 'Recruiting intel',
      detail: 'Chad Simmons watched Trace Hawkins at Calhoun HS; commitment Thursday.',
      source: 'auto:beat',
    };
    assert.equal(prefilter.shouldSurfaceRecruitingIntelSync(intel), false);
    assert.equal(prefilter.intelHasUfFootballContext(intel), false);
  });

  it('allows UF visit intel for a recruit with Florida context', () => {
    const intel = {
      playerName: 'Trace Hawkins',
      playerSlug: 'trace-hawkins',
      identityConfirmed: true,
      eventType: 'unofficial_visit',
      status: 'Unofficial Visit',
      detail: 'Unofficial visit to Florida on 2025-04-08',
      fingerprint: 'visit|trace-hawkins|florida|unofficial_visit|2025-04-08',
      source: 'on3',
    };
    assert.equal(prefilter.shouldSurfaceRecruitingIntelSync(intel), true);
  });

  it('blocks beat feed rows for national non-UF posts', () => {
    const item = {
      type: 'beat',
      title:
        'Chad Simmons: Spent time at Calhoun HS today, and a lot of eyes are on 2028 4-star QB Trace Hawkins.',
      summary:
        'Spent time at Calhoun HS today, and a lot of eyes are on 2028 4-star QB Trace Hawkins. He will announce his commitment on Thursday.',
      source: 'x',
      author: 'Chad Simmons',
      meta: { handle: 'chadsimmons_', outlet: 'On3' },
      source_url: 'https://www.on3.com/rivals/trace-hawkins-247268/',
    };
    assert.equal(publicAlerts.isPublicLiveFeedItem(item), false);
  });

  it('allows beat feed rows with explicit Florida football context', () => {
    const item = {
      type: 'beat',
      title: 'Chad Simmons: Florida is in a strong spot for 2028 QB Trace Hawkins after his Gainesville visit.',
      summary: 'Florida is in a strong spot for 2028 QB Trace Hawkins after his Gainesville visit.',
      source: 'x',
      author: 'Chad Simmons',
      meta: { handle: 'chadsimmons_', outlet: 'On3' },
    };
    assert.equal(publicAlerts.isPublicLiveFeedItem(item), true);
  });

  it('blocks generic Player — Recruiting intel feed cards without UF signal', () => {
    const item = {
      type: 'visit',
      title: 'Trace Hawkins — Recruiting intel',
      summary: 'National recruiting chatter',
      source: 'on3',
      meta: { eventType: 'staff_note', playerSlug: 'trace-hawkins' },
    };
    assert.equal(publicAlerts.isPublicLiveFeedItem(item), false);
  });
});
