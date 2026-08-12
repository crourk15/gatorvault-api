const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  visitFingerprint,
  processPendingVisitAlerts,
} = require("../../lib/pending-visit-alerts");

describe("pending-visit-alerts", () => {
  it("builds stable OV fingerprints", () => {
    assert.equal(
      visitFingerprint({
        playerSlug: "brysen-wright",
        visitType: "official_visit",
        date: "2026-08-22",
      }),
      "visit|brysen-wright|florida|official_visit|2026-08-22"
    );
  });

  it("dryRun processes pending file without sending", async () => {
    const out = await processPendingVisitAlerts({ dryRun: true });
    assert.equal(out.ok, true);
    assert.ok(out.processed >= 1);
    assert.ok(out.results.some((r) => r.slug === "brysen-wright" || r.dryRun));
  });
});
