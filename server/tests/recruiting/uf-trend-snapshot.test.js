const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  upsertSnapshot,
  computeDelta7d,
  buildDelta7dBySlug,
  mergeDelta7dMaps,
  backfillBaseline,
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

  it("backfills baseline pair", () => {
    backfillBaseline("baseline-player", {
      currentPct: 62,
      priorPct: 56,
      asOf: new Date("2026-06-22T12:00:00Z"),
    });
    assert.equal(computeDelta7d("baseline-player", new Date("2026-06-22T12:00:00Z")), 6);
  });

  it("cleans test snapshots", () => {
    const doc = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
    for (const slug of ["test-player", "merge-player", "baseline-player"]) {
      delete doc.snapshots[slug];
    }
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(doc, null, 2));
    if (backup) fs.writeFileSync(SNAPSHOT_PATH, backup);
    else if (fs.existsSync(SNAPSHOT_PATH)) fs.unlinkSync(SNAPSHOT_PATH);
    assert.ok(true);
  });
});