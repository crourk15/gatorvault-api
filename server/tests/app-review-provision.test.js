const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-app-review-'));
const usersFile = path.join(tmpDir, 'users.json');
process.env.GV_USERS_PATH = usersFile;

const { provisionAppReviewAccount, allowedReviewEmail } = require('../lib/app-review-provision');
const { verifyPassword } = require('../lib/password-auth');

test('allowedReviewEmail accepts default review address', () => {
  assert.equal(allowedReviewEmail('appreview@gatorvaultinsider.com'), true);
  assert.equal(allowedReviewEmail('random@gmail.com'), false);
});

test('provisionAppReviewAccount creates, resets password, and grants war tier', () => {
  const email = 'appreview@gatorvaultinsider.com';
  const password = 'GvAppReview!2026';

  const first = provisionAppReviewAccount({ email, password, tier: 'war' });
  assert.equal(first.ok, true);
  assert.equal(first.created, true);
  assert.equal(first.passwordReset, false);
  assert.equal(first.statusPayload.tier, 'war');
  assert.equal(first.statusPayload.paid, true);

  const second = provisionAppReviewAccount({ email, password: 'GvAppReview!2027', tier: 'war' });
  assert.equal(second.ok, true);
  assert.equal(second.created, false);
  assert.equal(second.passwordReset, true);

  const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  const user = users.find((u) => u.email === email);
  assert.ok(user);
  assert.equal(verifyPassword('GvAppReview!2027', user.passwordHash), true);
  assert.equal(verifyPassword(password, user.passwordHash), false);
});
