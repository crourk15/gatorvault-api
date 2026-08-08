'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { getVaultScoutingForSlug } = require('../../lib/recruiting-hub-elite');
const warRoom = require('../../lib/war-room-store');

const PROVISIONAL = [
  'chris-morillo',
  'barrett-price',
  'jamarion-davis',
  'samuel-bailey',
  'blake-mccullough',
];

describe('provisional vault scouting hidden from fans', () => {
  it('getVaultScoutingForSlug skips PROVISIONAL / filmWatched:false', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'recruiting-hub-elite.js'),
      'utf8'
    );
    assert.match(src, /PROVISIONAL/);
    assert.match(src, /filmWatched === false/);
  });

  it('five draft evals are marked provisional in vault-eval JSON', () => {
    for (const slug of PROVISIONAL) {
      const doc = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, '..', '..', 'data', 'war-room', 'vault-evals', slug + '.json'),
          'utf8'
        )
      );
      assert.equal(doc.filmWatched, false, slug);
      assert.equal(doc.provisional, true, slug);
      assert.match(String(doc.staffNotes || ''), /PROVISIONAL/i);
    }
  });

  it('provisional drafts stay hidden; Harris-Payne / West still show', () => {
    for (const slug of PROVISIONAL) {
      const bd = warRoom.getBreakdownBySlug(slug);
      assert.ok(bd, slug);
      assert.match(String(bd.staffNotes || ''), /PROVISIONAL/i);
      assert.equal(getVaultScoutingForSlug(slug), null, slug + ' must be hidden');
    }
    assert.ok(getVaultScoutingForSlug('dominick-harris-payne'), 'Harris-Payne must show');
    assert.ok(getVaultScoutingForSlug('hudson-west'), 'Hudson West must show');
  });
});
