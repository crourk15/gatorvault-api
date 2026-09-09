'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildInbox,
  buildFilmDeskBrief,
  loadSources,
  loadGameCard,
} = require('../../lib/film-desk-packet');

describe('Film Desk packet', () => {
  it('registers GNFP, Tengwall, and DiRocco as desk sources', () => {
    const ids = loadSources().map((s) => s.id);
    assert.deepEqual(ids.sort(), ['dirocco', 'gnfp', 'tengwall'].sort());
  });

  it('lists 2026 games with FAU locked and Campbell unlocked', () => {
    const inbox = buildInbox({ year: 2026 });
    assert.equal(inbox.ok, true);
    const fau = inbox.items.find((g) => g.gameId === 'fau');
    const campbell = inbox.items.find((g) => g.gameId === 'campbell');
    assert.ok(fau, 'FAU on slate');
    assert.equal(fau.locked, true);
    assert.ok(fau.intelCount >= 2, 'Tengwall + GNFP seeds');
    assert.ok(campbell, 'Campbell on slate');
    assert.equal(campbell.locked, false);
  });

  it('FAU brief is Charles lock first and never tells the agent to name writers', () => {
    const card = loadGameCard('fau');
    assert.equal(card.locked, true);
    assert.match(card.whatTheyRan.join(' '), /odd front/);
    assert.match(card.whatTheyRan.join(' '), /JACK/);
    assert.ok(card.doNotSay.some((s) => /writer names/i.test(s)));

    const brief = buildFilmDeskBrief('fau');
    assert.equal(brief.ok, true);
    assert.match(brief.pasteText, /GATORVAULT FILM DESK BRIEF/);
    assert.match(brief.pasteText, /WHAT THEY RAN/);
    assert.match(brief.pasteText, /CHARLES LOCKED/);
    assert.match(brief.pasteText, /NEVER name writers/);
    assert.match(brief.pasteText, /UXOweKkBadI/);
    assert.match(brief.pasteText, /SPKKr6vhtZA/);
    assert.match(brief.pasteText, /filmWatched:false/);
    assert.doesNotMatch(brief.pasteText, /according to James/i);
    assert.ok(brief.draftReview, 'FAU Review draft is on the brief');
    assert.equal(brief.draftReview.filmWatched, false);
    assert.match(String(brief.draftReview.recap || ''), /Coleman/);
    assert.match(String(brief.draftReview.offense && brief.draftReview.offense.body), /Faulkner/);
  });

  it('Campbell brief stays unlocked so we do not invent a Review', () => {
    const brief = buildFilmDeskBrief('campbell');
    assert.equal(brief.ok, true);
    assert.match(brief.pasteText, /UNLOCKED/);
    assert.match(brief.pasteText, /empty — Charles has not locked/);
  });
});
