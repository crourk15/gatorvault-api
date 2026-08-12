const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizePrefs,
  wantsEmailVisitDigest,
  wantsEmailVisitInstant,
  filterRecapRowsForSubscriber,
} = require("../../lib/alert-email-prefs-service");
const {
  buildVisitRecapEmailHtml,
  buildVisitDailyEmailHtml,
  buildVisitScheduledEmailHtml,
  buildVisitCancelledEmailHtml,
  dispatchVisitScheduledEmail,
  sendVisitIntelDailyDigest,
} = require("../../lib/visit-intel-email-digest");
const { runVisitIntelDailyDigest } = require("../../lib/visit-intel-recap");

describe("alert-email-prefs-service", () => {
  it("detects weekly visit digest eligibility", () => {
    assert.equal(
      wantsEmailVisitDigest({ method: "email", visit: true, freq: "weekly" }),
      true
    );
    assert.equal(
      wantsEmailVisitDigest({ method: "push", visit: true, freq: "weekly" }),
      false
    );
    assert.equal(
      wantsEmailVisitDigest({ method: "both", visit: true, freq: "instant" }),
      false
    );
  });

  it("detects instant visit email eligibility", () => {
    assert.equal(
      wantsEmailVisitInstant({ method: "email", visit: true, freq: "instant" }),
      true
    );
    assert.equal(
      wantsEmailVisitInstant({ method: "both", visit: true, freq: "instant" }),
      true
    );
    assert.equal(
      wantsEmailVisitInstant({ method: "email", visit: true, freq: "weekly" }),
      false
    );
    assert.equal(
      wantsEmailVisitInstant({ method: "push", visit: true, freq: "instant" }),
      false
    );
  });

  it("detects daily visit digest eligibility", () => {
    assert.equal(
      wantsEmailVisitDigest({ method: "email", visit: true, freq: "daily" }),
      true
    );
    assert.equal(
      wantsEmailVisitDigest({ method: "email", visit: true, freq: "instant" }),
      false
    );
  });

  it("filters recap rows for tracked players", () => {
    const rows = [
      { slug: "easton-royal", name: "Easton Royal" },
      { slug: "jalen-brewster", name: "Jalen Brewster" },
    ];
    const filtered = filterRecapRowsForSubscriber(rows, {
      followPlayers: ["Easton Royal"],
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].slug, "easton-royal");
  });

  it("normalizes prefs", () => {
    const prefs = normalizePrefs({
      method: "both",
      freq: "weekly",
      visit: true,
      followPlayers: [" A ", "A"],
    });
    assert.equal(prefs.method, "both");
    assert.deepEqual(prefs.followPlayers, ["A"]);
  });
});

describe("visit-intel-email-digest", () => {
  it("builds recap html with verified rows", () => {
    const html = buildVisitRecapEmailHtml(
      [{ name: "Easton Royal", visitStart: "2026-06-01", visitEnd: "2026-06-03", visitSourceLabel: "On3" }],
      "2026-W25"
    );
    assert.match(html, /Easton Royal/);
    assert.match(html, /futurecast#visits/);
  });

  it("includes movement narrative lines in digest html", () => {
    const row = {
      name: "Jalen Brewster",
      visitStart: "2026-06-11",
      visitEnd: "2026-06-13",
      visitSourceLabel: "On3",
      movementNarrative: "UF +6% (7d) since verified OV (Jun 11–Jun 13)",
    };
    const daily = buildVisitDailyEmailHtml([row], "2026-06-22");
    const weekly = buildVisitRecapEmailHtml([row], "2026-W25");
    assert.match(daily, /UF \+6% \(7d\)/);
    assert.match(weekly, /UF \+6% \(7d\)/);
  });

  it("builds scheduled and cancelled instant html", () => {
    const scheduled = buildVisitScheduledEmailHtml({
      playerSlug: "easton-royal",
      playerName: "Easton Royal",
      date: "2026-07-10",
      source: "on3",
      visitType: "official_visit",
      school: "Florida",
    });
    assert.match(scheduled, /Easton Royal/);
    assert.match(scheduled, /verified UF official visit/);
    assert.match(scheduled, /\/vault\/recruiting\/player\/easton-royal\//);
    assert.match(scheduled, /Open player profile/);

    const cancelled = buildVisitCancelledEmailHtml({
      playerSlug: "easton-royal",
      playerName: "Easton Royal",
      nextVisitSchool: "Texas",
    });
    assert.match(cancelled, /cancelled his official visit to Florida/);
    assert.match(cancelled, /Texas/);
    assert.match(cancelled, /\/vault\/recruiting\/player\/easton-royal\//);
  });

  it("dispatchVisitScheduledEmail dryRun does not throw", async () => {
    const out = await dispatchVisitScheduledEmail(
      {
        playerSlug: "easton-royal",
        playerName: "Easton Royal",
        date: "2099-07-10",
        fingerprint: "visit|easton|test|2099-07-10",
        source: "on3",
        visitType: "official_visit",
        school: "Florida",
      },
      { dryRun: true }
    );
    assert.equal(out.ok, true);
    assert.equal(out.dryRun, true);
  });

  it("builds daily digest html", () => {
    const html = buildVisitDailyEmailHtml(
      [{ name: "Easton Royal", visitStart: "2026-06-01", visitEnd: "2026-06-03", visitSourceLabel: "On3" }],
      "2026-06-22"
    );
    assert.match(html, /2026-06-22/);
    assert.match(html, /Easton Royal/);
  });

  it("sendVisitIntelDailyDigest dryRun does not throw", async () => {
    const out = await sendVisitIntelDailyDigest({
      recapRows: [{ name: "Easton Royal", visitStart: "2026-06-01", visitEnd: "2026-06-03" }],
      dayKey: "2099-01-01",
      dryRun: true,
    });
    assert.equal(out.ok, true);
    assert.equal(out.dryRun, true);
  });

  it("runVisitIntelDailyDigest dryRun does not throw", async () => {
    const out = await runVisitIntelDailyDigest({ dryRun: true, asOf: "2026-06-22" });
    assert.equal(out.ok, true);
  });
});