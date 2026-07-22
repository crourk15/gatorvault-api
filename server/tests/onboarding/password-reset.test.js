const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  getPasswordResetEmail,
  requestPasswordReset,
  resetPasswordWithToken,
  hashToken,
} = require('../../lib/password-reset');
const { verifyPassword } = require('../../lib/password-auth');
const { digestEnabled } = require('../../lib/fan-digest');

test('weekly fan digest is off unless FAN_DIGEST_ENABLED', () => {
  const prevEn = process.env.FAN_DIGEST_ENABLED;
  const prevDis = process.env.FAN_DIGEST_DISABLED;
  delete process.env.FAN_DIGEST_ENABLED;
  delete process.env.FAN_DIGEST_DISABLED;
  assert.equal(digestEnabled(), false);
  process.env.FAN_DIGEST_ENABLED = 'true';
  assert.equal(digestEnabled(), true);
  process.env.FAN_DIGEST_DISABLED = 'true';
  assert.equal(digestEnabled(), false);
  if (prevEn == null) delete process.env.FAN_DIGEST_ENABLED;
  else process.env.FAN_DIGEST_ENABLED = prevEn;
  if (prevDis == null) delete process.env.FAN_DIGEST_DISABLED;
  else process.env.FAN_DIGEST_DISABLED = prevDis;
});

test('password reset email includes reset CTA', () => {
  const built = getPasswordResetEmail({
    email: 'fan@example.com',
    name: 'Fan',
    resetUrl: 'https://gatorvaultinsider.com/join/?mode=reset&email=fan%40example.com&token=abc',
  });
  assert.match(built.subject, /reset/i);
  assert.ok(built.html.includes('Reset password'));
  assert.ok(built.html.includes('mode=reset'));
});

test('request + reset password round trip', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-pw-reset-'));
  const usersPath = path.join(tmp, 'users.json');
  fs.writeFileSync(
    usersPath,
    JSON.stringify([
      {
        email: 'resetme@example.com',
        name: 'Reset',
        passwordHash: require('../../lib/password-auth').hashPassword('old-password-1'),
        tier: 'film',
      },
    ])
  );
  process.env.GV_USERS_PATH = usersPath;

  let captured = null;
  const req = await requestPasswordReset('resetme@example.com', {
    deliverEmail: async (to, subject, html) => {
      captured = { to, subject, html };
      return { sent: true, provider: 'test' };
    },
  });
  assert.equal(req.emailSent, true);
  assert.ok(captured?.html);

  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  assert.ok(users[0].passwordResetTokenHash);
  // Extract token from URL in email HTML
  const match = captured.html.match(/token=([a-f0-9]+)/i);
  assert.ok(match, 'token in email');
  const token = match[1];
  assert.equal(hashToken(token), users[0].passwordResetTokenHash);

  const result = resetPasswordWithToken({
    email: 'resetme@example.com',
    token,
    password: 'new-password-9',
  });
  assert.equal(result.ok, true);
  const after = JSON.parse(fs.readFileSync(usersPath, 'utf8'))[0];
  assert.equal(after.passwordResetTokenHash, null);
  assert.ok(verifyPassword('new-password-9', after.passwordHash));
  assert.equal(verifyPassword('old-password-1', after.passwordHash), false);

  delete process.env.GV_USERS_PATH;
});

test('unknown email still returns accepted', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-pw-reset2-'));
  process.env.GV_USERS_PATH = path.join(tmp, 'users.json');
  fs.writeFileSync(process.env.GV_USERS_PATH, '[]');
  const result = await requestPasswordReset('nobody@example.com', {
    deliverEmail: async () => ({ sent: true, provider: 'test' }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.found, false);
  delete process.env.GV_USERS_PATH;
});
