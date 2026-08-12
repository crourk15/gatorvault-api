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

  /**
   * Member self-serve: email + push a verified scheduled OV to the signed-in account.
   * Body: { slug?: 'brysen-wright' } — defaults to first upcoming board OV / Brysen.
   */
  app.post("/api/alerts/send-visit-alert", async (req, res) => {
    const auth = requireAlertEmailSession(req, res);
    if (!auth) return;
    const email = String(auth.session.email || "").toLowerCase();
    await upsertEmailAlertPrefs(email, {
      method: "both",
      freq: "instant",
      visit: true,
      followPlayers: [],
    });

    const slug = String(req.body?.slug || "brysen-wright").trim().toLowerCase() || "brysen-wright";
    const visitLogStore = require("./recruiting-visit-log-store");
    const logs = visitLogStore.listVisitLogs({ playerSlug: slug, limit: 20 });
    const { isOfficialVisitType, getVerifiedFloridaVisitWindow, todayYmd } = require("./visit-intel-utils");
    const today = todayYmd(new Date());
    let log =
      logs.find((row) => {
        if (!isOfficialVisitType(row.visitType)) return false;
        const window = getVerifiedFloridaVisitWindow(row);
        return window && (window.visitEnd >= today || window.visitStart >= today);
      }) || null;

    if (!log) {
      log = {
        playerSlug: slug,
        playerName: slug === "brysen-wright" ? "Brysen Wright" : slug,
        school: "Florida",
        visitType: "official_visit",
        date: "2026-08-22",
        source: "manual",
        fingerprint: `visit|${slug}|florida|official_visit|self-serve|${Date.now()}`,
        identityConfirmed: true,
      };
    }

    const {
      sendSubscriberDigestEmail,
      buildVisitScheduledEmailHtml,
    } = require("./visit-intel-email-digest");
    const { dispatchVisitPushToEmail } = require("./push-alert-service");
    const name = log.playerName || log.playerSlug;
    const subject = `Verified UF OV scheduled — ${name}`;
    let emailOut = { sent: false };
    try {
      emailOut = await sendSubscriberDigestEmail(
        email,
        subject,
        buildVisitScheduledEmailHtml(log)
      );
    } catch (err) {
      emailOut = { sent: false, reason: err.message };
    }
    const pushOut = await dispatchVisitPushToEmail(email, log, {
      force: true,
      fingerprint: `self_serve_visit|${email}|${log.fingerprint || slug}|${Date.now()}`,
    });

    return res.json({
      ok: Boolean(emailOut.sent || (pushOut.sent || 0) > 0),
      email: emailOut,
      push: pushOut,
      playerSlug: log.playerSlug,
      playerName: name,
      hint:
        !pushOut.ok && pushOut.error === "no_devices"
          ? "Email attempted. For lock-screen: Save Preferences first, then retry."
          : null,
    });
  });
}

module.exports = { mountAlertEmailRoutes };