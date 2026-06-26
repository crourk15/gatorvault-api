require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("futurecast-intel-alerts", () => {
  const { buildFutureCastIntelAlerts } = require("../../lib/futurecast-intel-alerts");

  it("includes resolved UF % on flip-watch alert messages", async () => {
    const alerts = await buildFutureCastIntelAlerts({
      asOf: new Date("2026-06-22T12:00:00Z"),
    });
    const flipAlerts = alerts.filter((a) => a.type === "flip_watch");
    assert.ok(flipAlerts.length >= 1, "expected at least one flip_watch alert");

    const easton = flipAlerts.find((a) => a.playerSlug === "easton-royal");
    const brewster = flipAlerts.find((a) => a.playerSlug === "jalen-brewster");
    assert.ok(easton, "expected easton-royal flip alert");
    assert.ok(brewster, "expected jalen-brewster flip alert");
    assert.match(easton.message, /UF \d+%/, "easton flip alert should include UF percent");
    assert.match(brewster.message, /UF \d+%/, "brewster flip alert should include UF percent");
    assert.doesNotMatch(easton.message, /UF 0%/, "easton flip alert should not show UF 0%");
    assert.doesNotMatch(brewster.message, /UF 0%/, "brewster flip alert should not show UF 0%");
  });

  it("matches high-priority flip-watch UF for shared slugs", async () => {
    const alerts = await buildFutureCastIntelAlerts({
      asOf: new Date("2026-06-22T12:00:00Z"),
    });
    const { loadFuturecastPredictionBySlug } = require("../../lib/load-futurecast-prediction-by-slug");
    const { buildResolveSlugUfMeta, loadUfPctPredictorsBySlug } = require("../../lib/visit-intel-flip-context");
    const fs = require("fs");
    const path = require("path");

    const boardPath = path.join(__dirname, "../../data/recruiting/2027-target-board.json");
    const seedEntries = JSON.parse(fs.readFileSync(boardPath, "utf8")).targets || [];
    const recruitingBySlug = new Map();
    const targetSeedBySlug = new Map(seedEntries.map((t) => [t.slug, t]));
    const predictionBySlug = await loadFuturecastPredictionBySlug(2027);
    const resolveSlugUfMeta = buildResolveSlugUfMeta({
      recruitingBySlug,
      targetSeedBySlug,
      predictorsBySlug: loadUfPctPredictorsBySlug(),
      predictionBySlug,
      predictorNames: { system: "FutureCast Model" },
    });

    for (const slug of ["easton-royal", "jalen-brewster"]) {
      const resolved = resolveSlugUfMeta(slug);
      const alert = alerts.find((a) => a.playerSlug === slug && a.type === "flip_watch");
      if (!alert || !resolved?.value) continue;
      assert.match(
        alert.message,
        new RegExp(`UF ${resolved.value}%`),
        `${slug} alert UF should match canonical resolve chain`
      );
    }
  });
});