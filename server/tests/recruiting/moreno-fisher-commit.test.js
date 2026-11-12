'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { isVerifiedHubCommit } = require('../../lib/recruiting-verified-commits');
const { getVaultScoutingForSlug } = require('../../lib/recruiting-hub-elite');
const warRoom = require('../../lib/war-room-store');
const { pickWeeklyNowBreakIn } = require('../../lib/weekly-now-breakin');

test('Moreno Fisher is a verified 2027 UF commit with live Vault Scouting', () => {
  assert.equal(
    isVerifiedHubCommit({
      slug: 'moreno-fisher',
      classYear: 2027,
      status: 'committed',
      committedTo: 'Florida',
    }),
    true
  );

  const evalPath = path.join(__dirname, '../../data/war-room/vault-evals/moreno-fisher.json');
  const doc = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
  assert.equal(doc.filmWatched, true);
  assert.equal(doc.provisional, false);
  assert.match(String(doc.comparison || ''), /Walker Little/);
  assert.match(String(doc.projection || ''), /starter-upside|starter upside/i);
  assert.ok(Array.isArray(doc.strengths) && doc.strengths.length >= 3);
  assert.match(String(doc.hudl || ''), /hudl\.com/);

  const bd = warRoom.getBreakdownBySlug('moreno-fisher');
  assert.ok(bd, 'War Room breakdown must exist');
  assert.equal(bd.filmWatched, true);
  assert.match(String(bd.comparison || ''), /Walker Little/);
  assert.match(String(bd.projection || ''), /Fisher/);
  const scouting = getVaultScoutingForSlug('moreno-fisher');
  assert.ok(scouting, 'Vault Scouting must SHOW on the profile');
  assert.match(String(scouting.comparison || ''), /Walker Little/);
  assert.ok(scouting.strengths.length >= 3);
});

test('this-week Fisher commit is Home NOW News on Kentucky week', () => {
  const news = pickWeeklyNowBreakIn(new Date('2026-11-12T20:00:00.000Z'));
  assert.ok(news, 'break-in must exist');
  assert.match(String(news.text || ''), /Moreno Fisher commits to Florida/i);
});
