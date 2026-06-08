const autoposter = require('./x-autoposter');
const store = require('./x-autoposter-store');

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

function mountXAutoposterRoutes(app) {
  app.get('/api/x/autoposter/status', async (req, res) => {
    try {
      const config = autoposter.getConfigStatus();
      const probe = req.query.probe === '1';
      let verify = null;
      if (probe) verify = await autoposter.verifyCredentials({ force: true });
      const queue = store.listQueue({ limit: 5 });
      const pending = store.listQueue({ status: 'pending' }).length;
      return res.json({
        ok: true,
        ...config,
        queuePending: pending,
        queueRecent: queue,
        verify
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
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
      const text = String(req.body.text || '').trim();
      if (!text) return res.status(400).json({ ok: false, error: 'text required' });
      const dryRun = req.body.dryRun === true || req.query.dryRun === '1';
      if (dryRun) {
        const verify = await autoposter.verifyCredentials({ force: true });
        return res.json({ ok: verify.ok, dryRun: true, verify, wouldPost: text.slice(0, 280) });
      }
      const result = await autoposter.postTweet({
        text,
        mediaBase64: req.body.mediaBase64 || null,
        mediaMime: req.body.mediaMime || null
      });
      return res.json({ ok: true, ...result });
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
      const items = store.listQueue({ status, limit: parseInt(req.query.limit || '50', 10) });
      return res.json({ ok: true, items, updatedAt: store.loadQueue().updatedAt });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/x/autoposter/queue', (req, res) => {
    if (!verifyAdminPin(pinFromReq(req))) {
      return res.status(401).json({ ok: false, error: 'Invalid admin PIN' });
    }
    try {
      const item = store.enqueuePost({
        text: req.body.text,
        scheduledAt: req.body.scheduledAt || null,
        mediaBase64: req.body.mediaBase64 || null,
        mediaMime: req.body.mediaMime || null,
        source: req.body.source || 'api'
      });
      return res.json({ ok: true, item });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
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
      const out = await autoposter.processDuePosts({
        limit: parseInt(req.body.limit || req.query.limit || '5', 10)
      });
      return res.json({ ok: true, ...out });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { mountXAutoposterRoutes };
