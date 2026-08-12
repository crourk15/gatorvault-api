require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const HAS_DB = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL);

describe("futurecast-intel-alerts", () => {
  const {
    buildFutureCastIntelAlerts,
    buildFutureCastIntelAlertsSync,
  } = require("../../lib/futurecast-intel-alerts");

  it("sync Board Intel stays on GatorVault board (no DB)", () => {
    const alerts = buildFutureCastIntelAlertsSync({
      asOf: new Date("2026-06-22T12:00:00Z"),
    });
    assert.ok(alerts.length >= 1, "expected board intel without DB");
    assert.ok(
      !alerts.some((a) => /ryan-peterson|Ryan Peterson/i.test(JSON.stringify(a))),
      "Ryan Peterson must not appear in Board Intel"
    );
    assert.ok(
      alerts.every((a) => a.playerSlug),
      "intel alerts should be named board targets"
    );
  });

  it("includes resolved UF % on flip-watch alert messages", { skip: !HAS_DB }, async () => {
    const alerts = await buildFutureCastIntelAlerts({
      asOf: new Date("2026-06-22T12:00:00Z"),
    });
    const flipAlerts = alerts.filter((a) => a.type === "flip_watch");
    assert.ok(flipAlerts.length >= 1, "expected at least one flip_watch alert");

    const easton = flipAlerts.find((a) => a.playerSlug === "easton-royal");
    assert.ok(easton, "expected easton-royal flip alert (committed elsewhere + completed UF OV)");
    assert.match(easton.message, /UF \d+%/, "easton flip alert should include UF percent");
    assert.doesNotMatch(easton.message, /UF 0%/, "easton flip alert should not show UF 0%");
    assert.ok(
      !flipAlerts.some((a) => a.playerSlug === "jalen-brewster"),
      "uncommitted targets should not appear in flip watch"
    );
  });

  it("matches high-priority flip-watch UF for shared slugs", { skip: !HAS_DB }, async () => {
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
