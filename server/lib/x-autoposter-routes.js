const autoposter = require('./x-autoposter');
const store = require('./x-autoposter-store');
const policy = require('./x-autoposter-policy');
const { refillAutoposterQueue } = require('./x-autoposter-fill');

const X_AUTOPOST_PIN =
  process.env.X_AUTOPOST_PIN ||
  process.env.RECRUITING_ADMIN_PIN ||
  process.env.CONTENT_ADMIN_PIN ||
  process.env.EMAIL_TEST_PIN ||
  'GV2026admin';

const X_CRON_SECRET = process.env.X_AUTOPOST_CRON_SECRET || process.env.LIVE_CRON_SECRET || '';

function verifyAdminPin(pin) {
  return !!pin && pin === X_AUTOPOST_PIN;
}

function pinFromReq(req) {
  return req.headers['x-x-autopost-pin'] || req.headers['x-recruiting-pin'] || req.body?.pin || req.query?.pin;
}

function verifyCron(req) {
  const secret = req.headers['x-x-cron'] || req.headers['x-cron-secret'] || req.query?.secret || req.body?.secret;
  return !!X_CRON_SECRET && secret === X_CRON_SECRET;
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
      return res.json({
        ok: true,
        ...config,
        schedulerEnabled: scheduler.schedulerEnabled,
        lastRun: scheduler.lastRun,
        lastPostAttempt: scheduler.lastPostAttempt,
        lastPostSuccess: scheduler.lastPostSuccess,
        lastRefillAt: scheduler.lastRefillAt,
        lastError: scheduler.lastError || (verify && !verify.ok ? verify.error : null),
        queuePending: pending.length,
        queueDue: due.length,
        queueRecent: queue,
        mix,
        verify,
        pipeline: pipelineHealth.getHealthReport(),
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
      const items = store.listQueue({
        status,
        category,
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
      const out = store.enqueuePost(queuePayloadFromBody(req.body));
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
      const refill = req.body.refill !== false
        ? await refillAutoposterQueue({ minPending: 2, maxEnqueue: 5 })
        : null;
      if (refill) {
        autoposter.saveSchedulerStatus({
          lastRefillAt: store.nowIso(),
          lastRefillCount: refill.enqueuedCount || 0
        });
      }
      const out = await autoposter.processDuePosts({
        limit: parseInt(req.body.limit || req.query.limit || '5', 10)
      });
      autoposter.saveSchedulerStatus({
        lastProcessedCount: out.processed || 0
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
        lastError: scheduler.lastError,
        ...out
      });
    } catch (err) {
      autoposter.saveSchedulerStatus({ lastError: err.message });
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountXAutoposterRoutes };
