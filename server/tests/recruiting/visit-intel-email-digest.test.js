const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizePrefs,
  wantsEmailVisitDigest,
  filterRecapRowsForSubscriber,
} = require("../../lib/alert-email-prefs-service");
const { buildVisitRecapEmailHtml } = require("../../lib/visit-intel-email-digest");

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
});