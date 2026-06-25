const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  formatVisitSourceLabel,
  getVisitIntelBoardSnapshot,
  buildVerifiedVisitRecapRows,
  isUpcomingVisitIntel,
  applyVerifiedVisitFields,
} = require("../lib/visit-intel-utils");

describe("visit-intel-utils", () => {
  const asOf = new Date("2026-06-22T12:00:00Z");

  it("labels On3 and beat sources", () => {
    assert.equal(formatVisitSourceLabel("on3"), "On3");
    assert.equal(formatVisitSourceLabel("beat:smith"), "Beat verified");
  });

  it("returns empty board snapshot for no logs", () => {
    assert.deepEqual(getVisitIntelBoardSnapshot([], asOf), { upcomingCount: 0, recapCount: 0 });
  });

  it("counts upcoming verified OVs from logs", () => {
    const logs = [{ playerSlug: "test-player", playerName: "Test Player", source: "on3", visitType: "official_visit", school: "Florida", date: "2026-07-10" }];
    const snap = getVisitIntelBoardSnapshot(logs, asOf);
    assert.equal(snap.upcomingCount, 1);
    assert.equal(snap.recapCount, 0);
  });

  it("builds recap rows for completed verified OVs only", () => {
    const logs = [
      { playerSlug: "done-player", playerName: "Done Player", source: "on3", visitType: "official_visit", school: "Florida", date: "2026-06-11" },
      { playerSlug: "future-player", playerName: "Future Player", source: "on3", visitType: "official_visit", school: "Florida", date: "2026-07-10" },
    ];
    const recap = buildVerifiedVisitRecapRows([], logs, asOf, { limit: 4 });
    assert.equal(recap.length, 1);
    assert.equal(recap[0].slug, "done-player");
    assert.equal(recap[0].visitSourceLabel, "On3");
  });

  it("clears unverified player visit fields", () => {
    const player = { slug: "x", name: "X", visitStart: "2026-07-10", visitEnd: "2026-07-12", ufOvStatus: "scheduled", visitVerified: true };
    const out = applyVerifiedVisitFields(player, [], asOf);
    assert.equal(out.visitVerified, false);
    assert.equal(out.visitStart, null);
    assert.equal(out.visitSourceLabel, null);
  });

  it("detects upcoming visit intel windows", () => {
    const player = { slug: "x", name: "X", visitStart: "2026-07-10", visitEnd: "2026-07-12", visitVerified: true, ufOvStatus: "scheduled" };
    assert.equal(isUpcomingVisitIntel(player, asOf), true);
  });
});