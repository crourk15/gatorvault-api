'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { isVerifiedHubCommit } = require('../../lib/recruiting-verified-commits');
const { getVaultScoutingForSlug } = require('../../lib/recruiting-hub-elite');
const warRoom = require('../../lib/war-room-store');
const { pickWeeklyNowBreakIn } = require('../../lib/weekly-now-breakin');

test('Terrance Grant is a verified 2027 UF commit with live Vault Scouting', () => {
  assert.equal(
    isVerifiedHubCommit({
      slug: 'terrance-grant',
      classYear: 2027,
      status: 'committed',
      committedTo: 'Florida',
    }),
    true
  );

  const evalPath = path.join(__dirname, '../../data/war-room/vault-evals/terrance-grant.json');
  const doc = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
  assert.equal(doc.filmWatched, true);
  assert.equal(doc.provisional, false);
  assert.match(String(doc.staffNotes || ''), /FILM VERIFIED/);
  assert.doesNotMatch(String(doc.staffNotes || '').replace(/\bnot\s+provisional\b/gi, ' '), /\bPROVISIONAL\b/i);
  assert.match(String(doc.comparison || ''), /Isiah Pacheco/);
  assert.match(String(doc.projection || ''), /Grant/);
  assert.match(String(doc.projection || ''), /starter-upside|starter upside/i);
  assert.ok(Array.isArray(doc.strengths) && doc.strengths.length >= 3);
  assert.match(String(doc.hudl || ''), /hudl\.com/);
  assert.doesNotMatch(String(doc.insiderNotes || ''), /hudl/i);
  assert.doesNotMatch(String(doc.strengths.join(' ')), /hudl/i);

  const bd = warRoom.getBreakdownBySlug('terrance-grant');
  assert.ok(bd, 'War Room breakdown must exist');
  assert.equal(bd.filmWatched, true);
  assert.equal(bd.provisional, false);
  assert.match(String(bd.comparison || ''), /Pacheco/);
  const scouting = getVaultScoutingForSlug('terrance-grant');
  assert.ok(scouting, 'Vault Scouting must SHOW on the profile');
  assert.match(String(scouting.comparison || ''), /Pacheco/);
  assert.ok(scouting.strengths.length >= 3);

  const stampPath = path.join(
    __dirname,
    '../../data/player-profiles/stamps/terrance-grant.json'
  );
  const stamp = JSON.parse(fs.readFileSync(stampPath, 'utf8'));
  assert.equal(stamp.player.committedTo, 'Florida');
  assert.equal(stamp.stampMeta.profileKind, 'commit-2027');
  assert.ok(stamp.vaultScouting, 'prepared-meal stamp must carry Vault Scouting');
  assert.match(String(stamp.vaultScouting.comparison || ''), /Pacheco/);
});

test('this-week Grant flip is Home NOW News on Vanderbilt week', () => {
  const news = pickWeeklyNowBreakIn(new Date('2026-11-17T18:00:00.000Z'));
  assert.ok(news, 'break-in must exist');
  assert.match(String(news.text || ''), /Terrance Grant flips to Florida/i);
});
