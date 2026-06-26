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
});