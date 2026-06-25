const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("visit-intel-reconcile", () => {
  it("reconcileVisitIntelInStore returns report shape in dryRun", async () => {
    const { reconcileVisitIntelInStore } = require("../lib/expire-stale-visit-intel");
    const result = await reconcileVisitIntelInStore({
      dryRun: true,
      asOf: "2026-06-22T12:00:00Z",
    });
    assert.equal(result.dryRun, true);
    assert.equal(typeof result.expired, "number");
    assert.equal(typeof result.scanned, "number");
    assert.ok(result.storageMode === "supabase" || result.storageMode === "local");
    assert.ok(result.boardSnapshotBefore);
    assert.ok(result.boardSnapshotAfter);
    assert.equal(result.futurecastCacheCleared, false);
  });
});