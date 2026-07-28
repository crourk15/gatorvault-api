const autoposter = require('./x-autoposter');
const store = require('./x-autoposter-store');
const policy = require('./x-autoposter-policy');
const cadence = require('./x-autoposter-cadence');
const { refillAutoposterQueue, probeIntelAutoposterPath, republishPlayerIntel } = require('./x-autoposter-fill');
const freshness = require('./autoposter-freshness');
const {
  forcePostNow,
  forcePostQueueOnly,
  forcePostDiscover,
  formatForcePostJson
} = require('./autoposter-force-post');

const { verifyAdminPin, pinFromReq: adminPinFromReq } = require('./admin-pin');
const X_CRON_SECRET = process.env.X_AUTOPOST_CRON_SECRET || process.env.LIVE_CRON_SECRET || '';

function pinFromReq(req) {
  return adminPinFromReq(req) || req.headers['x-x-autopost-pin'];
}

function verifyCron(req) {
  const secret = req.headers['x-x-cron'] || req.headers['x-cron-secret'] || req.query?.secret || req.body?.secret;
  return !!X_CRON_SECRET && secret === X_CRON_SECRET;
}

const POST_STUDIO_REFILL_MEMORY_POLL_MS = parseInt(
  process.env.POST_STUDIO_REFILL_MEMORY_POLL_MS || '15000',
  10
);
const POST_STUDIO_REFILL_MEMORY_MAX_WAIT_MS = parseInt(
  process.env.POST_STUDIO_REFILL_MEMORY_MAX_WAIT_MS || '120000',
  10
);

function shouldSkipPostStudioRefillSafe(label) {
  const pipelineGuards = require('./pipeline-guards');
  if (typeof pipelineGuards.shouldSkipPostStudioRefill === 'function') {
    return pipelineGuards.shouldSkipPostStudioRefill(label);
  }
  return pipelineGuards.shouldSkipHeavyJob(label);
}

function schedulePostStudioRefillWhenReady(runRefill, refillState) {
  if (global.__postStudioRefillDeferred) return false;
  global.__postStudioRefillDeferred = true;
  global.__postStudioRefillRunning = true;
  refillState.setRunning(true);

  const pipelineGuards = require('./pipeline-guards');
  const startedAt = Date.now();

  const finish = (payload) => {
    global.__postStudioRefillRunning = false;
    global.__postStudioRefillDeferred = false;
    refillState.setRunning(false);
    refillState.setLastResult(payload);
    global.__postStudioRefillLastResult = payload;
  };

  const attempt = async () => {
    if (!shouldSkipPostStudioRefillSafe('post-studio-refill-deferred')) {
      try {
        const out = await runRefill();
        finish({ at: store.nowIso(), ...out });
      } catch (err) {
        finish({
          at: store.nowIso(),
          ok: false,
          error: err.message || 'refill_failed'
        });
      }
      return;
    }

    if (Date.now() - startedAt >= POST_STUDIO_REFILL_MEMORY_MAX_WAIT_MS) {
      finish({
        at: store.nowIso(),
        ok: false,
        error: 'memory_pressure',
        memory: pipelineGuards.memorySnapshot(),
        message: 'Server memory stayed elevated — wait 1–2 min and retry Refill.'
      });
      return;
    }

    setTimeout(attempt, POST_STUDIO_REFILL_MEMORY_POLL_MS);
  };

  setTimeout(attempt, POST_STUDIO_REFILL_MEMORY_POLL_MS);
  return true;
}

function queuePayloadFromBody(body) {
  return {
    text: body.text,
    category: body.category,
    action: body.action,
    topic: body.topic,
    sources: body.sources,
    inReplyToStatusId: body.inReplyToStatusId,
    quoteTweetUrl: body.quoteTweetUrl,
    quoteTweetId: body.quoteTweetId,
    promoLink: body.promoLink,
    scheduledAt: body.scheduledAt || null,
    mediaBase64: body.mediaBase64 || null,
    mediaMime: body.mediaMime || null,
    source: body.source || 'api'
  };
}

