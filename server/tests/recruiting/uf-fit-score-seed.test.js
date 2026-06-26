const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { buildUfFitSeedProfile } = require("../../lib/uf-fit-score-seed.js");

describe("uf-fit-score-seed", () => {
  it("builds non-zero UF fit from model prediction", () => {
    const profile = buildUfFitSeedProfile({
      playerId: "00000000-0000-4000-8000-000000000001",
      slug: "easton-royal",
      classYear: 2027,
      state: "LA",
      targetSeed: { stars: 4, rating: 90, headliner: true, ufProbability: 0.48 },
      modelPred: { confidence: 75, playerSlug: "easton-royal" },
    });
    assert.ok(profile.uf_fit_score >= 50, "expected meaningful uf_fit_score");
    assert.equal(profile.uf_status, "PRIORITY");
    assert.equal(profile.uf_commit_probability, 75);
  });

  it("uses store UF % when model missing", () => {
    const profile = buildUfFitSeedProfile({
      playerId: "00000000-0000-4000-8000-000000000002",
      slug: "jalen-brewster",
      classYear: 2027,
      state: "TX",
      recruiting: { stars: 4, rating: 91, ufProbability: 38 },
    });
    assert.ok(profile.uf_fit_score >= 40);
    assert.equal(profile.uf_commit_probability, 38);
  });
});
