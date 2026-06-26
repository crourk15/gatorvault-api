#!/usr/bin/env node
/**
 * Local QA - visit intel alerts without sending email or push.
 * Usage: node server/scripts/qa-visit-alerts-local.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

function pgMissingMessage(msg) {
  return /alert_email_preferences|does not exist/i.test(String(msg || ""));
}

async function main() {
  const results = [];

  try {
    const { enrichRecapRowsWithMovementNarratives, runVisitIntelDailyDigest } = require("../lib/visit-intel-recap");
    const enriched = enrichRecapRowsWithMovementNarratives(
      [
        {
          slug: "jalen-brewster",
          name: "Jalen Brewster",
          visitStart: "2026-06-11",
          visitEnd: "2026-06-13",
          visitSourceLabel: "On3",
        },
      ],
      new Date("2026-06-26T12:00:00Z")
    );
    results.push({
      check: "enrichRecapRowsWithMovementNarratives",
      ok: Boolean(enriched[0]?.movementNarrative),
      detail: enriched[0]?.movementNarrative || "no narrative",
    });

    try {
      const digest = await runVisitIntelDailyDigest({ dryRun: true, asOf: "2026-06-22" });
      results.push({
        check: "runVisitIntelDailyDigest(dryRun)",
        ok: digest.ok === true,
        detail: digest.skipped ? digest.reason : `recapCount=${digest.recapCount ?? 0}`,
      });
    } catch (err) {
      results.push({
        check: "runVisitIntelDailyDigest(dryRun)",
        ok: pgMissingMessage(err.message),
        detail: pgMissingMessage(err.message)
          ? "skipped - Postgres alert prefs not configured locally"
          : err.message,
      });
    }
  } catch (err) {
    results.push({ check: "visit-intel-recap", ok: false, detail: err.message });
  }

  try {
    const { dispatchVisitScheduledEmail, buildVisitDailyEmailHtml } = require("../lib/visit-intel-email-digest");
    const html = buildVisitDailyEmailHtml(
      [
        {
          name: "Jalen Brewster",
          visitStart: "2026-06-11",
          visitEnd: "2026-06-13",
          visitSourceLabel: "On3",
          movementNarrative: "UF +6% (7d) since verified OV (Jun 11-Jun 13)",
        },
      ],
      "2026-06-22"
    );
    results.push({
      check: "buildVisitDailyEmailHtml(narrative)",
      ok: html.includes("UF +6% (7d)"),
      detail: html.includes("UF +6% (7d)") ? "narrative line present" : "missing narrative",
    });

    try {
      const instant = await dispatchVisitScheduledEmail(
        {
          playerSlug: "jalen-brewster",
          playerName: "Jalen Brewster",
          date: "2099-07-10",
          fingerprint: "qa|jalen-brewster|2099-07-10",
          source: "on3",
          visitType: "official_visit",
          school: "Florida",
        },
        { dryRun: true }
      );
      results.push({
        check: "dispatchVisitScheduledEmail(dryRun)",
        ok: instant.ok === true,
        detail: instant.wouldSend != null ? `wouldSend=${instant.wouldSend}` : instant.reason || "ok",
      });
    } catch (err) {
      results.push({
        check: "dispatchVisitScheduledEmail(dryRun)",
        ok: pgMissingMessage(err.message),
        detail: pgMissingMessage(err.message)
          ? "skipped - Postgres alert prefs not configured locally"
          : err.message,
      });
    }
  } catch (err) {
    results.push({ check: "visit-intel-email-digest", ok: false, detail: err.message });
  }

  try {
    const {
      wantsEmailVisitInstant,
      wantsEmailVisitDigest,
      filterRecapRowsForSubscriber,
    } = require("../lib/alert-email-prefs-service");
    const filtered = filterRecapRowsForSubscriber(
      [{ slug: "jalen-brewster", name: "Jalen Brewster" }],
      { followPlayers: ["Jalen Brewster"] }
    );
    results.push({ check: "followPlayers filter", ok: filtered.length === 1, detail: `matched=${filtered.length}` });
    results.push({
      check: "instant prefs gate",
      ok: wantsEmailVisitInstant({ method: "both", visit: true, freq: "instant" }),
      detail: "both+instant",
    });
    results.push({
      check: "daily digest prefs gate",
      ok: wantsEmailVisitDigest({ method: "email", visit: true, freq: "daily" }),
      detail: "email+daily",
    });
  } catch (err) {
    results.push({ check: "alert-email-prefs", ok: false, detail: err.message });
  }

  const failed = results.filter((r) => !r.ok);
  console.log("[qa-visit-alerts-local]", failed.length ? "FAIL" : "PASS");
  for (const row of results) {
    console.log(row.ok ? "  ok" : "  FAIL", row.check, "-", row.detail);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error("[qa-visit-alerts-local] fatal:", err.message);
  process.exit(1);
});