const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-password-reset-secret';

const {
  getPasswordResetEmail,
  requestPasswordReset,
  resetPasswordWithToken,
  hashToken,
  signResetToken,
  readSignedResetToken,
  buildResetUrl,
  TOKEN_TTL_MS,
} = require('../../lib/password-reset');
const { verifyPassword, hashPassword } = require('../../lib/password-auth');
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

test('password reset email uses /reset/ CTA and 24h copy', () => {
  const built = getPasswordResetEmail({
    email: 'fan@example.com',
    name: 'Fan',
    resetUrl: 'https://gatorvaultinsider.com/reset/?email=fan%40example.com&token=abc.def',
  });
  assert.match(built.subject, /reset/i);
  assert.ok(built.html.includes('Reset password'));
  assert.ok(built.html.includes('/reset/'));
  assert.ok(built.html.includes('Safari or Chrome'));
  assert.ok(TOKEN_TTL_MS >= 24 * 60 * 60 * 1000);
});

test('setup email uses create-password copy', () => {
  const built = getPasswordResetEmail({
    email: 'gatorsbreakdown@gmail.com',
    name: 'Gators Breakdown',
    resetUrl: 'https://gatorvaultinsider.com/reset/?email=x&token=y',
    setup: true,
  });
  assert.match(built.subject, /create your gatorvault password/i);
  assert.ok(built.html.includes('Create password'));
});

test('buildResetUrl stays off /join so iOS AASA does not hijack it', () => {
  const url = buildResetUrl({ email: 'fan@example.com', token: 'body.sig' });
  assert.match(url, /\/reset\/\?/);
  assert.ok(!url.includes('/join/'));
  assert.ok(url.includes('email=fan%40example.com'));
});

async function withUsers(rows, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-pw-reset-'));
  const usersPath = path.join(tmp, 'users.json');
  fs.writeFileSync(usersPath, JSON.stringify(rows));
  const prev = process.env.GV_USERS_PATH;
  process.env.GV_USERS_PATH = usersPath;
  const { invalidateUsersCache } = require('../../lib/user-store');
  invalidateUsersCache();
  try {
    return await fn(usersPath);
  } finally {
    invalidateUsersCache();
    if (prev == null) delete process.env.GV_USERS_PATH;
    else process.env.GV_USERS_PATH = prev;
  }
}

function extractToken(html) {
  const match = String(html || '').match(/[?&]token=([^&"'<\s]+)/i);
  assert.ok(match, 'token in email');
  return decodeURIComponent(match[1]);
}

test('request + reset password round trip with signed token', async () => {
  await withUsers(
    [
      {
        email: 'resetme@example.com',
        name: 'Reset',
        passwordHash: hashPassword('old-password-1'),
        tier: 'film',
      },
    ],
    async (usersPath) => {
      let captured = null;
      const req = await requestPasswordReset('resetme@example.com', {
        deliverEmail: async (to, subject, html) => {
          captured = { to, subject, html };
          return { sent: true, provider: 'test' };
        },
      });
      assert.equal(req.emailSent, true);
      assert.ok(captured?.html);

      const token = extractToken(captured.html);
      assert.ok(readSignedResetToken(token), 'signed token parses');

      const first = resetPasswordWithToken({
        email: 'resetme@example.com',
        token,
        password: 'new-password-9',
      });
      assert.equal(first.ok, true);
      const after = JSON.parse(fs.readFileSync(usersPath, 'utf8'))[0];
      assert.equal(after.passwordResetTokenHash, null);
      assert.ok(verifyPassword('new-password-9', after.passwordHash));
      assert.equal(verifyPassword('old-password-1', after.passwordHash), false);

      const reused = resetPasswordWithToken({
        email: 'resetme@example.com',
        token,
        password: 'another-password-9',
      });
      assert.equal(reused.ok, false);
    }
  );
});

test('two reset emails stay valid until the password actually changes', async () => {
  await withUsers(
    [
      {
        email: 'twice@example.com',
        name: 'Twice',
        passwordHash: hashPassword('old-password-1'),
        tier: 'film',
      },
    ],
    async () => {
      const htmls = [];
      await requestPasswordReset('twice@example.com', {
        deliverEmail: async (_to, _subject, html) => {
          htmls.push(html);
          return { sent: true, provider: 'test' };
        },
      });
      await requestPasswordReset('twice@example.com', {
        deliverEmail: async (_to, _subject, html) => {
          htmls.push(html);
          return { sent: true, provider: 'test' };
        },
      });
      const firstToken = extractToken(htmls[0]);
      const result = resetPasswordWithToken({
        email: 'twice@example.com',
        token: firstToken,
        password: 'brand-new-pass-9',
      });
      assert.equal(result.ok, true);
    }
  );
});

test('legacy stored-hash token still works', async () => {
  const token = 'aa'.repeat(32);
  await withUsers(
    [
      {
        email: 'legacy@example.com',
        name: 'Legacy',
        passwordHash: hashPassword('old-password-1'),
        passwordResetTokenHash: hashToken(token),
        passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    ],
    () => {
      const result = resetPasswordWithToken({
        email: 'legacy@example.com',
        token,
        password: 'legacy-new-9',
      });
      assert.equal(result.ok, true);
    }
  );
});

test('signed token for the wrong email is rejected', async () => {
  await withUsers(
    [
      {
        email: 'a@example.com',
        passwordHash: hashPassword('old-password-1'),
      },
      {
        email: 'b@example.com',
        passwordHash: hashPassword('old-password-1'),
      },
    ],
    () => {
      const { findUserByEmail } = require('../../lib/user-store');
      const token = signResetToken('a@example.com', findUserByEmail('a@example.com'));
      const result = resetPasswordWithToken({
        email: 'b@example.com',
        token,
        password: 'nope-nope-9',
      });
      assert.equal(result.ok, false);
    }
  );
});

test('unknown email still returns accepted', async () => {
  await withUsers([], async () => {
    const result = await requestPasswordReset('nobody@example.com', {
      deliverEmail: async () => ({ sent: true, provider: 'test' }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.found, false);
  });
});
