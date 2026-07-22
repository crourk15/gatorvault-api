const test = require('node:test');
const assert = require('node:assert/strict');
const { isResendReady, getResendFrom } = require('../../lib/resend-server');

test('isResendReady reflects RESEND_API_KEY', () => {
  const prev = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  assert.equal(isResendReady(), false);
  process.env.RESEND_API_KEY = 're_test';
  assert.equal(isResendReady(), true);
  if (prev == null) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = prev;
});

test('getResendFrom has GatorVault default', () => {
  const prev = process.env.RESEND_FROM;
  delete process.env.RESEND_FROM;
  assert.match(getResendFrom(), /GatorVault/);
  if (prev == null) delete process.env.RESEND_FROM;
  else process.env.RESEND_FROM = prev;
});
