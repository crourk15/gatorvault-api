const assert = require('assert');
const { normalizeReportReason, hasDuplicateOpenFlag } = require('../lib/community-flag-utils');

assert.strictEqual(normalizeReportReason('spam'), 'spam');
assert.strictEqual(normalizeReportReason(' Harassment '), 'harassment');
assert.strictEqual(normalizeReportReason('invalid'), null);

const flags = [
  { id: '1', postId: 'post-1', threadId: 't1', reporterEmail: 'a@test.com', status: 'open' },
  { id: '2', threadId: 'thread-2', postId: null, reporterEmail: 'a@test.com', status: 'open' },
];

assert.strictEqual(hasDuplicateOpenFlag(flags, { reporterEmail: 'a@test.com', postId: 'post-1' }), true);
assert.strictEqual(hasDuplicateOpenFlag(flags, { reporterEmail: 'a@test.com', threadId: 'thread-2' }), true);

console.log('community-flag-utils tests passed');