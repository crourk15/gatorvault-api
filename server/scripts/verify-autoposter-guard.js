const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function check(label, fn) {
  try {
    fn();
    console.log("  OK", label);
    return true;
  } catch (err) {
    console.error("  FAIL", label, "-", err.message);
    return false;
  }
}

function clearVisitIntelCache() {
  for (const key of Object.keys(require.cache)) {
    if (
      /recruiting-visit-log-store|x-autoposter-visit-guard|visit-intel-utils|x-autoposter-policy/.test(
        key
      )
    ) {
      delete require.cache[key];
    }
  }
}

function withVisitLogs(items, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gv-autoposter-guard-"));
  const prev = process.env.RECRUITING_TEST_DATA_DIR;
  process.env.RECRUITING_TEST_DATA_DIR = tmp;
  fs.writeFileSync(
    path.join(tmp, "visit_logs.json"),
    JSON.stringify({ version: 1, updatedAt: null, items }, null, 2)
  );
  clearVisitIntelCache();
  const visitGuard = require("../lib/x-autoposter-visit-guard");
  try {
    return fn(visitGuard);
  } finally {
    if (prev === undefined) delete process.env.RECRUITING_TEST_DATA_DIR;
    else process.env.RECRUITING_TEST_DATA_DIR = prev;
    clearVisitIntelCache();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function runVerifyAutoposterGuard() {
  let failed = 0;

  if (
    !check("non-visit promo passes gate", () => {
      const visitGuard = require("../lib/x-autoposter-visit-guard");
      const result = visitGuard.evaluateVisitIntelPostGate({
        text: "Great win today #GoGators",
      });
      assert.equal(result.allow, true);
      assert.equal(result.skipped, true);
    })
  ) {
    failed++;
  }

  if (
    !check("blocks upcoming visit promo when board has zero upcoming OVs", () => {
      withVisitLogs([], (visitGuard) => {
        const result = visitGuard.evaluateVisitIntelPostGate({
          text: "Fresh 2027 visit intel updated on FutureCast — upcoming OV this weekend",
        });
        assert.equal(result.allow, false);
        assert.equal(result.reason, "no_verified_upcoming_visits");
        assert.equal(result.upcomingCount, 0);
      });
    })
  ) {
    failed++;
  }

  if (
    !check("allows recap promo when verified completed OVs exist", () => {
      withVisitLogs(
        [
          {
            playerSlug: "test-player",
            playerName: "Test Player",
            school: "Florida",
            visitType: "official_visit",
            date: "Saturday, June 1, 2026",
            source: "on3",
            fingerprint: "test-recap-ov",
          },
        ],
        (visitGuard) => {
          const result = visitGuard.evaluateVisitIntelPostGate({
            text: "FutureCast 2027 visit intel — On3 verified summer OVs confirmed",
            asOf: new Date("2026-07-01T12:00:00Z"),
          });
          assert.equal(result.allow, true);
          assert.ok(result.recapCount > 0);
        }
      );
    })
  ) {
    failed++;
  }

  if (
    !check("x-autoposter-policy rejects visit promo blocked by guard", () => {
      withVisitLogs([], () => {
        clearVisitIntelCache();
        const policy = require("../lib/x-autoposter-policy");
        const result = policy.validatePostContent({
          text: "Fresh 2027 visit intel updated on FutureCast board — upcoming OV this weekend",
          category: "engagement",
          action: "post",
          sources: [{ label: "GatorVault", url: "https://gatorvaultinsider.com" }],
        });
        assert.equal(result.valid, false);
      });
    })
  ) {
    failed++;
  }

  return { ok: failed === 0, failed };
}

if (require.main === module) {
  const result = runVerifyAutoposterGuard();
  console.log(result.ok ? "PASS" : "FAIL");
  process.exit(result.failed);
}

module.exports = { runVerifyAutoposterGuard };