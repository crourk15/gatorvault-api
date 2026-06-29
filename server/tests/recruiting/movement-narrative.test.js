const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildMovementNarrative,
  latestCompletedVisitForSlug,
  enrichVisitRecapRows,
  enrichFlipWatchRows,
  buildNarrativeFeed,
} = require("../../lib/movement-narrative");

describe("movement-narrative", () => {
  const asOf = new Date("2026-06-22T12:00:00Z");
  const visitLogs = [
    {
      playerSlug: "jd-jackson",
      playerName: "JD Jackson",
      source: "on3",
      visitType: "official_visit",
      school: "Florida",
      date: "2026-06-01",
    },
    {
      playerSlug: "future-player",
      playerName: "Future Player",
      source: "on3",
      visitType: "official_visit",
      school: "Florida",
      date: "2026-07-10",
    },
  ];

  it("builds narrative with visit window label", () => {
    const text = buildMovementNarrative({
      delta7d: 6,
      visitStart: "2026-06-01",
      visitEnd: "2026-06-01",
    });
    assert.match(text, /UF \+6% \(7d\) since verified OV \(Jun 1\)/);
  });

  it("returns null for tiny deltas", () => {
    assert.equal(buildMovementNarrative({ delta7d: 0.4, visitStart: "2026-06-01" }), null);
  });

  it("finds latest completed visit for slug", () => {
    const visit = latestCompletedVisitForSlug("jd-jackson", visitLogs, asOf);
    assert.equal(visit.visitStart, "2026-06-01");
    assert.equal(latestCompletedVisitForSlug("future-player", visitLogs, asOf), null);
  });

  it("enriches recap and flip rows with narratives", () => {
    const deltaBySlug = new Map([["jd-jackson", 6]]);
    const recap = enrichVisitRecapRows(
      [{ slug: "jd-jackson", name: "JD Jackson", visitStart: "2026-06-01", visitEnd: "2026-06-01" }],
      visitLogs,
      deltaBySlug,
      asOf
    );
    assert.ok(recap[0].movementNarrative?.includes("UF +6%"));

    const flip = enrichFlipWatchRows(
      [{ slug: "jd-jackson", name: "JD Jackson", committedShort: "UGA", visitStart: null, visitEnd: null }],
      visitLogs,
      deltaBySlug,
      asOf
    );
    assert.ok(flip[0].movementNarrative?.includes("since verified OV"));
  });

  it("builds ranked narrative feed", () => {
    const players = [
      { slug: "jd-jackson", name: "JD Jackson", delta7d: 6 },
      { slug: "other", name: "Other", delta7d: 2 },
    ];
    const deltaBySlug = new Map([
      ["jd-jackson", 6],
      ["other", 2],
    ]);
    const feed = buildNarrativeFeed(players, visitLogs, deltaBySlug, { limit: 2, asOf });
    assert.equal(feed.length, 1);
    assert.equal(feed[0].slug, "jd-jackson");
  });

  it("includes trend-only narratives when allowTrendOnly is set", () => {
    const players = [{ slug: "trend-only", name: "Trend Only", delta7d: -5 }];
    const deltaBySlug = new Map([["trend-only", -5]]);
    const feed = buildNarrativeFeed(players, visitLogs, deltaBySlug, {
      limit: 3,
      asOf,
      allowTrendOnly: true,
    });
    assert.equal(feed.length, 1);
    assert.equal(feed[0].trendOnly, true);
    assert.match(feed[0].movementNarrative, /UF -5% \(7d\)/);
  });
});