'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  aliasPlayerSlug,
  isPositionalPhantomName,
  playerRecruitingProfileUrl,
} = require('../../lib/player-slug-alias');
const { overlayVerifiedFloridaProfile } = require('../../lib/recruiting-verified-commits');
const { healStaleFloridaCommitNote } = require('../../lib/player-profile-stamp');
const {
  sanitizeSourceText,
  optionalContext,
  buildSkinnyAlert,
} = require('../../lib/recruiting-alert-templates');
const { formatVisitLabel } = require('../../lib/gm2-client');
const { isValidPlayerName } = require('../../lib/x-autoposter-player-context');
const { canonicalTargetSlug } = require('../../lib/recruiting-target-allowlist');

describe('change-of email / profile click-through', () => {
  it('aliases beat-parser lineman-moreno-fisher onto Moreno Fisher', () => {
    assert.equal(aliasPlayerSlug('lineman-moreno-fisher'), 'moreno-fisher');
    assert.equal(canonicalTargetSlug('lineman-moreno-fisher'), 'moreno-fisher');
    assert.equal(isPositionalPhantomName('Lineman Moreno Fisher'), true);
    assert.equal(isValidPlayerName('Lineman Moreno Fisher'), false);
    assert.match(
      playerRecruitingProfileUrl('lineman-moreno-fisher'),
      /\/vault\/recruiting\/player\/moreno-fisher\/$/
    );
  });

  it('does not strip a real two-token slug that is not a position prefix', () => {
    assert.equal(aliasPlayerSlug('cain-van-norden'), 'cain-van-norden');
    assert.equal(aliasPlayerSlug('moreno-fisher'), 'moreno-fisher');
  });

  it('clears a stale FutureCast Florida pledge after a recruiting-store decommit', () => {
    const out = overlayVerifiedFloridaProfile(
      { slug: 'cain-van-norden', fullName: 'Cain Van Norden', committedTo: 'Florida' },
      { slug: 'cain-van-norden', status: 'decommitted', committedTo: null }
    );
    assert.equal(out.committedTo, null);
  });

  it('replaces a Florida-commit bio when the live row is a decommit', () => {
    const healed = healStaleFloridaCommitNote(
      'Cain Van Norden committed to Florida as a 2027 DL.',
      {
        status: 'decommitted',
        committedTo: null,
        profileNote: 'Decommitted from Florida on November 17, 2026.',
      }
    );
    assert.match(String(healed), /decommit/i);
    assert.doesNotMatch(String(healed), /committed to Florida as a/i);
  });

  it('does not ship parenthetical (change of) as skinny or visit label', () => {
    assert.equal(optionalContext('(change of)'), '');
    assert.equal(optionalContext('(change of "Florida")'), '');
    assert.equal(formatVisitLabel('change_of'), 'cancelled official visit');
    assert.equal(formatVisitLabel('ov_change'), 'cancelled official visit');
    const skinny = buildSkinnyAlert({
      player: { name: 'Moreno Fisher', pos: 'OT', stars: 3 },
      eventType: 'change_of',
      row: {},
      extraContext: '(change of)',
    });
    assert.match(skinny, /cancelled his official visit/i);
    assert.doesNotMatch(skinny, /\(change of\)/i);
    const leftover = sanitizeSourceText('Change of schools from "Florida" to "Texas"');
    assert.doesNotMatch(leftover, /\(change of\)/i);
  });

  it('rejects change of as a player name', () => {
    assert.equal(isValidPlayerName('change of'), false);
    assert.equal(isValidPlayerName('Change of'), false);
    assert.equal(isValidPlayerName('Moreno Fisher'), true);
  });
});
