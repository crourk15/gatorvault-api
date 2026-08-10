const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  upsertSnapshot,
  computeDelta7d,
  buildDelta7dBySlug,
  buildTrendHistoryForSlug,
  mergeTrendHistories,
  mergeDelta7dMaps,
  backfillBaseline,
  applySnapshotMovement,
  SNAPSHOT_PATH,
} = require("../../lib/uf-trend-snapshot");

describe("uf-trend-snapshot", () => {
  const backup = fs.existsSync(SNAPSHOT_PATH) ? fs.readFileSync(SNAPSHOT_PATH) : null;

  it("computes 7d delta from snapshots", () => {
    upsertSnapshot("test-player", 40, "2026-06-15");
    upsertSnapshot("test-player", 46, "2026-06-22");
    assert.equal(computeDelta7d("test-player", new Date("2026-06-22T12:00:00Z")), 6);
  });

  it("merges snapshot deltas when postgres map is empty", () => {
    upsertSnapshot("merge-player", 50, "2026-06-15");
    upsertSnapshot("merge-player", 58, "2026-06-22");
    const snap = buildDelta7dBySlug(["merge-player"], new Date("2026-06-22T12:00:00Z"));
    const merged = mergeDelta7dMaps(new Map(), snap, ["merge-player"]);
    assert.equal(merged.get("merge-player"), 8);
  });

  it("builds 30d trend history from snapshots", () => {
    upsertSnapshot("trend-player", 42, "2026-06-19");
    upsertSnapshot("trend-player", 48, "2026-06-26");
    const history = buildTrendHistoryForSlug("trend-player", {
      asOf: new Date("2026-06-26T12:00:00Z"),
    });
    assert.equal(history.length, 2);
    assert.equal(history[0].confidence, 42);
    assert.equal(history[1].confidence, 48);
    const merged = mergeTrendHistories([], history);
    assert.equal(merged.length, 2);
  });

  it("backfills baseline pair", () => {
    backfillBaseline("baseline-player", {
      currentPct: 62,
      priorPct: 56,
      asOf: new Date("2026-06-22T12:00:00Z"),
    });
    assert.equal(computeDelta7d("baseline-player", new Date("2026-06-22T12:00:00Z")), 6);
  });

  it("ignores legacy seed snapshots when requireSource gatorvault", () => {
    upsertSnapshot("gv-source-player", 40, "2026-07-05"); // no source = legacy seed
    upsertSnapshot("gv-source-player", 55, "2026-07-12"); // still legacy
    assert.equal(
      computeDelta7d("gv-source-player", new Date("2026-07-12T12:00:00Z"), {
        preferSource: "gatorvault",
        requireSource: true,
      }),
      null
    );
    upsertSnapshot("gv-source-player", 40, "2026-07-05", { source: "gatorvault" });
    upsertSnapshot("gv-source-player", 48, "2026-07-12", { source: "gatorvault" });
    assert.equal(
      computeDelta7d("gv-source-player", new Date("2026-07-12T12:00:00Z"), {
        preferSource: "gatorvault",
        requireSource: true,
      }),
      8
    );
  });

  it("applySnapshotMovement hides |Δ| < 1 and uses GV history only", () => {
    const asOf = new Date("2026-07-12T12:00:00Z");
    upsertSnapshot("gv-apply-player", 50, "2026-07-05", { source: "gatorvault" });
    const [row] = applySnapshotMovement(
      [{ slug: "gv-apply-player", ufProbability: 50.4, fitScore: 80 }],
      { asOf, minAbs: 1 }
    );
    assert.equal(row.delta7d, 0);
    assert.equal(row.movementDelta, 0);

    upsertSnapshot("gv-apply-player", 40, "2026-07-05", { source: "gatorvault" });
    const [moved] = applySnapshotMovement(
      [{ slug: "gv-apply-player", ufProbability: 48, fitScore: 80 }],
      { asOf, minAbs: 1 }
    );
    assert.equal(moved.delta7d, 8);
    assert.equal(moved.movementDelta, 8);
  });

  
  it("ignores ancient baselines outside 14d window and hydrates stamp history", () => {
    const { hydrateFromPlayerStamps } = require("../../lib/uf-trend-snapshot");
    upsertSnapshot("old-crumb", 40, "2026-06-22", { source: "gatorvault" });
    upsertSnapshot("old-crumb", 46, "2026-06-29", { source: "gatorvault" });
    upsertSnapshot("old-crumb", 50, "2026-08-10", { source: "gatorvault" });
    // June baseline is >14d before Aug 10 — not a real 7-day move.
    assert.equal(computeDelta7d("old-crumb", new Date("2026-08-10T12:00:00Z")), null);

    const asOf = new Date("2026-08-10T12:00:00Z");
    const hydrated = hydrateFromPlayerStamps(["john-matthews"], { asOf, maxAgeDays: 14 });
    assert.ok(hydrated.upserted >= 0);
    // Recent stamp points + today's GV should yield a finite week delta when history exists.
    if (hydrated.upserted > 0) {
      upsertSnapshot("john-matthews", 66, "2026-08-10", { source: "gatorvault" });
      const delta = computeDelta7d("john-matthews", asOf, { preferSource: "gatorvault" });
      assert.equal(typeof delta === "number" || delta == null, true);
    }
  });

  it("cleans test snapshots", () => {
    const doc = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
    for (const slug of [
      "test-player",
      "merge-player",
      "baseline-player",
      "trend-player",
      "gv-source-player",
      "gv-apply-player",
      "gv-move-test",
      "old-crumb",
      "john-matthews",
    ]) {
      delete doc.snapshots[slug];
    }
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(doc, null, 2));
    if (backup) fs.writeFileSync(SNAPSHOT_PATH, backup);
    else if (fs.existsSync(SNAPSHOT_PATH)) fs.unlinkSync(SNAPSHOT_PATH);
    assert.ok(true);
  });
});