/**
 * Why we chase must prefer ufRpmPct over poisoned ufProbability.
 * Run: npx tsx --test server/test/chase-why-prefer-rpm.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildChaseWhyBrief,
  floridaChasePct,
} = require("../../client/components/futurecast/lab/chase-priority.ts");

describe("chase why prefer rpm", () => {
  it("Antonio-shaped: UF 41 RPM beats ufProbability 11 — no sits at 11%", () => {
    const player = {
      name: "Antonio Thomas Jr",
      position: "EDGE",
      school: "Carrollwood Day (Tampa, FL)",
      ufRpmPct: 41,
      ufProbability: 11,
      fitScore: 79,
      hotBadges: { inState: true },
      hotLanes: { positionalNeed: 80 },
      competingSchools: [
        { name: "Miami", pct: 13.4 },
        { name: "Auburn", pct: 11.5 },
      ],
    };
    assert.equal(floridaChasePct(player), 41);
    const why = buildChaseWhyBrief(player);
    assert.doesNotMatch(why, /sits at 11%/i);
    assert.doesNotMatch(why, /live fight with Miami while Florida still sits/i);
    assert.match(why, /Florida leads On3 vs Miami/i);
  });
});
