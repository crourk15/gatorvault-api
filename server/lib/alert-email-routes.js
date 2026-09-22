const {
  upsertEmailAlertPrefs,
  getEmailAlertPrefs,
  describeVisitEmailSchedule,
  maskEmail,
  requireAlertEmailSession,
} = require("./alert-email-prefs-service");

function mountAlertEmailRoutes(app) {
  app.get("/api/alerts/status", async (req, res) => {
    const auth = requireAlertEmailSession(req, res);
    if (!auth) return;
    const email = String(auth.session.email || "").toLowerCase();
    const stored = await getEmailAlertPrefs(email);
    const prefs = stored?.prefs || null;
    const { isVisitEmailReady } = require("./visit-intel-email-digest");
    const { isEmailJsReady } = require("./emailjs-config");
    const { isResendReady } = require("./resend-server");
    const { pushEnabled, summarizePushForEmail } = require("./push-alert-service");
    return res.json({
      ok: true,
      email: maskEmail(email),
      prefs,
      savedAt: stored?.updatedAt || null,
      emailReady: isVisitEmailReady(),
      emailProviders: {
        emailjs: Boolean(isEmailJsReady()),
        resend: Boolean(isResendReady()),
      },
      visitEmail: describeVisitEmailSchedule(prefs),
      push: {
        enabled: pushEnabled(),
        ...summarizePushForEmail(email),
      },
    });
  });

  app.get("/api/alerts/email-preferences", async (req, res) => {
    const auth = requireAlertEmailSession(req, res);
    if (!auth) return;
    const stored = await getEmailAlertPrefs(auth.session.email);
    return res.json({
      ok: true,
      prefs: stored?.prefs || null,
      savedAt: stored?.updatedAt || null,
    });
  });

  app.post("/api/alerts/email-preferences", async (req, res) => {
    const auth = requireAlertEmailSession(req, res);
    if (!auth) return;
    const out = await upsertEmailAlertPrefs(auth.session.email, req.body?.prefs || req.body || {});
    if (!out.ok) return res.status(400).json(out);
    const stored = await getEmailAlertPrefs(out.email);
    return res.json({
      ok: true,
      updated: true,
      email: maskEmail(out.email),
      prefs: stored?.prefs || null,
      visitEmail: describeVisitEmailSchedule(stored?.prefs || null),
    });
  });

  /**
   * Member self-serve: email + push a verified scheduled OV to the signed-in account.
   * Body: { slug?: 'brysen-wright' } — defaults to first upcoming board OV / Brysen.
   */
  app.post("/api/alerts/send-visit-alert", async (req, res) => {
    const auth = requireAlertEmailSession(req, res);
    if (!auth) return;
    const email = String(auth.session.email || "").toLowerCase();
    // One-off proof send — never overwrite Daily / Weekly / method the member saved.

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
    // Lock-screen first. EmailJS/Resend retries were blocking APNs, so Test
    // looked dead for several seconds (or never returned).
    const pushOut = await dispatchVisitPushToEmail(email, log, {
      force: true,
      fingerprint: `self_serve_visit|${email}|${log.fingerprint || slug}|${Date.now()}`,
    });
    let emailOut = { sent: false };
    try {
      emailOut = await sendSubscriberDigestEmail(
        email,
        subject,
        buildVisitScheduledEmailHtml(log),
        { playerSlug: log.playerSlug || slug }
      );
    } catch (err) {
      emailOut = { sent: false, reason: err.message };
    }

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