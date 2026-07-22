const {
  getPublicConfig,
  upsertSubscription,
  upsertDeviceToken,
  removeSubscription,
  removeDeviceTokensForEmail,
  updateSubscriptionPrefs,
  requirePushSession,
  dispatchTestPushToEmail,
} = require('./push-alert-service');

function mountPushAlertRoutes(app) {
  app.get('/api/push/config', (_req, res) => {
    res.json({ ok: true, ...getPublicConfig() });
  });

  app.post('/api/push/subscribe', async (req, res) => {
    const auth = requirePushSession(req, res);
    if (!auth) return;
    const subscription = req.body?.subscription;
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ ok: false, error: 'Push subscription object required.' });
    }
    const prefs = req.body?.prefs || {};
    const out = upsertSubscription(auth.session.email, subscription, prefs);
    if (!out.ok) return res.status(400).json(out);
    let confirm = null;
    // Confirmation ping only when client asks (Save Preferences), not silent re-subscribes.
    if (req.body?.confirm === true && (prefs.visit || prefs.commit || prefs.score)) {
      confirm = await dispatchTestPushToEmail(auth.session.email, { kind: 'confirm' });
    }
    return res.json({ ok: true, subscribed: true, endpoint: out.endpoint, confirm });
  });

  app.post('/api/push/device', async (req, res) => {
    const auth = requirePushSession(req, res);
    if (!auth) return;
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ ok: false, error: 'device token required.' });
    const prefs = req.body?.prefs || {};
    const platform = String(req.body?.platform || 'ios').trim() || 'ios';
    const out = upsertDeviceToken(auth.session.email, token, prefs, platform);
    if (!out.ok) return res.status(400).json(out);
    let confirm = null;
    // Default confirm=true so existing App Store binaries get a lock-screen proof on Save.
    // Boot token refresh passes confirm:false to avoid spamming every launch.
    const wantsConfirm = req.body?.confirm !== false;
    if (wantsConfirm && (prefs.visit || prefs.commit || prefs.score)) {
      confirm = await dispatchTestPushToEmail(auth.session.email, { kind: 'confirm' });
    }
    return res.json({ ok: true, registered: true, token: out.token, confirm });
  });

  /** Member self-serve phone QA — push only to the signed-in account. */
  app.post('/api/push/test', async (req, res) => {
    const auth = requirePushSession(req, res);
    if (!auth) return;
    const kind = String(req.body?.kind || 'confirm').toLowerCase();
    const allowed = new Set(['confirm', 'visit', 'commit', 'score']);
    if (!allowed.has(kind)) {
      return res.status(400).json({ ok: false, error: 'kind must be confirm|visit|commit|score' });
    }
    const out = await dispatchTestPushToEmail(auth.session.email, {
      kind,
      fingerprint: req.body?.force
        ? `push_test_force|${auth.session.email}|${kind}|${Date.now()}`
        : undefined,
    });
    if (!out.ok && out.error === 'no_devices') {
      return res.status(404).json(out);
    }
    if (!out.ok && out.error === 'membership_required') {
      return res.status(403).json(out);
    }
    return res.json(out);
  });

  app.post('/api/push/device/unregister', (req, res) => {
    const auth = requirePushSession(req, res);
    if (!auth) return;
    const platform = req.body?.platform ? String(req.body.platform) : null;
    return res.json(removeDeviceTokensForEmail(auth.session.email, platform));
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
