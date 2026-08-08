'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const warRoom = require('../../lib/war-room-store');
const scout = require('../../lib/scouting-database');
const { getVaultScoutingForSlug } = require('../../lib/recruiting-hub-elite');

describe('film-desk Pearl protection', () => {
  it('syncEntryToBreakdown does not clobber Harris-Payne film card', () => {
    const before = warRoom.getBreakdownBySlug('dominick-harris-payne');
    assert.ok(before?.comparison);
    assert.ok(getVaultScoutingForSlug('dominick-harris-payne'));

    const after = scout.syncEntryToBreakdown({
      playerSlug: 'dominick-harris-payne',
      playerName: 'Dominick Harris-Payne',
      playerType: 'target',
      analystName: 'Beat Writer',
      outlet: 'On3',
      sourceUrl: 'https://example.com/beat',
      timestamp: new Date().toISOString(),
      scoutingSummary:
        'A long generic beat article about Florida recruiting that should never replace Vault film.',
      updates: [],
    });

    assert.equal(after.comparison, before.comparison);
    assert.ok(getVaultScoutingForSlug('dominick-harris-payne'));
  });

  it('Hudson West film card still shows', () => {
    assert.ok(getVaultScoutingForSlug('hudson-west'));
  });
});
