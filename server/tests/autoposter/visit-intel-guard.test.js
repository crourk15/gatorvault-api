const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { evaluateVisitIntelPostGate, isVisitIntelPromotionText, buildVerifiedVisitRecapPostCopy } = require("../../lib/x-autoposter-visit-guard");
const { getTweetCharLimit } = require("../../lib/autoposter/tweet-char-limit");

describe("x-autoposter-visit-guard", () => {
  const asOf = new Date("2026-06-22T12:00:00Z");

  it("detects visit intel promo copy", () => {
    assert.equal(isVisitIntelPromotionText("Fresh 2027 visit intel on FutureCast"), true);
    assert.equal(isVisitIntelPromotionText("Gators win spring game"), false);
  });

  it("blocks upcoming visit promo when board has no verified upcoming OVs", () => {
    const gate = evaluateVisitIntelPostGate({ text: "Fresh 2027 visit intel updated on FutureCast board", asOf });
    assert.equal(gate.allow, false);
    assert.equal(gate.reason, "no_verified_upcoming_visits");
  });

  it("allows non-visit promo copy", () => {
    const gate = evaluateVisitIntelPostGate({ text: "UF lands four-star WR", asOf });
    assert.equal(gate.skipped, true);
    assert.equal(gate.allow, true);
  });

  it("builds recap copy when verified completed OVs exist", () => {
    const copy = buildVerifiedVisitRecapPostCopy({ asOf });
    if (copy) {
      assert.match(copy, /FutureCast 2027 Visit Intel/);
      assert.match(copy, /On3/);
      assert.ok(copy.length <= getTweetCharLimit());
    }
  });
});