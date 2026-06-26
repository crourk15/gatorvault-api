const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  loadRivalsUfPctBySlug,
  loadUfPctPredictorsBySlug,
  pickExternalPmScore,
  resolveUfProbability,
} = require("../../lib/uf-probability-utils");
const { resolveUfPctFromProfile } = require("../../lib/on3-rpm-allowlist");

describe("on3-rpm allowlist gap-fill", () => {
  it("merges On3 RPM when Rivals PM is missing for allowlist slug", () => {
    const map = loadRivalsUfPctBySlug();
    assert.equal(map.get("kamauri-whitfield"), 60);
    assert.ok(map.get("easton-royal") > 0);
    assert.ok(map.get("raheem-floyd") > 0);
    assert.ok(map.get("jalen-brewster") > 0);
  });

  it("loadUfPctPredictorsBySlug labels On3 RPM for gap-fill slugs", () => {
    const predictors = loadUfPctPredictorsBySlug();
    assert.deepEqual(predictors.get("kamauri-whitfield"), [{ name: "Rivals PM", score: 60 }]);
    const easton = predictors.get("easton-royal");
    assert.equal(easton?.[0]?.name, "On3 RPM");
    assert.ok(easton?.[0]?.score > 0);
  });

  it("resolveUfProbability prefers store then On3 RPM", () => {
    const resolved = resolveUfProbability({
      modelPct: 0,
      storePct: 0,
      predictors: [{ name: "On3 RPM", score: 48 }],
      stars: 4,
      headliner: true,
    });
    assert.equal(resolved.value, 48);
    assert.equal(resolved.label, "On3 RPM");
  });

  it("pickExternalPmScore prefers Rivals over On3", () => {
    const out = pickExternalPmScore([
      { name: "On3 RPM", score: 40 },
      { name: "Rivals PM", score: 55 },
    ]);
    assert.equal(out.value, 55);
    assert.equal(out.label, "Rivals PM");
  });

  it("resolveUfPctFromProfile reads Florida prediction from topTeams", () => {
    const pct = resolveUfPctFromProfile({
      topTeams: [{ year: 2027, prediction: 42, team: { name: "Florida Gators" } }],
    });
    assert.equal(pct, 42);
  });

  it("syncAllowlistOn3Rpm dryRun skips rivals-covered slugs", async () => {
    const { syncAllowlistOn3Rpm } = require("../../lib/on3-rpm-allowlist");
    const out = await syncAllowlistOn3Rpm({ dryRun: true, fetch: false });
    assert.equal(out.ok, true);
    const kamauri = out.results.find((r) => r.slug === "kamauri-whitfield");
    assert.equal(kamauri?.skipped, true);
    assert.equal(kamauri?.reason, "rivals_pm_present");
  });
});

describe("enrichRecapRowsWithMovementNarratives", () => {
  it("attaches movementNarrative when snapshot delta exists", () => {
    const { enrichRecapRowsWithMovementNarratives } = require("../../lib/visit-intel-recap");
    const rows = enrichRecapRowsWithMovementNarratives(
      [
        {
          slug: "jalen-brewster",
          name: "Jalen Brewster",
          visitStart: "2026-06-11",
          visitEnd: "2026-06-13",
        },
      ],
      new Date("2026-06-26T12:00:00Z")
    );
    assert.equal(rows.length, 1);
    assert.match(rows[0].movementNarrative || "", /UF \+6% \(7d\)/);
  });
});
