const {
  getPublicConfig,
  upsertSubscription,
  removeSubscription,
  updateSubscriptionPrefs,
  requirePushSession,
} = require('./push-alert-service');

function mountPushAlertRoutes(app) {
  app.get('/api/push/config', (_req, res) => {
    res.json({ ok: true, ...getPublicConfig() });
  });

  app.post('/api/push/subscribe', (req, res) => {
    const auth = requirePushSession(req, res);
    if (!auth) return;
    const subscription = req.body?.subscription;
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ ok: false, error: 'Push subscription object required.' });
    }
    const prefs = req.body?.prefs || {};
    const out = upsertSubscription(auth.session.email, subscription, prefs);
    if (!out.ok) return res.status(400).json(out);
    return res.json({ ok: true, subscribed: true, endpoint: out.endpoint });
  });

  app.post('/api/push/unsubscribe', (req, res) => {
    const auth = requirePushSession(req, res);
    if (!auth) return;
    const endpoint = String(req.body?.endpoint || '').trim();
    if (!endpoint) return res.status(400).json({ ok: false, error: 'endpoint required.' });
    return res.json(removeSubscription(endpoint));
  });

  app.patch('/api/push/preferences', (req, res) => {
    const auth = requirePushSession(req, res);
    if (!auth) return;
    const endpoint = String(req.body?.endpoint || '').trim();
    if (!endpoint) return res.status(400).json({ ok: false, error: 'endpoint required.' });
    const out = updateSubscriptionPrefs(auth.session.email, endpoint, req.body?.prefs || {});
    if (!out.ok) return res.status(404).json(out);
    return res.json({ ok: true, updated: true });
  });
}

module.exports = { mountPushAlertRoutes };
