'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('player profile prepared-meal stamps', () => {
  let stamp;
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-profile-stamp-'));
    process.env.GV_RECRUITING_DATA_DIR = path.join(tmpDir, 'recruiting');
    fs.mkdirSync(process.env.GV_RECRUITING_DATA_DIR, { recursive: true });
    delete require.cache[require.resolve('../../lib/player-profile-stamp')];
    stamp = require('../../lib/player-profile-stamp');
  });

  after(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    delete process.env.GV_RECRUITING_DATA_DIR;
    delete require.cache[require.resolve('../../lib/player-profile-stamp')];
  });

  it('strips On3 RPM fields before write and overlays live RPM on read', () => {
    const slug = 'test-prospect';
    const dossier = {
      lastUpdated: '2026-08-01T00:00:00.000Z',
      source: 'recruiting-store',
      player: {
        slug,
        fullName: 'Test Prospect',
        classYear: 2028,
        position: 'QB',
        committedTo: null,
        ufRpmPct: 44,
      },
      highSchoolProfile: null,
      collegeProfile: null,
      portalProfile: null,
      ufSpecificProfile: null,
      movementWindow: null,
      movementHistory: [],
      signals: [],
      related: [],
      portalPredictions: null,
      fitIntel: null,
      competingSchools: [],
      futurecastSummary: {
        ufProbability: 44,
        on3UfProbability: 44,
        gvProbability: 31,
        predictedSchool: 'Florida',
        movementDelta: 2,
        fitScore: 70,
        volatilityScore: 1,
      },
      vaultScouting: {
        evaluation: 'Arm talent',
        comparison: 'Comp',
        projection: 'Develop',
        strengths: ['arm'],
        schemeFit: null,
      },
    };

    assert.equal(stamp.writeStamp(slug, dossier), true);
    const raw = stamp.readStamp(slug);
    assert.ok(raw);
    assert.equal(raw.player.ufRpmPct, undefined);
    assert.equal(raw.futurecastSummary.on3UfProbability, undefined);
    // GV kept; display ufProbability falls back to GV until live overlay.
    assert.equal(raw.futurecastSummary.gvProbability, 31);
    assert.equal(raw.futurecastSummary.ufProbability, 31);
    assert.equal(raw.vaultScouting.comparison, 'Comp');

    const live = stamp.overlayLiveRpm(raw, { ufRpmPct: 58, committedTo: null });
    assert.equal(live.rpmLive, true);
    assert.equal(live.servedFrom, 'stamp');
    assert.equal(live.player.ufRpmPct, 58);
    assert.equal(live.futurecastSummary.on3UfProbability, 58);
    assert.equal(live.futurecastSummary.ufProbability, 58);
    assert.equal(live.futurecastSummary.gvProbability, 31);
    assert.equal(live.vaultScouting.comparison, 'Comp');
  });

  it('locks Florida commits to 100 on live overlay', () => {
    const live = stamp.overlayLiveRpm(
      {
        player: { slug: 'commit-kid', committedTo: null, classYear: 2027 },
        futurecastSummary: { gvProbability: 90, ufProbability: 90 },
        vaultScouting: null,
      },
      { committedTo: 'Florida', ufRpmPct: 12 }
    );
    assert.equal(live.futurecastSummary.ufProbability, 100);
    assert.equal(live.futurecastSummary.on3UfProbability, 100);
    assert.equal(live.futurecastSummary.predictedSchool, 'Florida');
  });

  it('lists 2027 + 2028 allowlist prepared-meal targets', () => {
    const slugs = stamp.listAllowlistStampSlugs();
    assert.ok(slugs.length >= 40);
    assert.ok(slugs.includes('hudson-west') || slugs.some((s) => s.includes('west')));
  });

  it('full-profile handler prefers stamp path', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'player', 'full-profile', '[slug].ts'),
      'utf8'
    );
    assert.match(src, /getStampedFullProfile/);
    assert.match(src, /X-Profile-Cache', 'STAMP'/);
    assert.match(src, /writeStamp/);
  });

  it('rejects poisoned identity stamps (Jamarcus slug holding Kamarion)', async () => {
    const slug = 'jamarcus-johnson';
    assert.equal(
      stamp.writeStamp(slug, {
        source: 'test',
        player: {
          slug,
          fullName: 'Kamarion Johnson',
          classYear: 2027,
          position: 'ATH',
          highSchool: 'Clinch County',
        },
        futurecastSummary: {},
        vaultScouting: null,
      }),
      true
    );
    assert.equal(
      stamp.isPoisonedStamp(
        slug,
        stamp.readStamp(slug),
        { name: 'Jamarcus Johnson', classYear: 2028, pos: 'DL' }
      ),
      true
    );
    const del = stamp.deleteStamp(slug);
    assert.ok(del.deleted >= 1);
    assert.equal(stamp.readStamp(slug), null);
  });
});