function mountXAutoposterRoutes(app) {
  app.get('/api/x/autoposter/policy', (req, res) => {
    try {
      return res.json({ ok: true, policy: policy.getContentPolicy() });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/x/autoposter/mix', (req, res) => {
    try {
      const mix = store.getMixStats({
        limit: parseInt(req.query.limit || '50', 10),
        sinceDays: parseInt(req.query.sinceDays || '14', 10)
      });
      return res.json({ ok: true, mix, policy: policy.getContentPolicy().contentMix });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/x/autoposter/status', async (req, res) => {
    try {
      const config = autoposter.getConfigStatus();
      const scheduler = autoposter.getSchedulerStatus();
      const probe = req.query.probe === '1';
      let verify = null;
      if (probe) verify = await autoposter.verifyCredentials({ force: true });
      const queue = store.listQueue({ limit: 5 });
      const pending = store.listQueue({ status: 'pending' });
      const due = pending.filter((i) => new Date(i.scheduledAt).getTime() <= Date.now());
      const mix = store.getMixStats();
      const pipelineHealth = require('./pipeline-health');
      const lastPostAt = scheduler.lastPostAt || scheduler.lastPostSuccess || null;
      const cadenceWindow = cadence.evaluatePostWindow({ pendingItems: pending, lastPostAt });
      let intelligence = null;
      try {
        intelligence = require('./autoposter/phase4-index').getOperationalIntel();
      } catch {
        /* optional */
      }
      return res.json({
        ok: true,
        ...config,
        schedulerEnabled: scheduler.schedulerEnabled,
        lastRun: scheduler.lastRun,
        lastPostAttempt: scheduler.lastPostAttempt,
        lastPostSuccess: scheduler.lastPostSuccess,
        lastPostAt,
        lastCadenceReason: scheduler.lastCadenceReason || cadenceWindow.reason,
        cadenceWaitMs: scheduler.cadenceWaitMs ?? cadenceWindow.waitMs ?? 0,
        nightMode: scheduler.nightMode ?? cadenceWindow.nightMode ?? cadence.isNightModeEst(),
        cadenceWindow: {
          allowed: cadenceWindow.allowed,
          reason: cadenceWindow.reason,
          waitMs: cadenceWindow.waitMs || 0,
          cooldownMs: cadenceWindow.cooldownMs || 0,
          tier: cadenceWindow.tier || null,
          label: cadenceWindow.label || null,
          breakingCount: cadenceWindow.breakingCount || 0,
          dailyCount: cadenceWindow.dailyCount ?? cadence.countDailyPosts(),
          dailyMax: cadenceWindow.dailyMax ?? cadence.DAILY_MAX_POSTS
        },
        cadenceConfig: cadence.getCadenceConfig(),
        lastRefillAt: scheduler.lastRefillAt,
        lastError: scheduler.lastError || (verify && !verify.ok ? verify.error : null),
        queuePending: pending.length,
        queueDue: due.length,
        queueRecent: queue,
        mix,
        verify,
        pipeline: pipelineHealth.getHealthReport(),
        intelligence,
        logs: autoposter.getAutoposterLogs(parseInt(req.query.logLimit || '20', 10) || 20)
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/x/autoposter/logs', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const limit = Math.min(100, parseInt(req.query.limit || '20', 10) || 20);
      return res.json({
        ok: true,
        logs: autoposter.getAutoposterLogs(limit),
        schedulerEnabled: process.env.X_AUTOPOST_ENABLED === 'true'
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/x/autoposter/elite/logs', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const eliteLog = require('./x-autoposter-elite-log');
      const limit = Math.min(100, parseInt(req.query.limit || '40', 10) || 40);
      return res.json({ ok: true, ...eliteLog.getDashboard({ limit }) });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/x/autoposter/cluster/logs', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const clusterLog = require('./x-autoposter-cluster-log');
      const limit = Math.min(100, parseInt(req.query.limit || '40', 10) || 40);
      return res.json({ ok: true, ...clusterLog.getDashboard({ limit }) });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/x/autoposter/detectives', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const dashboard = require('./autoposter/detectives-dashboard');
      const status = req.query.status ? String(req.query.status) : null;
      const limit = Math.min(100, parseInt(req.query.limit || '50', 10) || 50);
      return res.json({ ok: true, ...dashboard.getDetectivesDashboard({ status, limit }) });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/x/autoposter/detectives/backfill', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const backfill = require('./autoposter/detectives-backfill');
      const dashboard = require('./autoposter/detectives-dashboard');
      const limit = Math.min(120, parseInt(req.body?.limit || req.query?.limit || '80', 10) || 80);
      const stats = await backfill.backfillDetectivesPile({ limit });
      const summary = backfill.formatBackfillSummary(stats);
      return res.json({
        ok: true,
        message: summary
          ? `Scan complete — ${summary}.`
          : `Scan complete — ${stats.created || 0} new case(s).`,
        dashboard: dashboard.getDetectivesDashboard({ limit: 50 }),
        ...stats,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/x/autoposter/detectives/process', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const detectives = require('./autoposter/detectives');
      const dashboard = require('./autoposter/detectives-dashboard');
      const scheduler = require('./autoposter/detectives-scheduler');
      const limit = Math.min(5, parseInt(req.body?.limit || req.query?.limit || '1', 10) || 1);

      if (global.__detectivesManualRunning) {
        return res.json({
          ok: true,
          started: false,
          reason: 'already_running',
          message: 'A case is already being investigated. Reload the pile in a moment.',
          dashboard: dashboard.getDetectivesDashboard({ limit: 50 })
        });
      }

      global.__detectivesManualRunning = true;
      res.json({
        ok: true,
        started: true,
        async: true,
        message: `Investigating up to ${limit} case(s). Reload the pile in 30–60 seconds.`,
        dashboard: dashboard.getDetectivesDashboard({ limit: 50 })
      });

      setImmediate(async () => {
        try {
          await scheduler.runDetectivesBackgroundTick(limit);
        } catch (err) {
          console.warn('[detectives] manual process failed:', err.message);
        } finally {
          global.__detectivesManualRunning = false;
        }
      });
    } catch (err) {
      global.__detectivesManualRunning = false;
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/x/autoposter/probe/:slug', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const composeObs = require('./autoposter/compose-observability');
      const out = await composeObs.composeProbe(req.params.slug);
      return res.json(out);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/x/post-studio/compose-failures', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const composeObs = require('./autoposter/compose-observability');
      const slug = req.query.slug || null;
      const limit = parseInt(req.query.limit || '50', 10);
      return res.json(composeObs.listComposeFailureReport({ slug, limit }));
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/x/post-studio/leak-audit', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const leakAudit = require('./autoposter/recruiting-leak-audit');
      const includeCancelled =
        req.query.includeCancelled === '1' || req.query.includeCancelled === 'true';
      const report = leakAudit.runRecruitingLeakAudit({ includeCancelled });
      return res.status(report.pass ? 200 : 409).json(report);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/x/post-studio/compose-probe/:slug', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const composeObs = require('./autoposter/compose-observability');
      const out = await composeObs.composeProbe(req.params.slug);
      return res.json(out);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/x/post-studio/pipeline', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const inbox = require('./post-studio-intel-inbox');
      return res.json(await inbox.getPipelineDashboard());
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/x/post-studio/inbox', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const inbox = require('./post-studio-intel-inbox');
      const limit = parseInt(req.query.limit || '40', 10);
      return res.json(await inbox.getIntelInbox({ limit }));
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/x/post-studio/inspect/:slug', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const inbox = require('./post-studio-intel-inbox');
      return res.json(await inbox.inspectPlayer(req.params.slug));
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /** Beat Brief Desk — paste-ready player/UF packet for Cursor / Copilot → X. */
  app.get('/api/x/post-studio/brief/:slug', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const { buildBeatBrief } = require('./beat-brief-packet');
      const out = await buildBeatBrief(req.params.slug);
      return res.status(out.ok ? 200 : 400).json(out);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/x/autoposter/republish/:slug', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const out = await republishPlayerIntel(req.params.slug, {
        post: req.body?.post === true || req.query.post === '1' || req.query.post === 'true',
        fingerprint: req.body?.fingerprint || req.query.fingerprint || null
      });
      return res.status(out.ok ? 200 : 400).json(out);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/x/autoposter/health/self-heal', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const selfHeal = require('./autoposter/elite-self-heal');
      const out = await selfHeal.runSelfHealHealthCheck({
        limit: parseInt(req.query.limit || '16', 10),
        _testSkipRefresh: req.query.skipRefresh === '1'
      });
      return res.status(out.ok ? 200 : 503).json(out);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/x/autoposter/self-heal/run', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const selfHeal = require('./autoposter/elite-self-heal');
      const slug = req.body?.slug || req.query.slug || null;
      const out = await selfHeal.runSelfHealScan({
        dryRun: req.body?.dryRun === true || req.query.dryRun === '1',
        post: req.body?.post === true || req.query.post === '1',
        maxHeal: parseInt(req.body?.maxHeal || req.query.maxHeal || '2', 10),
        slug,
        slugs: slug ? [slug] : undefined,
        force: req.body?.force === true || req.query.force === '1'
      });
      return res.json(out);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/x/autoposter/validate', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const check = policy.validatePostContent(queuePayloadFromBody(req.body));
      return res.json({ ok: check.valid, ...check });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/x/autoposter/verify', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const verify = await autoposter.verifyCredentials({ force: true });
      return res.json({ ok: verify.ok, verify });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/x/autoposter/post', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const payload = queuePayloadFromBody(req.body);
      const check = policy.validatePostContent(payload);
      const dryRun = req.body.dryRun === true || req.query.dryRun === '1';

      if (!check.valid) {
        return res.status(400).json({ ok: false, error: 'Validation failed', ...check });
      }

      if (dryRun) {
        const verify = await autoposter.verifyCredentials({ force: true });
        return res.json({
          ok: verify.ok,
          dryRun: true,
          verify,
          validation: check,
          wouldPost: payload
        });
      }

      const result = await autoposter.postTweet({
        text: payload.text,
        mediaBase64: payload.mediaBase64 || null,
        mediaMime: payload.mediaMime || null,
        inReplyToStatusId: payload.action === 'reply' ? payload.inReplyToStatusId : null,
        quoteTweetUrl: payload.action === 'quote' ? payload.quoteTweetUrl : null,
        quoteTweetId: payload.action === 'quote' ? payload.quoteTweetId : null
      });
      return res.json({ ok: true, category: payload.category, action: payload.action, ...result });
    } catch (err) {
      return res.status(err.status === 403 ? 403 : 500).json({ ok: false, error: err.message, body: err.body || null });
    }
  });

  app.get('/api/x/autoposter/queue', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const status = req.query.status || null;
      const category = req.query.category || null;
      const triggerType = req.query.triggerType || req.query.eventType || null;
      const items = store.listQueue({
        status,
        category,
        triggerType,
        limit: parseInt(req.query.limit || '50', 10)
      });
      return res.json({
        ok: true,
        items,
        mix: store.getMixStats(),
        updatedAt: store.loadQueue().updatedAt
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/x/autoposter/queue', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const tagged = cadence.tagCandidate(queuePayloadFromBody(req.body));
      const out = store.enqueuePost(tagged);
      return res.json({ ok: true, item: out.item, mix: out.mix });
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: err.message,
        validation: err.validation || null
      });
    }
  });

  app.delete('/api/x/autoposter/queue/:id', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const item = store.cancelPost(req.params.id);
      return res.json({ ok: true, item });
    } catch (err) {
      return res.status(404).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/x/autoposter/run', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req)) && !verifyCron(req)) {
      return res.status(401).json({ ok: false, error: 'Invalid PIN or cron secret' });
    }
    try {
      autoposter.saveSchedulerStatus({ lastRun: store.nowIso() });
      const force = req.body.force === true || req.query.force === '1' || req.query.force === 'true';
      const refill = req.body.refill !== false
        ? await refillAutoposterQueue({
            minPending: 2,
            maxEnqueue: 5,
            forcePost: force,
            digDeeper: force || req.body.digDeeper === true
          })
        : null;
      if (refill) {
        autoposter.saveSchedulerStatus({
          lastRefillAt: store.nowIso(),
          lastRefillCount: refill.enqueuedCount || 0
        });
      }
      const out = await autoposter.processDuePosts({
        limit: parseInt(req.body.limit || req.query.limit || '1', 10),
        force
      });
      autoposter.saveSchedulerStatus({
        lastProcessedCount: out.processed || 0,
        lastCadenceReason: out.cadence?.reason || out.reason || null
      });
      const scheduler = autoposter.getSchedulerStatus();
      return res.json({
        ok: true,
        refill,
        mix: store.getMixStats(),
        logs: autoposter.getAutoposterLogs(20),
        lastRun: scheduler.lastRun,
        lastPostAttempt: scheduler.lastPostAttempt,
        lastPostSuccess: scheduler.lastPostSuccess,
        lastPostAt: scheduler.lastPostAt || scheduler.lastPostSuccess || null,
        lastCadenceReason: scheduler.lastCadenceReason,
        cadenceWaitMs: scheduler.cadenceWaitMs,
        nightMode: scheduler.nightMode,
        lastError: scheduler.lastError,
        forced: force,
        ...out
      });
    } catch (err) {
      autoposter.saveSchedulerStatus({ lastError: err.message });
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/autoposter/status', async (req, res) => {
    try {
      const scheduler = autoposter.getSchedulerStatus();
      const pending = store.listQueue({ status: 'pending' });
      const status = freshness.getAutoposterStatus({
        scheduler: { ...scheduler, queuePending: pending.length }
      });
      return res.json({
        lastPostAt: status.lastPostAt,
        lastPostAttempt: status.lastPostAttempt,
        minutesSinceLastPost: status.minutesSinceLastPost,
        lastPostLabel: status.lastPostLabel,
        postsLast24h: status.postsLast24h,
        status: status.status,
        activityWindow: status.activityWindow,
        errors24h: status.errors24h,
        identityFailStreak: status.identityFailStreak
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/autoposter/force-post/status', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    const running = !!global.__forcePostRunning;
    const last = global.__forcePostLastResult || null;
    return res.json({
      ok: true,
      running,
      lastResult: last,
      pendingCount: store.listQueue({ status: 'pending' }).length
    });
  });

  app.post('/api/autoposter/force-post', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const syncOnly = req.body?.sync === true || req.query?.sync === '1';

      const quick = await forcePostQueueOnly();
      if (quick?.posted || (quick && !quick.posted && quick.error)) {
        const formatted = formatForcePostJson(quick);
        return res.status(formatted.status).json(formatted.body);
      }

      if (global.__forcePostRunning) {
        return res.json({
          ok: true,
          started: false,
          async: true,
          reason: 'already_running',
          message: 'Force post already running in background. Check autoposter logs.',
          pendingCount: store.listQueue({ status: 'pending' }).length
        });
      }

      if (syncOnly) {
        const out = await forcePostNow();
        const formatted = formatForcePostJson(out);
        return res.status(formatted.status).json(formatted.body);
      }

      global.__forcePostRunning = true;
      global.__forcePostLastResult = null;
      res.json({
        ok: true,
        started: true,
        async: true,
        message:
          'Queue empty — running full force-post in background (beat ingest + discovery). Check autoposter logs in 1–2 min.',
        pendingCount: store.listQueue({ status: 'pending' }).length
      });

      setImmediate(async () => {
        try {
          const out = await forcePostDiscover();
          global.__forcePostLastResult = { at: store.nowIso(), ...formatForcePostJson(out).body };
        } catch (err) {
          global.__forcePostLastResult = {
            at: store.nowIso(),
            ok: false,
            posted: false,
            error: err.message || 'x_api_error'
          };
        } finally {
          global.__forcePostRunning = false;
        }
      });
    } catch (err) {
      global.__forcePostRunning = false;
      return res.status(500).json({ ok: false, error: 'x_api_error', message: err.message });
    }
  });

  app.get('/api/x/post-studio/config', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const payload = {
        ok: true,
        ...cadence.getHubConfig(),
        stats: cadence.getHubStats(),
        counts: store.getQueueCounts()
      };
      try {
        const inboxMod = require('./post-studio-intel-inbox');
        const [pipeline, inbox] = await Promise.all([
          inboxMod.getPipelineDashboard(),
          inboxMod.getIntelInbox({ limit: 40 })
        ]);
        payload.pipeline = pipeline;
        payload.inbox = inbox;
      } catch (bundleErr) {
        payload.pipelineError = bundleErr.message;
      }
      return res.json(payload);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/x/post-studio/queue', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const migrated = store.migratePendingToHubReview();
      const limit = parseInt(req.query.limit || '50', 10);
      const status = req.query.status || null;
      const items = status
        ? store.listQueue({ status, limit })
        : store.listPostStudioDrafts({ limit });
      return res.json({
        ok: true,
        items,
        migrated,
        stats: cadence.getHubStats(),
        counts: store.getQueueCounts(),
        updatedAt: store.loadQueue().updatedAt
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/x/post-studio/refill/status', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    const refillState = require('./post-studio-refill-state');
    const persisted = refillState.getStatus();
    const running = !!global.__postStudioRefillRunning || persisted.running;
    const last = global.__postStudioRefillLastResult || persisted.lastResult || null;
    const counts = store.getQueueCounts();
    return res.json({
      ok: true,
      running,
      lastResult: last,
      drafts: counts.drafts,
      hubReview: counts.hub_review,
      pending: counts.pending
    });
  });

  app.post('/api/x/post-studio/refill', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const syncOnly = req.body?.sync === true || req.query?.sync === '1';
      const refillState = require('./post-studio-refill-state');
      const pipelineGuards = require('./pipeline-guards');
      if (global.__postStudioRefillRunning || refillState.getStatus().running) {
        return res.json({
          ok: true,
          async: true,
          started: false,
          reason: 'already_running',
          message: 'Refill already running in background. Wait ~1 min then Reload drafts.'
        });
      }
      const memorySnapshot = pipelineGuards.memorySnapshot();
      const memoryBlocked = shouldSkipPostStudioRefillSafe('post-studio-refill');
      const digDeeperDefault = req.body?.digDeeper !== false;
      const maxEnqueueDefault = parseInt(req.body?.maxEnqueue || req.query?.maxEnqueue || '5', 10);

      const runRefill = async (opts = {}) => {
        store.migratePendingToHubReview();
        store.pruneStalePostStudioDrafts();
        const elevated = pipelineGuards.memorySnapshot().rssMb >= pipelineGuards.MEMORY_WARN_MB;
        const maxEnqueue = opts.maxEnqueue ?? (elevated ? Math.min(maxEnqueueDefault, 2) : maxEnqueueDefault);
        const digDeeper = opts.digDeeper ?? (elevated ? false : digDeeperDefault);
        const refill = await refillAutoposterQueue({
          minPending: parseInt(req.body?.minPending || req.query?.minPending || '2', 10),
          maxEnqueue,
          forcePost: true,
          digDeeper,
          hubStudioRefill: true
        });
        const counts = store.getQueueCounts();
        return {
          ok: true,
          refill,
          enqueuedCount: refill.enqueuedCount || 0,
          drafts: counts.drafts,
          hubReview: counts.hub_review,
          pending: counts.pending,
          skipReasons: (refill.skipReasons || []).slice(0, 8),
          reason: refill.reason || null,
          counts,
          stats: cadence.getHubStats()
        };
      };

      if (memoryBlocked) {
        if (syncOnly) {
          return res.status(503).json({
            ok: false,
            error: 'memory_pressure',
            memory: memorySnapshot,
            message: 'Server memory is elevated — wait 30–60s and retry Refill.'
          });
        }
        if (!schedulePostStudioRefillWhenReady(runRefill, refillState)) {
          return res.json({
            ok: true,
            async: true,
            started: false,
            reason: 'already_running',
            message: 'Refill already running in background. Wait ~1 min then Reload drafts.'
          });
        }
        return res.json({
          ok: true,
          async: true,
          started: true,
          deferred: true,
          reason: 'memory_pressure',
          memory: memorySnapshot,
          message:
            'Server memory is elevated — refill queued. Poll status in ~30–60s (no need to click Refill again).'
        });
      }

      if (syncOnly) {
        const out = await runRefill();
        refillState.setLastResult({ at: store.nowIso(), ...out });
        return res.json(out);
      }

      global.__postStudioRefillRunning = true;
      global.__postStudioRefillLastResult = null;
      refillState.setRunning(true);
      res.json({
        ok: true,
        async: true,
        started: true,
        message: 'Refill running in background (30–90s). This panel will update when done.'
      });

      setImmediate(async () => {
        try {
          const out = await runRefill();
          const payload = { at: store.nowIso(), ...out };
          global.__postStudioRefillLastResult = payload;
          refillState.setLastResult(payload);
        } catch (err) {
          const payload = {
            at: store.nowIso(),
            ok: false,
            error: err.message || 'refill_failed'
          };
          global.__postStudioRefillLastResult = payload;
          refillState.setLastResult(payload);
        } finally {
          global.__postStudioRefillRunning = false;
          refillState.setRunning(false);
        }
      });
    } catch (err) {
      global.__postStudioRefillRunning = false;
      try {
        require('./post-studio-refill-state').setRunning(false);
      } catch {
        /* optional */
      }
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/x/post-studio/compose', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const slug = String(req.body?.slug || req.query?.slug || '').trim().toLowerCase();
      if (!slug) return res.status(400).json({ ok: false, error: 'slug required' });
      const out = await republishPlayerIntel(slug, { force: req.body?.force === true });
      if (!out?.ok && !out?.preview) {
        return res.status(400).json({ ok: false, error: out?.error || out?.enqueue?.reason || 'compose_failed', detail: out });
      }
      const item = out.item || out.enqueue?.item || null;
      if (item && item.status !== 'hub_review') {
        store.updatePost(item.id, { status: 'hub_review' });
        item.status = 'hub_review';
      }
      return res.json({
        ok: true,
        slug,
        item,
        preview: out.preview || item?.text || null,
        composePath: out.composePath || item?.validationMeta?.composePath || null,
        detail: out
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/x/post-studio/:id/promote', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const pipelineGuards = require('./pipeline-guards');
      if (!pipelineGuards.autoposterSchedulerEnabled()) {
        return res.status(403).json({
          ok: false,
          error: 'scheduler_disabled',
          message: 'Autoposter scheduler is off. Post manually via X app (no API credits).'
        });
      }
      const pending = store.listQueue({ status: 'pending' }).length;
      if (pending >= cadence.autoQueueMax()) {
        return res.status(409).json({
          ok: false,
          error: 'auto_queue_full',
          message: `Autoposter queue full (${cadence.autoQueueMax()} max). Post manually or wait for auto posts today.`
        });
      }
      const item = store.promoteToAutoposter(req.params.id);
      return res.json({ ok: true, item, stats: cadence.getHubStats() });
    } catch (err) {
      return res.status(404).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/x/post-studio/:id/mark-posted', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const item = store.markManualPosted(req.params.id, {
        tweetUrl: req.body?.tweetUrl || req.body?.url || null,
        tweetId: req.body?.tweetId || null
      });
      return res.json({ ok: true, item, stats: cadence.getHubStats() });
    } catch (err) {
      return res.status(404).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/x/post-studio/:id/dismiss', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const item = store.cancelPost(req.params.id);
      return res.json({ ok: true, item });
    } catch (err) {
      return res.status(404).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/x/post-studio/:id/post-api', async (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const pipelineGuards = require('./pipeline-guards');
      if (!pipelineGuards.autoposterSchedulerEnabled()) {
        return res.status(403).json({
          ok: false,
          error: 'scheduler_disabled',
          message: 'API posting disabled. Use Copy / Open X compose, then Mark Posted.'
        });
      }
      const doc = store.loadQueue();
      const item = doc.items.find((i) => i.id === req.params.id);
      if (!item) return res.status(404).json({ ok: false, error: 'Queue item not found' });
      const check = policy.validatePostContent(item);
      if (!check.valid) {
        return res.status(400).json({ ok: false, error: 'Validation failed', ...check });
      }
      const result = await autoposter.postTweet({
        text: item.text,
        mediaBase64: item.mediaBase64 || null,
        mediaMime: item.mediaMime || null,
        inReplyToStatusId: item.action === 'reply' ? item.inReplyToStatusId : null,
        quoteTweetUrl: item.action === 'quote' ? item.quoteTweetUrl : null,
        quoteTweetId: item.action === 'quote' ? item.quoteTweetId : null
      });
      const updated = store.updatePost(item.id, {
        status: 'sent',
        sentAt: store.nowIso(),
        tweetId: result.tweetId || null,
        tweetUrl: result.tweetUrl || null,
        postMethod: 'api',
        error: null
      });
      try {
        const ledger = require('./x-autoposter-sent-ledger');
        ledger.recordSentPost(updated);
      } catch {
        /* optional */
      }
      return res.json({ ok: true, item: updated, ...result });
    } catch (err) {
      return res.status(err.status === 403 ? 403 : 500).json({ ok: false, error: err.message, body: err.body || null });
    }
  });

  app.patch('/api/x/post-studio/:id', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const patch = {};
      if (req.body?.text != null) patch.text = String(req.body.text).trim();
      if (!patch.text) return res.status(400).json({ ok: false, error: 'text required' });
      const check = policy.validatePostContent({ ...req.body, text: patch.text });
      if (!check.valid) {
        return res.status(400).json({ ok: false, error: 'Validation failed', ...check });
      }
      const item = store.updatePost(req.params.id, patch);
      return res.json({ ok: true, item, validation: check });
    } catch (err) {
      return res.status(404).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountXAutoposterRoutes };
