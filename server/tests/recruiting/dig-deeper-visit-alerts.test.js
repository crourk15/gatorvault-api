const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("dig-deeper visit alerts", () => {
  it("beat official visit logs require identityConfirmed and map ov_change", async () => {
    const { visitTypeForBeatEvent, recordBeatVisitLog } = require("../../lib/recruiting-dig-deeper-ingest");
    assert.equal(visitTypeForBeatEvent("ov_change"), "official_visit");

    const rejected = await recordBeatVisitLog(
      {
        eventType: "official_visit",
        visitStart: "2099-10-01",
        identityConfirmed: false,
        detail: "qa",
      },
      { slug: "qa-unverified-ov", name: "QA Unverified", on3Id: null },
      "auto:beat-writer"
    );
    assert.equal(rejected?.created, false);
    assert.equal(rejected?.reason, "unverified_source");

    const fp = `visit|qa-verified-ov-alert|florida|official_visit|2099-10-02`;
    const created = await recordBeatVisitLog(
      {
        eventType: "official_visit",
        visitStart: "2099-10-02",
        identityConfirmed: true,
        detail: "qa verified",
        fingerprint: fp,
      },
      { slug: "qa-verified-ov-alert", name: "QA Verified OV", on3Id: null },
      "auto:beat-writer"
    );
    assert.equal(created?.created || created?.duplicate, true);
    assert.equal(created?.item?.visitType, "official_visit");
  });
});
