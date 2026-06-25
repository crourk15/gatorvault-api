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

  it("prioritizes target-board slugs in recap when pool is larger than limit", () => {
    const logs = [
      { playerSlug: "jd-jackson", playerName: "JD Jackson", source: "on3", visitType: "official_visit", school: "Florida", date: "2026-06-19" },
      { playerSlug: "jalen-brewster", playerName: "Brewster", source: "on3", visitType: "official_visit", school: "Florida", date: "2026-06-11" },
    ];
    const recap = buildVerifiedVisitRecapRows([], logs, asOf, {
      limit: 1,
      prioritySlugs: ["jalen-brewster"],
    });
    assert.equal(recap.length, 1);
    assert.equal(recap[0].slug, "jalen-brewster");
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

describe("uf-probability-utils", () => {
  const { resolveUfProbability } = require("../lib/uf-probability-utils");

  it("prefers model over store and rivals", () => {
    assert.equal(resolveUfProbability({ modelPct: 62, storePct: 38 }).value, 62);
    assert.equal(resolveUfProbability({ modelPct: 0, storePct: 38 }).value, 38);
    assert.equal(
      resolveUfProbability({ predictors: [{ name: "Rivals PM", score: 48 }] }).value,
      48
    );
  });

  it("labels low-confidence estimates for 3-star targets", () => {
    const resolved = resolveUfProbability({ stars: 3 });
    assert.equal(resolved.source, "estimate");
    assert.equal(resolved.label, "Est.");
    assert.equal(resolved.value, 15);
  });

  it("loads rivals UF pct map without throwing", () => {
    const { loadRivalsUfPctBySlug } = require("../lib/uf-probability-utils");
    const map = loadRivalsUfPctBySlug();
    assert.ok(map instanceof Map);
  });
});

describe("flip-watch-utils", () => {
  const { buildFlipWatchRows, prioritizeVisitRecapForTargets } = require("../lib/flip-watch-utils");

  it("surfaces committed-elsewhere players with verified UF OV recap", () => {
    const recap = [
      {
        slug: "jalen-brewster",
        name: "Brewster",
        visitStart: "2026-06-11",
        visitEnd: "2026-06-13",
        visitSourceLabel: "On3",
      },
    ];
    const players = [
      { slug: "jalen-brewster", name: "Brewster", committedTo: "Texas Tech", ufProbability: 38 },
      { slug: "kamauri-whitfield", name: "Whitfield", committedTo: "Florida", ufProbability: 62 },
    ];
    const flip = buildFlipWatchRows(players, recap, {
      visitLogs: [
        {
          playerSlug: "jalen-brewster",
          playerName: "Brewster",
          source: "on3",
          visitType: "official_visit",
          school: "Florida",
          date: "2026-06-11",
        },
      ],
      asOf: new Date("2026-06-22T12:00:00Z"),
    });
    assert.equal(flip.length, 1);
    assert.equal(flip[0].committedShort, "Texas");
  });

  it("includes flip targets when commit lives on recruiting row only", () => {
    const recap = [
      {
        slug: "easton-royal",
        name: "Easton Royal",
        visitStart: "2026-06-11",
        visitEnd: "2026-06-13",
        visitSourceLabel: "On3",
      },
    ];
    const players = [
      { slug: "easton-royal", name: "Easton Royal", committedTo: "Texas", ufProbability: 48 },
    ];
    const flip = buildFlipWatchRows(players, recap);
    assert.equal(flip.length, 1);
    assert.equal(flip[0].committedShort, "Texas");
  });

  it("prioritizes target-board slugs in recap ordering", () => {
    const sorted = prioritizeVisitRecapForTargets(
      [
        { slug: "other", visitStart: "2026-06-20" },
        { slug: "target-a", visitStart: "2026-06-11" },
      ],
      ["target-a"]
    );
    assert.equal(sorted[0].slug, "target-a");
  });
});