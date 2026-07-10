const test = require('node:test');
const assert = require('node:assert/strict');
const inbox = require('../../lib/post-studio-intel-inbox');

test('getIntelInbox returns structured inbox rows', async () => {
  const out = await inbox.getIntelInbox({ limit: 5 });
  assert.equal(out.ok, true);
  assert.ok(Array.isArray(out.items));
});

test('getPipelineDashboard exposes detectives and inbox summary', async () => {
  const out = await inbox.getPipelineDashboard();
  assert.equal(out.ok, true);
  assert.ok(out.detectives);
  assert.ok(out.inboxSummary);
});
