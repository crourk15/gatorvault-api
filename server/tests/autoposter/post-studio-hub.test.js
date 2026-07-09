/** Post Studio hub mode — manual drafts vs limited autoposter queue. */
const test = require('node:test');
const assert = require('node:assert/strict');

test('x-autoposter-hub defaults to hub mode', () => {
  delete process.env.X_AUTOPOST_HUB_MODE;
  delete process.env.X_AUTOPOST_AUTO_COMMITS;
  const hub = require('../../lib/x-autoposter-cadence');
  assert.equal(hub.isHubModeEnabled(), true);
  assert.equal(hub.autoCommitsEnabled(), false);
  assert.equal(hub.autoQueueMax(), 2);
});

test('resolveEnqueueStatus routes commits to hub_review by default', () => {
  process.env.X_AUTOPOST_HUB_MODE = 'true';
  process.env.X_AUTOPOST_AUTO_COMMITS = 'false';
  process.env.X_AUTOPOST_SCHEDULER_ENABLED = 'false';
  const hub = require('../../lib/x-autoposter-cadence');
  const status = hub.resolveEnqueueStatus({
    text: 'Five-star DL commits to Florida.',
    sourceEventType: 'commit',
    playerSlug: 'test-player'
  });
  assert.equal(status, 'hub_review');
});

test('autoposter scheduler off by default in hub mode', () => {
  process.env.X_AUTOPOST_ENABLED = 'true';
  process.env.X_PIPELINES_ENABLED = 'true';
  process.env.X_AUTOPOST_HUB_MODE = 'true';
  delete process.env.X_AUTOPOST_SCHEDULER_ENABLED;
  const guards = require('../../lib/pipeline-guards');
  assert.equal(guards.autoposterSchedulerEnabled(), false);
  assert.equal(guards.autoposterComposeEnabled(), true);
});

test('withIngestLock skips overlapping runs', async () => {
  const { withIngestLock, isIngestRunning } = require('../../lib/ingest-run-guard');
  const slow = withIngestLock('test-lock', async () => {
    await new Promise((r) => setTimeout(r, 50));
    return { ok: true };
  });
  const skip = withIngestLock('test-lock', async () => ({ ok: true }));
  const out = await Promise.all([slow, skip]);
  assert.equal(out[1].skipped, true);
  assert.equal(out[1].reason, 'already_running');
  assert.equal(isIngestRunning('test-lock'), false);
});

test('buildCronTiles does not yellow on-demand jobs without heartbeat', () => {
  const { buildCronTiles } = require('../../lib/ops-status');
  const tiles = buildCronTiles({}, { subsystems: {} });
  const beatWriter = tiles.find((j) => j.jobId === 'beat-writer-ingest');
  assert.ok(beatWriter);
  assert.equal(beatWriter.heartbeatRequired, false);
  assert.equal(beatWriter.status, 'green');
  const renderOnly = tiles.find((j) => j.jobId === 'api-keepalive');
  assert.equal(renderOnly.heartbeatRequired, false);
  assert.equal(renderOnly.status, 'green');
});

test('api monitor ignores ops noise and benign client errors', () => {
  const apiMonitor = require('../../lib/api-monitor');
  assert.equal(apiMonitor.shouldMonitorPath('/api/ops/status'), false);
  assert.equal(apiMonitor.shouldMonitorPath('/api/ping'), true);
  assert.equal(apiMonitor.isBenignClientStatus(404), true);
  apiMonitor.recordRequest({ method: 'GET', path: '/api/ops/status', statusCode: 401, durationMs: 12 });
  apiMonitor.recordRequest({ method: 'GET', path: '/api/missing', statusCode: 404, durationMs: 8 });
  apiMonitor.recordRequest({ method: 'GET', path: '/api/ping', statusCode: 200, durationMs: 5 });
  const report = apiMonitor.getApiHealthReport();
  assert.equal(report.status, 'green');
  assert.equal(report.errors5xx, 0);
  assert.equal(report.benign4xx, 2);
});

