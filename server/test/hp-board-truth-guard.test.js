'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  mergeBundledOn3BoardTruthIfFresher,
  shouldOverlayBundledOn3Board,
  BUNDLE_DIR,
} = require('../lib/recruiting-data-dir');

describe('mergeBundledOn3BoardTruthIfFresher', () => {
  let tmpDir;
  let prevDataDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hp-board-truth-'));
    prevDataDir = process.env.GV_RECRUITING_DATA_DIR;
    process.env.GV_RECRUITING_DATA_DIR = tmpDir;
    // Durable poisoned Girton — empty peers + fake Florida lock.
    fs.writeFileSync(
      path.join(tmpDir, 'players.json'),
      JSON.stringify([
        {
          slug: 'denairo-girton-jr',
          name: 'DeNairo Girton Jr',
          ufRpmPct: 96,
          topTeams: [],
          on3TopTeams: [],
          competitors: [],
        },
        {
          slug: 'hudson-west',
          name: 'Hudson West',
          ufRpmPct: 99,
          topTeams: [
            {
              team: { name: 'Florida' },
              prediction: 99.3,
            },
          ],
        },
        {
          slug: 'bubba-brown',
          name: 'Bubba Brown',
          ufRpmPct: 19,
          topTeams: [
            { team: { name: 'Georgia' }, prediction: 40.3 },
            { team: { name: 'Florida' }, prediction: 19.2 },
            { team: { name: 'Auburn' }, prediction: 16.5 },
          ],
          on3TopTeams: [
            { team: { name: 'Georgia' }, prediction: 40.3 },
            { team: { name: 'Florida' }, prediction: 19.2 },
          ],
          competitors: [
            { school: 'Georgia', pct: 40.3 },
            { school: 'Auburn', pct: 16.5 },
          ],
        },
      ]),
      'utf8'
    );
  });

  after(() => {
    if (prevDataDir == null) delete process.env.GV_RECRUITING_DATA_DIR;
    else process.env.GV_RECRUITING_DATA_DIR = prevDataDir;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('overlays git Florida lock onto a stale-low durable board (Bubba 19→98)', () => {
    const decision = shouldOverlayBundledOn3Board({
      dstRpm: 19,
      srcFl: 97.7,
      dstFl: 19.2,
      srcPeers: 0,
      dstPeers: 1,
      truthRpm: 97.7,
    });
    assert.equal(decision.staleLowLock, true);
    assert.equal(decision.poisonedLock, false);
    assert.equal(decision.rivalLedBundle, false);
  });

  it('does not lift Gabriel 0.80 Florida crumb as a stale-low lock', () => {
    const decision = shouldOverlayBundledOn3Board({
      dstRpm: 19,
      srcFl: 0.8,
      dstFl: 19,
      srcPeers: 1,
      dstPeers: 1,
      truthRpm: 0.8,
    });
    assert.equal(decision.staleLowLock, false);
  });

  it('copies bundle On3 board into durable when disk has sole-board Florida poison', () => {
    // Bundle must already contain Girton with real board (repo players.json).
    const bundlePath = path.join(BUNDLE_DIR, 'players.json');
    assert.ok(fs.existsSync(bundlePath), 'bundle players.json required');
    const result = mergeBundledOn3BoardTruthIfFresher(tmpDir);
    assert.ok(result.merged, `expected merge: ${JSON.stringify(result)}`);
    const durable = JSON.parse(fs.readFileSync(path.join(tmpDir, 'players.json'), 'utf8'));
    const girton = durable.find((p) => p.slug === 'denairo-girton-jr');
    assert.ok(girton);
    assert.ok(Number(girton.ufRpmPct) < 20, `rpm=${girton.ufRpmPct}`);
    assert.ok(
      (girton.topTeams || []).length > 0 || (girton.competitors || []).length > 0,
      'should restore peers'
    );
  });

  it('lifts durable Bubba Brown 19 / Georgia 40 to the git Florida lock', () => {
    const durable = JSON.parse(fs.readFileSync(path.join(tmpDir, 'players.json'), 'utf8'));
    const bubba = durable.find((p) => p.slug === 'bubba-brown');
    assert.ok(bubba, 'bubba row required');
    assert.ok(Number(bubba.ufRpmPct) >= 90, `rpm=${bubba.ufRpmPct}`);
    const teams = bubba.topTeams || bubba.on3TopTeams || [];
    const fl = teams.find((t) => /florida/i.test(String(t?.team?.name || t?.name || '')));
    assert.ok(fl, 'Florida topTeam required');
    assert.ok(Number(fl.prediction) >= 90, `fl=${fl.prediction}`);
  });
});

describe('heal uses bundle when durable peers empty', () => {
  it('rehydrates Girton from git bundle even if durable looks empty', async () => {
    const { healHighPriorityRpmPoisonRow, ensureHealPlayersWarm } = require('../api/futurecast/response-cache.ts');
    await ensureHealPlayersWarm();
    const healed = healHighPriorityRpmPoisonRow({
      slug: 'denairo-girton-jr',
      name: 'DeNairo Girton Jr',
      ufRpmPct: 96,
      ufProbability: 71,
      competingSchools: [],
      predictors: [{ name: 'On3 RPM', score: 96 }],
    });
    assert.ok((healed.competingSchools || []).length >= 1);
    assert.ok(
      (healed.competingSchools || []).some((c) => /penn state/i.test(c.name)),
      JSON.stringify(healed.competingSchools)
    );
    assert.ok(Number(healed.ufRpmPct) < 20, `rpm=${healed.ufRpmPct}`);
  });
});
