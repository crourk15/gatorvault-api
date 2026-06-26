const {
  upsertEmailAlertPrefs,
  requireAlertEmailSession,
} = require("./alert-email-prefs-service");

function mountAlertEmailRoutes(app) {
  app.post("/api/alerts/email-preferences", async (req, res) => {
    const auth = requireAlertEmailSession(req, res);
    if (!auth) return;
    const out = await upsertEmailAlertPrefs(auth.session.email, req.body?.prefs || req.body || {});
    if (!out.ok) return res.status(400).json(out);
    return res.json({ ok: true, updated: true, email: out.email });
  });
}

module.exports = { mountAlertEmailRoutes };