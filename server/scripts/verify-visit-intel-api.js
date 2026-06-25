const assert = require("node:assert/strict");
function check(label, fn) {
  try { fn(); console.log("  OK", label); return true; }
  catch (err) { console.error("  FAIL", label, "-", err.message); return false; }
}
let failed = 0;
if (!check("visit-intel-utils", () => {
  const u = require("../lib/visit-intel-utils");
  assert.equal(typeof u.getVisitIntelBoardSnapshot, "function");
})) failed++;
if (!check("visit-guard", () => {
  const g = require("../lib/x-autoposter-visit-guard");
  assert.equal(g.evaluateVisitIntelPostGate({ text: "hello" }).allow, true);
})) failed++;
if (!check("policy gate", () => {
  const policy = require("../lib/x-autoposter-policy");
  const result = policy.validatePostContent({
    text: "Fresh 2027 visit intel updated on FutureCast board",
    category: "engagement",
    action: "reply",
    inReplyToStatusId: "123",
    sources: [{ label: "GatorVault", url: "https://gatorvaultinsider.com" }],
  });
  assert.equal(result.valid, false);
})) failed++;
console.log(failed ? "FAIL" : "PASS");
process.exit(failed);