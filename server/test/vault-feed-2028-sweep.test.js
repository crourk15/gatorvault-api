/**
 * Vault feed 2028+ — safety + year gates.
 * Run: node --test server/test/vault-feed-2028-sweep.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  collectBeatCandidates,
  pickClassYear,
  isBlockedStaff,
  isVaultFeedProspectName,
  vaultFeedPourLooksComplete,
  healStaleRunningReport,
  summarizeFeedResult,
  runVaultFeed2028Sweep,
  isVaultFeedEtWindow,
  vaultFeedSlotHour,
  vaultFeedSlotId,
  alreadyFinishedThisSlot,
  isActiveVaultFeedRun,
  acceptVaultFeedSweep,
  refreshBeatsForVaultFeed,
  isVaultFeedInFlight,
  isVaultFeedLockBlocking,
  resetVaultFeedInFlightForTests,
  setVaultFeedInFlightForTests,
  shouldQueueVaultFeedOnHeavyGate,
  resolveVaultFeedSkipFlags,
  CLASS_YEAR_MIN,
} = require('../lib/vault-feed-2028-sweep');

describe('vault-feed-2028-sweep gates', () => {
  it('defaults class year to 2028+ band (never 2027)', () => {
    assert.equal(pickClassYear('Florida visit for a top EDGE', null), 2028);
    assert.equal(pickClassYear('2029 WR in The Swamp', null), 2029);
    assert.equal(pickClassYear('2028 and 2029 board', null), 2028);
    assert.equal(CLASS_YEAR_MIN, 2028);
  });

  it('blocks known staff/coach names', () => {
    assert.equal(isBlockedStaff('Jon Sumrall', null), true);
    assert.equal(isBlockedStaff("Jon Sumrall's", null), true);
    assert.equal(isBlockedStaff('Asher Ghioto', 'asher-ghioto'), false);
  });

  it('rejects venue / headline identities from the pour', () => {
    assert.equal(isVaultFeedProspectName('Hudson West'), true);
    assert.equal(isVaultFeedProspectName('Dominick Harris-Payne'), true);
    assert.equal(isVaultFeedProspectName('Mercedes-Benz Stadium'), false);
    assert.equal(isVaultFeedProspectName('College Football Playoff'), false);
    assert.equal(isVaultFeedProspectName('Coach Sumrall'), false);
    assert.equal(isVaultFeedProspectName('Of Th'), false);
    assert.equal(isVaultFeedProspectName('recruiting trail'), false);
    assert.equal(isVaultFeedProspectName('Jon Sumrall'), false);
  });

  it('cheap pass skips junk and does not provision new names', async () => {
    const report = await runVaultFeed2028Sweep({
      dryRun: true,
      skipBeatIngest: true,
      skipAllowlistIntel: true,
      skipBeatRefresh: true,
      skipOn3Articles: true,
      skipPersist: true,
      candidates: [
        {
          kind: 'named',
          playerName: 'Mercedes-Benz Stadium',
          playerSlug: 'mercedes-benz-stadium',
          classYear: 2028,
          text: 'Florida-Georgia at Mercedes-Benz Stadium',
          trusted: true,
        },
        {
          kind: 'named',
          playerName: 'Kellen Vaultfeed',
          playerSlug: 'kellen-vaultfeed',
          classYear: 2028,
          text: '2028 Kellen Vaultfeed visits Florida',
          trusted: true,
        },
      ],
    });
    assert.equal(report.created.length, 0);
    assert.equal(report.updated.length, 0);
    assert.ok(report.skipped.some((r) => r.reason === 'junk_identity'));
    assert.ok(report.skipped.some((r) => r.reason === 'skip_provision_existing_only'));
  });

  it('collectBeatCandidates skips pure-2027 headlines', () => {
    const posts = [
      {
        text: '2027 flip target visits Florida this weekend',
        handle: 'Blake_Alderman',
        createdAt: new Date().toISOString(),
      },
    ];
    // Trusted check may filter unknown handles — inject via filter bypass by
    // stubbing through collect with a writer pattern if needed.
    const rows = collectBeatCandidates(posts, { lookbackHours: 48 });
    // Either skipped as 2027 or filtered as untrusted — never a named create for 2027.
    assert.ok(rows.every((r) => r.kind === 'skip_2027' || r.classYear !== 2027));
  });

  it('dry-run never creates and skips 2027 candidates', async () => {
    const report = await runVaultFeed2028Sweep({
      dryRun: true,
      skipBeatIngest: true,
      skipAllowlistIntel: true,
      skipBeatRefresh: true,
      skipPersist: true,
      candidates: [
        {
          kind: 'named',
          playerName: 'Fake TwoSeven',
          playerSlug: null,
          classYear: 2027,
          text: '2027 RB Fake TwoSeven visits Florida',
          trusted: true,
        },
        {
          kind: 'named',
          playerName: 'Jon Sumrall',
          playerSlug: null,
          classYear: 2028,
          text: 'Jon Sumrall talks camp',
          trusted: true,
        },
      ],
    });
    assert.equal(report.ok, true);
    assert.equal(report.dryRun, true);
    assert.ok(report.skipped2027.length >= 1);
    assert.ok(report.blockedStaff.some((r) => /sumrall/i.test(r.playerName)));
    assert.equal(report.created.length, 0);
  });


  it('reports emptyReason when no candidates and no beat refresh', async () => {
    const report = await runVaultFeed2028Sweep({
      dryRun: true,
      skipBeatIngest: true,
      skipAllowlistIntel: true,
      skipBeatRefresh: true,
      skipPersist: true,
      candidates: [],
    });
    assert.equal(report.ok, true);
    assert.equal(report.summary.createdCount, 0);
    assert.equal(report.summary.updatedCount, 0);
    assert.ok(
      report.emptyReason == null ||
        report.emptyReason === 'no_beat_posts_in_cache' ||
        report.emptyReason === 'beats_present_but_no_named_2028_plus_in_lookback' ||
        report.emptyReason === 'no_creates_or_updates' ||
        report.emptyReason === 'beat_fetch_failed' ||
        report.emptyReason === 'candidates_unresolved_only' ||
        report.emptyReason === 'only_2027_or_skipped'
    );
  });

  it('ET window helper returns boolean', () => {
    assert.equal(typeof isVaultFeedEtWindow(new Date()), 'boolean');
  });
});

describe('vault-feed 7am / 7pm ET slots', () => {
  it('7am slot is owed 7–18 ET; 7pm slot is owed 19–6 overnight', () => {
    assert.equal(vaultFeedSlotHour(7), 7);
    assert.equal(vaultFeedSlotHour(8), 7);
    assert.equal(vaultFeedSlotHour(11), 7);
    assert.equal(vaultFeedSlotHour(12), 7);
    assert.equal(vaultFeedSlotHour(18), 7);
    assert.equal(vaultFeedSlotHour(19), 19);
    assert.equal(vaultFeedSlotHour(20), 19);
    assert.equal(vaultFeedSlotHour(23), 19);
    assert.equal(vaultFeedSlotHour(0), 19);
    assert.equal(vaultFeedSlotHour(6), 19);
  });

  it('treats 8:05 ET as the same slot as 7:05 so a miss can catch up', () => {
    const am7 = new Date('2026-09-22T11:05:00.000Z'); // 7:05 AM EDT
    const am8 = new Date('2026-09-22T12:05:00.000Z'); // 8:05 AM EDT
    const pm7 = new Date('2026-09-22T23:05:00.000Z'); // 7:05 PM EDT
    const pm8 = new Date('2026-09-23T00:05:00.000Z'); // 8:05 PM EDT
    const pm9 = new Date('2026-09-23T01:05:00.000Z'); // 9:05 PM EDT
    const pm10 = new Date('2026-09-23T02:05:00.000Z'); // 10:05 PM EDT
    const pm11 = new Date('2026-09-23T03:05:00.000Z'); // 11:05 PM EDT
    const am11 = new Date('2026-09-22T15:05:00.000Z'); // 11:05 AM EDT
    const noon = new Date('2026-09-22T16:05:00.000Z'); // 12:05 PM EDT
    const am3 = new Date('2026-09-22T07:05:00.000Z'); // 3:05 AM EDT
    assert.equal(isVaultFeedEtWindow(am7), true);
    assert.equal(isVaultFeedEtWindow(am8), true);
    assert.equal(isVaultFeedEtWindow(am11), true);
    assert.equal(isVaultFeedEtWindow(noon), true);
    assert.equal(isVaultFeedEtWindow(am3), true);
    assert.equal(isVaultFeedEtWindow(pm7), true);
    assert.equal(isVaultFeedEtWindow(pm8), true);
    assert.equal(isVaultFeedEtWindow(pm9), true);
    assert.equal(isVaultFeedEtWindow(pm10), true);
    assert.equal(isVaultFeedEtWindow(pm11), true);
    assert.equal(vaultFeedSlotId(am7), '2026-09-22T07');
    assert.equal(vaultFeedSlotId(am8), '2026-09-22T07');
    assert.equal(vaultFeedSlotId(am11), '2026-09-22T07');
    assert.equal(vaultFeedSlotId(noon), '2026-09-22T07');
    assert.equal(vaultFeedSlotId(am3), '2026-09-21T19');
    assert.equal(vaultFeedSlotId(pm7), '2026-09-22T19');
    assert.equal(vaultFeedSlotId(pm8), '2026-09-22T19');
    assert.equal(vaultFeedSlotId(pm9), '2026-09-22T19');
    assert.equal(vaultFeedSlotId(pm10), '2026-09-22T19');
    assert.equal(vaultFeedSlotId(pm11), '2026-09-22T19');
  });

  it('EST 7pm / 8pm still map to the evening slot', () => {
    const pm7 = new Date('2026-01-15T00:05:00.000Z'); // 7:05 PM EST Jan 14
    const pm8 = new Date('2026-01-15T01:05:00.000Z'); // 8:05 PM EST Jan 14
    assert.equal(isVaultFeedEtWindow(pm7), true);
    assert.equal(isVaultFeedEtWindow(pm8), true);
    assert.equal(vaultFeedSlotId(pm7), vaultFeedSlotId(pm8));
    assert.match(vaultFeedSlotId(pm7), /T19$/);
  });

  it('alreadyFinishedThisSlot does not treat an error stamp as done so 8am catch-up retries', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-2028-'));
    const prevEnv = process.env.GV_RECRUITING_DATA_DIR;
    process.env.GV_RECRUITING_DATA_DIR = dir;
    const am8 = new Date('2026-10-09T12:05:00.000Z'); // 8:05 AM EDT
    const crashed = {
      ok: false,
      status: 'error',
      slotId: '2026-10-09T07',
      startedAt: '2026-10-09T13:05:30.973Z',
      finishedAt: '2026-10-09T14:00:58.678Z',
      errors: [{ step: 'heartbeat', error: 'stale_running_no_heartbeat' }],
    };
    fs.writeFileSync(path.join(dir, 'vault-feed-2028-last-report.json'), `${JSON.stringify(crashed)}\n`);
    try {
      assert.equal(alreadyFinishedThisSlot(crashed, am8), false);
      const accepted = acceptVaultFeedSweep({
        launch: false,
        skipPersist: true,
        now: am8,
      });
      assert.equal(accepted.alreadyDone, undefined);
      assert.equal(accepted.started, true);
      assert.equal(accepted.report.slotId, '2026-10-09T07');
    } finally {
      if (prevEnv == null) delete process.env.GV_RECRUITING_DATA_DIR;
      else process.env.GV_RECRUITING_DATA_DIR = prevEnv;
    }
  });

  it('alreadyFinishedThisSlot is per 7am or 7pm, not the whole day', () => {
    const am = new Date('2026-09-22T11:05:00.000Z');
    const pm = new Date('2026-09-22T23:05:00.000Z');
    const morningDone = {
      status: 'success',
      slotId: '2026-09-22T07',
      startedAt: '2026-09-22T11:05:16.833Z',
      finishedAt: '2026-09-22T11:37:46.797Z',
    };
    assert.equal(alreadyFinishedThisSlot(morningDone, am), true);
    assert.equal(alreadyFinishedThisSlot(morningDone, pm), false);
  });

  it('healStaleRunningReport closes a poured slot as warning, not error', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-2028-'));
    const prevEnv = process.env.GV_RECRUITING_DATA_DIR;
    process.env.GV_RECRUITING_DATA_DIR = dir;
    const poured = {
      status: 'running',
      startedAt: '2026-10-28T00:05:00.000Z',
      heartbeatAt: '2026-10-28T00:05:00.000Z',
      slotId: '2026-10-27T19',
      window: '7pm',
      errors: [],
      created: [],
      updated: [
        {
          playerName: 'Hudson West',
          playerSlug: 'hudson-west',
          feedOk: true,
          action: 'fed_futurecast',
        },
      ],
    };
    try {
      assert.equal(vaultFeedPourLooksComplete(poured), true);
      const healed = healStaleRunningReport(poured);
      assert.equal(healed.status, 'warning');
      assert.equal(healed.ok, true);
      assert.equal(alreadyFinishedThisSlot(healed, new Date('2026-10-28T01:20:00.000Z')), true);
    } finally {
      if (prevEnv == null) delete process.env.GV_RECRUITING_DATA_DIR;
      else process.env.GV_RECRUITING_DATA_DIR = prevEnv;
    }
  });

  it('healStaleRunningReport marks a dead running stamp as error', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-2028-'));
    const prevEnv = process.env.GV_RECRUITING_DATA_DIR;
    process.env.GV_RECRUITING_DATA_DIR = dir;
    const now = Date.parse('2026-09-23T13:10:00.000Z');
    const dead = {
      status: 'running',
      startedAt: '2026-09-23T12:05:26.265Z',
      heartbeatAt: '2026-09-23T12:05:26.265Z',
      slotId: '2026-09-23T07',
      window: '7am',
      errors: [],
    };
    try {
      assert.equal(isActiveVaultFeedRun(dead, now), false);
      const healed = healStaleRunningReport(dead);
      assert.equal(healed.status, 'error');
      assert.match(String(healed.message || ''), /did not finish/i);
    } finally {
      if (prevEnv == null) delete process.env.GV_RECRUITING_DATA_DIR;
      else process.env.GV_RECRUITING_DATA_DIR = prevEnv;
    }
  });

  it('isActiveVaultFeedRun dies after 15 minutes without a heartbeat', () => {
    const now = Date.parse('2026-09-22T23:20:00.000Z');
    const live = {
      status: 'running',
      startedAt: '2026-09-22T23:05:00.000Z',
      heartbeatAt: '2026-09-22T23:18:00.000Z',
    };
    const dead = {
      status: 'running',
      startedAt: '2026-09-22T23:05:00.000Z',
      heartbeatAt: '2026-09-22T23:04:00.000Z',
    };
    assert.equal(isActiveVaultFeedRun(live, now), true);
    assert.equal(isActiveVaultFeedRun(dead, now), false);
  });

  it('accept does not start a second pass for the same 7pm slot', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-2028-'));
    const prevEnv = process.env.GV_RECRUITING_DATA_DIR;
    process.env.GV_RECRUITING_DATA_DIR = dir;
    fs.writeFileSync(
      path.join(dir, 'vault-feed-2028-last-report.json'),
      `${JSON.stringify({
        status: 'success',
        slotId: '2026-09-22T19',
        startedAt: '2026-09-22T23:05:00.000Z',
        finishedAt: '2026-09-22T23:40:00.000Z',
      })}\n`
    );
    try {
      const accepted = acceptVaultFeedSweep({
        launch: false,
        skipPersist: true,
        now: new Date('2026-09-23T00:05:00.000Z'),
      });
      assert.equal(accepted.alreadyDone, true);
      assert.equal(accepted.started, false);
      assert.equal(accepted.accepted, true);
    } finally {
      if (prevEnv == null) delete process.env.GV_RECRUITING_DATA_DIR;
      else process.env.GV_RECRUITING_DATA_DIR = prevEnv;
    }
  });

  it('accept starts the 7pm slot after a finished 7am report', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-2028-'));
    const prevEnv = process.env.GV_RECRUITING_DATA_DIR;
    process.env.GV_RECRUITING_DATA_DIR = dir;
    fs.writeFileSync(
      path.join(dir, 'vault-feed-2028-last-report.json'),
      `${JSON.stringify({
        status: 'warning',
        slotId: '2026-09-22T07',
        startedAt: '2026-09-22T11:05:16.833Z',
        finishedAt: '2026-09-22T11:37:46.797Z',
      })}\n`
    );
    try {
      const accepted = acceptVaultFeedSweep({
        launch: false,
        skipPersist: true,
        now: new Date('2026-09-22T23:05:00.000Z'),
      });
      assert.equal(accepted.started, true);
      assert.equal(accepted.accepted, true);
      assert.equal(accepted.report.slotId, '2026-09-22T19');
      assert.equal(accepted.report.window, '7pm');
    } finally {
      if (prevEnv == null) delete process.env.GV_RECRUITING_DATA_DIR;
      else process.env.GV_RECRUITING_DATA_DIR = prevEnv;
    }
  });
});


describe('summarizeFeedResult proof detail', () => {
  it('explains UF% move from decision delta (no prior field)', () => {
    const s = summarizeFeedResult({
      ok: true,
      promoted: true,
      allowlisted: true,
      decision: { pct: 42, delta: 6, source: 'signal_nudge', nudged: true },
      player: { ufProbability: 42, natlRank: 88 },
      steps: [
        { step: 'hydrate', ok: true },
        { step: 'recruiting_store_upsert', ok: true },
        { step: 'futurecast_prediction_refresh', ok: true },
      ],
    });
    assert.match(s.whatChanged, /UF% 36→42/);
    assert.match(s.whatChanged, /promoted onto chase board/);
    assert.match(s.whatChanged, /On3 hydrate/);
    assert.equal(s.ufPct, 42);
    assert.equal(s.promoted, true);
  });

  it('surfaces feed failures clearly', () => {
    const s = summarizeFeedResult({ ok: false, error: 'staff_not_recruit' });
    assert.match(s.whatChanged, /Feed failed: staff_not_recruit/);
  });

  it('Hub Run and cron skip unbounded beat-stream refresh; explicit pull is budgeted', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '../lib/admin-hub-routes.js'), 'utf8');
    assert.match(src, /skipBeatRefresh: req\.body\?\.skipBeatRefresh !== false/);
    assert.match(src, /skipBeatIngest: req\.body\?\.skipBeatIngest !== false/);
    const sweepSrc = fs.readFileSync(path.join(__dirname, '../lib/vault-feed-2028-sweep.js'), 'utf8');
    assert.match(sweepSrc, /touchVaultFeedHeartbeat\(report/);
    assert.match(sweepSrc, /resolveVaultFeedSkipFlags/);
    assert.match(sweepSrc, /refreshBeatsForVaultFeed/);
    assert.match(sweepSrc, /beat_refresh_timeout/);
    assert.match(sweepSrc, /_vaultFeedInFlight/);
    assert.match(sweepSrc, /shouldQueueVaultFeedOnHeavyGate/);
    const jobs = fs.readFileSync(path.join(__dirname, '../lib/ops-jobs.js'), 'utf8');
    assert.match(jobs, /skipBeatRefresh: opts\.skipBeatRefresh !== false/);
    assert.match(jobs, /skipBeatIngest: opts\.skipBeatIngest !== false/);
  });
});

describe('vault-feed hang guards', () => {
  it('refreshBeatsForVaultFeed returns cache when refresh never settles', async () => {
    const fake = {
      isBeatRefreshInFlight: () => false,
      refreshBeatStream: () => new Promise(() => {}),
    };
    const started = Date.now();
    const out = await refreshBeatsForVaultFeed(fake, 40);
    assert.equal(out.timedOut, true);
    assert.equal(out.cached, true);
    assert.ok(Date.now() - started < 500);
  });

  it('refreshBeatsForVaultFeed does not start a second pull when one is in flight', async () => {
    const out = await refreshBeatsForVaultFeed(
      {
        isBeatRefreshInFlight: () => true,
        refreshBeatStream: () => {
          throw new Error('should not start');
        },
      },
      40
    );
    assert.equal(out.inFlight, true);
    assert.equal(out.cached, true);
  });

  it('accept will not stack a second in-process sweep', async () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-2028-'));
    const prevEnv = process.env.GV_RECRUITING_DATA_DIR;
    process.env.GV_RECRUITING_DATA_DIR = dir;
    resetVaultFeedInFlightForTests();
    try {
      const first = acceptVaultFeedSweep({
        launch: true,
        skipPersist: true,
        skipBeatRefresh: true,
        skipBeatIngest: true,
        skipAllowlistIntel: true,
        skipOn3Articles: true,
        dryRun: true,
        now: new Date('2026-10-24T11:05:00.000Z'),
      });
      const second = acceptVaultFeedSweep({
        launch: true,
        skipPersist: true,
        now: new Date('2026-10-24T11:05:01.000Z'),
      });
      assert.equal(first.started, true);
      assert.equal(isVaultFeedInFlight(), true);
      assert.equal(second.alreadyRunning, true);
      assert.equal(second.inProcess, true);
      const deadline = Date.now() + 8000;
      while (isVaultFeedInFlight() && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50));
      }
      assert.equal(isVaultFeedInFlight(), false);
    } finally {
      resetVaultFeedInFlightForTests();
      if (prevEnv == null) delete process.env.GV_RECRUITING_DATA_DIR;
      else process.env.GV_RECRUITING_DATA_DIR = prevEnv;
    }
  });

  it('accept drops a stale in-process lock so the next 7am can start', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-2028-'));
    const prevEnv = process.env.GV_RECRUITING_DATA_DIR;
    process.env.GV_RECRUITING_DATA_DIR = dir;
    resetVaultFeedInFlightForTests();
    const now = Date.parse('2026-10-25T11:05:00.000Z'); // 7:05 AM EDT
    fs.writeFileSync(
      path.join(dir, 'vault-feed-2028-last-report.json'),
      `${JSON.stringify({
        status: 'running',
        slotId: '2026-10-24T19',
        startedAt: '2026-10-25T01:05:39.226Z',
        heartbeatAt: '2026-10-25T01:05:39.226Z',
      })}\n`
    );
    setVaultFeedInFlightForTests({
      startedAt: Date.parse('2026-10-25T01:05:39.226Z'),
      slotId: '2026-10-24T19',
      trigger: 'cron',
    });
    try {
      assert.equal(isVaultFeedLockBlocking(now), false);
      assert.equal(isVaultFeedInFlight(), false);
      const accepted = acceptVaultFeedSweep({
        launch: false,
        skipPersist: true,
        now: new Date(now),
      });
      assert.equal(accepted.started, true);
      assert.equal(accepted.alreadyRunning, undefined);
      assert.equal(accepted.report.slotId, '2026-10-25T07');
    } finally {
      resetVaultFeedInFlightForTests();
      if (prevEnv == null) delete process.env.GV_RECRUITING_DATA_DIR;
      else process.env.GV_RECRUITING_DATA_DIR = prevEnv;
    }
  });

  it('Sunday noon still starts the missed 7am after Saturday 7pm died', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-2028-'));
    const prevEnv = process.env.GV_RECRUITING_DATA_DIR;
    process.env.GV_RECRUITING_DATA_DIR = dir;
    resetVaultFeedInFlightForTests();
    const noon = new Date('2026-10-25T16:11:00.000Z'); // 12:11 PM EDT
    fs.writeFileSync(
      path.join(dir, 'vault-feed-2028-last-report.json'),
      `${JSON.stringify({
        ok: false,
        status: 'error',
        slotId: '2026-10-24T19',
        startedAt: '2026-10-25T01:05:39.226Z',
        finishedAt: '2026-10-25T01:20:39.226Z',
        errors: [{ step: 'heartbeat', error: 'stale_running_no_heartbeat' }],
      })}\n`
    );
    try {
      assert.equal(vaultFeedSlotId(noon), '2026-10-25T07');
      const accepted = acceptVaultFeedSweep({
        launch: false,
        skipPersist: true,
        now: noon,
      });
      assert.equal(accepted.started, true);
      assert.equal(accepted.alreadyDone, undefined);
      assert.equal(accepted.alreadyRunning, undefined);
      assert.equal(accepted.report.slotId, '2026-10-25T07');
    } finally {
      resetVaultFeedInFlightForTests();
      if (prevEnv == null) delete process.env.GV_RECRUITING_DATA_DIR;
      else process.env.GV_RECRUITING_DATA_DIR = prevEnv;
    }
  });

  it('accept starts after a restart leftover running stamp with no process lock', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-2028-'));
    const prevEnv = process.env.GV_RECRUITING_DATA_DIR;
    process.env.GV_RECRUITING_DATA_DIR = dir;
    resetVaultFeedInFlightForTests();
    const now = new Date('2026-10-25T23:38:00.000Z'); // 7:38 PM EDT
    fs.writeFileSync(
      path.join(dir, 'vault-feed-2028-last-report.json'),
      `${JSON.stringify({
        status: 'running',
        slotId: '2026-10-25T19',
        startedAt: '2026-10-25T23:05:53.582Z',
        heartbeatAt: '2026-10-25T23:37:06.207Z',
      })}\n`
    );
    try {
      assert.equal(isActiveVaultFeedRun(JSON.parse(fs.readFileSync(path.join(dir, 'vault-feed-2028-last-report.json'), 'utf8')), now.getTime()), true);
      const accepted = acceptVaultFeedSweep({
        launch: false,
        skipPersist: true,
        now,
      });
      assert.equal(accepted.started, true);
      assert.equal(accepted.alreadyRunning, undefined);
      assert.equal(accepted.report.slotId, '2026-10-25T19');
    } finally {
      resetVaultFeedInFlightForTests();
      if (prevEnv == null) delete process.env.GV_RECRUITING_DATA_DIR;
      else process.env.GV_RECRUITING_DATA_DIR = prevEnv;
    }
  });

  it('hub force-start and cron skip beat ingest by default', () => {
    const hub = resolveVaultFeedSkipFlags({ trigger: 'hub', force: true });
    assert.equal(hub.skipBeatIngest, true);
    assert.equal(hub.skipBeatRefresh, true);
    assert.equal(hub.skipAllowlistIntel, true);
    assert.equal(hub.skipProvision, true);
    const cron = resolveVaultFeedSkipFlags({ trigger: 'cron' });
    assert.equal(cron.skipBeatIngest, true);
    const explicit = resolveVaultFeedSkipFlags({ trigger: 'hub', force: true, skipBeatIngest: false });
    assert.equal(explicit.skipBeatIngest, false);
  });

  it('cheap cron/hub vault-feed does not wait on a stuck heavy-job gate', async () => {
    const gate = require('../lib/heavy-job-gate');
    const orig = gate.runHeavyJob;
    gate.runHeavyJob = () => new Promise(() => {});
    try {
      assert.equal(shouldQueueVaultFeedOnHeavyGate({ trigger: 'cron' }), false);
      assert.equal(shouldQueueVaultFeedOnHeavyGate({ skipBeatRefresh: true }), false);
      assert.equal(shouldQueueVaultFeedOnHeavyGate({ skipBeatRefresh: false }), true);
      const started = Date.now();
      const report = await runVaultFeed2028Sweep({
        dryRun: true,
        skipPersist: true,
        skipBeatRefresh: true,
        skipBeatIngest: true,
        skipAllowlistIntel: true,
        skipOn3Articles: true,
        candidates: [],
      });
      assert.ok(Date.now() - started < 2000);
      assert.ok(report);
      assert.ok(report.status === 'success' || report.status === 'warning');
    } finally {
      gate.runHeavyJob = orig;
    }
  });

  it('sweep inner calls the budgeted refresh helper, not a bare writer pull', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const sweepSrc = fs.readFileSync(path.join(__dirname, '../lib/vault-feed-2028-sweep.js'), 'utf8');
    assert.equal(sweepSrc.includes('refreshBeatStream()'), false);
    assert.equal(sweepSrc.includes('refreshBeatsForVaultFeed(liveBeat, budget)'), true);
  });
});
