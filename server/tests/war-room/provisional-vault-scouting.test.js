'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { getVaultScoutingForSlug } = require('../../lib/recruiting-hub-elite');
const {
  staffNotesMarkProvisional,
  isProvisionalVaultCard,
} = require('../../lib/recruiting-intel-quality');
const warRoom = require('../../lib/war-room-store');

const FILM_DESK_PEARLS = [
  'chris-morillo',
  'barrett-price',
  'jamarion-davis',
  'samuel-bailey',
  'blake-mccullough',
];

describe('provisional vault scouting gate', () => {
  it('getVaultScoutingForSlug uses isProvisionalVaultCard helper', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'recruiting-hub-elite.js'),
      'utf8'
    );
    assert.match(src, /isProvisionalVaultCard/);
  });

  it('staffNotesMarkProvisional ignores "Not provisional"', () => {
    assert.equal(staffNotesMarkProvisional('PROVISIONAL board draft — do not publish'), true);
    assert.equal(
      staffNotesMarkProvisional(
        'Vault film desk verified 2026-08-08. Comp size-matched. Not provisional.'
      ),
      false
    );
    assert.equal(
      isProvisionalVaultCard({
        filmWatched: true,
        provisional: false,
        staffNotes: 'Vault film desk verified. Not provisional.',
      }),
      false
    );
    assert.equal(
      isProvisionalVaultCard({
        filmWatched: false,
        provisional: true,
        staffNotes: 'PROVISIONAL',
      }),
      true
    );
  });

  it('five Hudl-watched evals are Pearl (filmWatched + not provisional)', () => {
    for (const slug of FILM_DESK_PEARLS) {
      const doc = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, '..', '..', 'data', 'war-room', 'vault-evals', slug + '.json'),
          'utf8'
        )
      );
      assert.equal(doc.filmWatched, true, slug);
      assert.equal(doc.provisional, false, slug);
      assert.equal(staffNotesMarkProvisional(doc.staffNotes), false, slug);
    }
  });

  it('film-desk pearls show; Harris-Payne / West still show', () => {
    for (const slug of FILM_DESK_PEARLS) {
      const bd = warRoom.getBreakdownBySlug(slug);
      assert.ok(bd, slug);
      assert.equal(bd.filmWatched, true, slug);
      assert.equal(bd.provisional, false, slug);
      assert.ok(getVaultScoutingForSlug(slug), slug + ' must show');
    }
    assert.ok(getVaultScoutingForSlug('dominick-harris-payne'), 'Harris-Payne must show');
    assert.ok(getVaultScoutingForSlug('hudson-west'), 'Hudson West must show');
  });
});