test('pruneStalePostStudioDrafts cancels recycled visit templates and duplicate slugs', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const tmpQueue = path.join(os.tmpdir(), `gv-test-queue-${Date.now()}.json`);
  const freshAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const staleAt = new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString();

  const doc = {
    version: 2,
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: 'xp_stale_drakeford',
        status: 'hub_review',
        playerSlug: 'ryan-drakeford',
        playerName: 'Ryan Drakeford',
        createdAt: staleAt,
        sourceEventCreatedAt: staleAt,
        text: "Drakeford's first trip to The Swamp gave Florida early traction",
        validationMeta: { beatText: 'first trip to The Swamp' }
      },
      {
        id: 'xp_dup_robinson_old',
        status: 'hub_review',
        playerSlug: 'man-robinson',
        playerName: 'Man Robinson',
        createdAt: staleAt,
        sourceEventCreatedAt: staleAt,
        text: "Robinson's first trip to Gainesville gave Florida a clean early look",
        validationMeta: { beatText: 'first trip to Gainesville' }
      },
      {
        id: 'xp_dup_robinson_new',
        status: 'hub_review',
        playerSlug: 'man-robinson',
        playerName: 'Man Robinson',
        createdAt: freshAt,
        sourceEventCreatedAt: freshAt,
        text: 'Fresh Robinson intel with new staff contact angle',
        validationMeta: { beatText: 'DB coaches in daily contact after Gainesville' }
      },
      {
        id: 'xp_coach_billy',
        status: 'hub_review',
        playerSlug: 'billy-donovan',
        playerName: 'Billy Donovan',
        createdAt: freshAt,
        sourceEventCreatedAt: freshAt,
        text: 'Donovan was on campus in March',
        validationMeta: {
          beatText:
            'Former Florida coach Billy Donovan will become the lead assistant coach for the San Antonio Spurs'
        }
      }
    ]
  };

  fs.writeFileSync(tmpQueue, JSON.stringify(doc, null, 2));
  const prevQueuePath = process.env.X_AUTOPOSTER_QUEUE_PATH;
  process.env.X_AUTOPOSTER_QUEUE_PATH = tmpQueue;
  delete require.cache[require.resolve('../../lib/x-autoposter-store')];
  const store = require('../../lib/x-autoposter-store');

  try {
    const out = store.pruneStalePostStudioDrafts();
    assert.equal(out.prunedCount, 3);
    const drafts = store.listPostStudioDrafts({ limit: 20 });
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].playerSlug, 'man-robinson');
    assert.equal(drafts[0].id, 'xp_dup_robinson_new');
  } finally {
    delete require.cache[require.resolve('../../lib/x-autoposter-store')];
    if (prevQueuePath == null) delete process.env.X_AUTOPOSTER_QUEUE_PATH;
    else process.env.X_AUTOPOSTER_QUEUE_PATH = prevQueuePath;
    try {
      fs.unlinkSync(tmpQueue);
    } catch {
      /* optional */
    }
  }
});

test('isStalePostStudioDraft blocks thin recruiting templates and composed intel pollution', () => {
  const store = require('../../lib/x-autoposter-store');
  const freshAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const thomas = {
    id: 'xp_thomas_thin',
    status: 'hub_review',
    playerSlug: 'antonio-thomas-jr',
    createdAt: freshAt,
    sourceEventCreatedAt: freshAt,
    text: "2028 EDGE Antonio Thomas Jr · 4★ · On3 No. 17 natl · No. 4 EDGE · No. 5 FL\nFlorida is making Thomas a priority early, and the mutual interest is real.\ngatorvaultinsider.com/vault/futurecast/player/antonio-thomas-jr",
    validationMeta: {
      beatText:
        "Florida is making 2028 4-star EDGE Antonio Thomas Jr. a priority early on, and the interest is certainly mutual."
    }
  };
  const britt = {
    id: 'xp_britt_thin',
    status: 'hub_review',
    playerSlug: 'cale-britt',
    createdAt: freshAt,
    sourceEventCreatedAt: freshAt,
    text: "2028 LB Cale Britt · 4★ · On3 No. 267 natl · No. 21 LB · No. 37 FL\nFlorida's offer carried extra weight for Britt — hearing it directly from Billy Napier made the moment stand out",
    validationMeta: { beatText: 'Florida offered 2028 four-star linebacker Cale Britt.' }
  };

  assert.equal(store.isStalePostStudioDraft(thomas).reason, 'thin_recruiting_template');
  assert.equal(store.isStalePostStudioDraft(britt).reason, 'thin_recruiting_template');
  assert.equal(
    store.isComposedIntelPollution({
      detail:
        "2028 EDGE Antonio Thomas Jr · 4★ · On3 No. 17 natl · No. 4 EDGE · No. 5 FL\nFlorida is making Thomas a priority early, and the mutual interest is real.\ngatorvaultinsider.com/vault/futurecast/player/antonio-thomas-jr"
    }),
    true
  );
});
