/**
 * Antonio Miami On3 lead — slim floors heal without players.json warm.
 * Run: npx tsx --test server/test/antonio-miami-lead-floors.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { healHighPriorityRpmPoisonRow } = require("../api/futurecast/response-cache.ts");
const { resolveOn3LeadStamp, withOn3LeadStamp } = require("../lib/on3-lead-stamp");

describe("antonio miami lead floors", () => {
  it("heals live poison row to UF via slim floors (no players.json warm)", () => {
    const healed = withOn3LeadStamp(
      healHighPriorityRpmPoisonRow({
        slug: "antonio-thomas-jr",
        name: "Antonio Thomas Jr",
        stars: 4,
        ufRpmPct: null,
        ufProbability: 11,
        competingSchools: [
          { name: "Miami", pct: 13.4 },
          { name: "Auburn", pct: 11.5 },
        ],
      })
    );
    assert.equal(healed.on3Lead || resolveOn3LeadStamp(healed), "UF");
    assert.ok(Number(healed.ufRpmPct) >= 35, healed.ufRpmPct);
    assert.ok(Number(healed.ufProbability) >= 35, healed.ufProbability);
  });
});
