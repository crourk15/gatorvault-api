/**
 * Stive-Bentley Keumajou exempted up onto the 2026 roster — not a 2027 commit.
 * Run: node --test server/test/keumajou-enrolled-roster.test.js
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Keumajou enrolled on current roster', () => {
  it('stays on the UF roster as a freshman DL', () => {
    const roster = require('../lib/roster-store').getRosterPlayerBySlug('stive-bentley-keumajou');
    assert.ok(roster, 'Keumajou must remain on the Team roster');
    assert.match(String(roster.pos || roster.position || ''), /DL/i);
    assert.match(String(roster.bio || ''), /reclassified from 2027/i);
  });

  it('is enrolled on the 2026 On3 board and gone from 2027', () => {
    const { getSnapshotHubCommits } = require('../lib/on3-snapshot-commits');
    const enrolled = getSnapshotHubCommits(2026).find((p) => p.slug === 'stive-bentley-keumajou');
    assert.ok(enrolled, 'expected 2026 enrolled snapshot row');
    assert.equal(String(enrolled.status || '').toLowerCase(), 'enrolled');
    assert.equal(
      getSnapshotHubCommits(2027).some((p) => p.slug === 'stive-bentley-keumajou'),
      false
    );
  });

  it('blocks a 2027 On3-shaped restore so ingest cannot put him back', () => {
    const {
      isBlockedRecruit,
      isCurrentRosterFutureClassRecruit,
      clearRosterIdentityIndex,
    } = require('../lib/recruiting-blocked-players');
    clearRosterIdentityIndex();
    const phantom = {
      slug: 'stive-bentley-keumajou',
      name: 'Stive-Bentley Keumajou',
      classYear: 2027,
      status: 'committed',
      committedTo: 'Florida',
      on3Source: 'on3-board-sync',
      protected: true,
    };
    assert.equal(isCurrentRosterFutureClassRecruit(phantom), true);
    assert.equal(isBlockedRecruit(phantom), true);
  });

  it('hub-runtime 2027 commits omit Keumajou', () => {
    const snap = path.join(__dirname, '../data/recruiting/hub-runtime/2027/commits.json');
    const doc = JSON.parse(fs.readFileSync(snap, 'utf8'));
    const items = doc.items || [];
    assert.equal(
      items.some((p) => String(p.id || p.slug || '').toLowerCase() === 'stive-bentley-keumajou'),
      false
    );
    assert.ok(
      items.some((p) => String(p.id || p.slug || '').toLowerCase() === 'moreno-fisher'),
      'Moreno Fisher must remain a 2027 commit'
    );
  });
});

describe('roster official boxes through Oklahoma', () => {
  it('stamps Texas, Georgia, and Oklahoma weeks on players who recorded a line', () => {
    const roster = require('../lib/roster-store').loadPlayersRaw();
    const { weeksStampedOnRoster } = require('../lib/roster-official-box-sync');
    const weeks = weeksStampedOnRoster(roster, 2026);
    assert.ok(weeks.has(7), 'Texas week 7');
    assert.ok(weeks.has(8), 'Georgia week 8');
    assert.ok(weeks.has(9), 'Oklahoma week 9');
    const graham = roster.find((p) => p.slug === 'myles-graham');
    const ou = (graham?.productionStats?.recentGames || []).find(
      (g) => Number(g.season) === 2026 && String(g.opponent) === 'Oklahoma'
    );
    assert.ok(ou, 'Graham must have an Oklahoma official line');
    assert.equal(Number(ou.stats?.tot), 15);
    const season = (graham.productionStats.seasons || []).find(
      (s) => Number(s.season) === 2026 && s.category === 'defense'
    );
    assert.equal(Number(season?.stats?.tot), 70);
  });
});
