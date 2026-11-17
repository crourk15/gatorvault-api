'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { isVerifiedHubCommit } = require('../../lib/recruiting-verified-commits');
const { getVaultScoutingForSlug } = require('../../lib/recruiting-hub-elite');
const warRoom = require('../../lib/war-room-store');
const { pickWeeklyNowBreakIn } = require('../../lib/weekly-now-breakin');

test('Terrance Grant is a verified 2027 UF commit with provisional film', () => {
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
  assert.equal(doc.filmWatched, false);
  assert.equal(doc.provisional, true);
  assert.match(String(doc.staffNotes || ''), /PROVISIONAL/);
  assert.match(String(doc.comparison || ''), /Isiah Pacheco/);
  assert.match(String(doc.projection || ''), /Grant/);
  assert.ok(Array.isArray(doc.strengths) && doc.strengths.length >= 3);
  assert.match(String(doc.hudl || ''), /hudl\.com/);

  const bd = warRoom.getBreakdownBySlug('terrance-grant');
  assert.ok(bd, 'War Room breakdown must exist');
  assert.equal(bd.filmWatched, false);
  assert.match(String(bd.comparison || ''), /Pacheco/);
  const scouting = getVaultScoutingForSlug('terrance-grant');
  assert.equal(scouting, null, 'Vault Scouting must stay HIDDEN until Hudl is watched');
});

test('this-week Grant flip is Home NOW News on Vanderbilt week', () => {
  const news = pickWeeklyNowBreakIn(new Date('2026-11-17T18:00:00.000Z'));
  assert.ok(news, 'break-in must exist');
  assert.match(String(news.text || ''), /Terrance Grant flips to Florida/i);
});
