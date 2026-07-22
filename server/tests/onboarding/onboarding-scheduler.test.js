const test = require('node:test');
const assert = require('node:assert/strict');

const {
  daysSinceSignup,
  dueDripDays,
  dueTrialReminderKeys,
  processOnboardingQueue,
} = require('../../lib/onboarding-scheduler');
const {
  ONBOARDING_SEQUENCE,
  getOnboardingEmailByDay,
  getTrialReminderEmail,
  getWelcomeEmail,
} = require('../../lib/onboarding-emails');

test('onboarding sequence includes drip + trial-ending day', () => {
  const days = ONBOARDING_SEQUENCE.map((e) => e.day);
  assert.deepEqual(days, [0, 1, 3, 7, 25]);
  assert.ok(getWelcomeEmail({ email: 'a@b.com', name: 'A' }).html.includes('GatorVault'));
  assert.ok(getOnboardingEmailByDay(7, { email: 'a@b.com' }).subject.toLowerCase().includes('checklist'));
  assert.ok(getTrialReminderEmail(1, { email: 'a@b.com', trialEndStr: 'Friday' }).html.includes('membership'));
});

test('dueDripDays respects elapsed signup days and sent set', () => {
  const now = new Date('2026-07-22T12:00:00.000Z');
  const user = {
    email: 'fan@example.com',
    createdAt: '2026-07-15T12:00:00.000Z',
    onboardingSent: [0, 1, 3],
  };
  assert.equal(daysSinceSignup(user, now), 7);
  assert.deepEqual(dueDripDays(user, now), [7]);
});

test('dueTrialReminderKeys fires on exact daysLeft', () => {
  const now = new Date('2026-07-22T12:00:00.000Z');
  const user = {
    email: 'fan@example.com',
    trialEnd: '2026-07-27T12:00:00.000Z',
    trialRemindersSent: [],
  };
  assert.deepEqual(dueTrialReminderKeys(user, now), ['d5']);
});

test('processOnboardingQueue sends drip and skips paid users', async () => {
  const now = new Date('2026-07-22T12:00:00.000Z');
  const users = [
    {
      email: 'paid@example.com',
      createdAt: '2026-07-01T12:00:00.000Z',
      trialEnd: '2026-08-01T12:00:00.000Z',
      onboardingSent: [0],
      paid: true,
      subscription: { status: 'active', expiresAt: '2027-01-01T00:00:00.000Z' },
    },
    {
      email: 'trial@example.com',
      name: 'Trial Fan',
      tier: 'locker',
      createdAt: '2026-07-21T12:00:00.000Z',
      trialEnd: '2026-08-20T12:00:00.000Z',
      onboardingSent: [0],
      trialRemindersSent: [],
    },
  ];
  const sent = [];
  const result = await processOnboardingQueue({
    now,
    loadUsers: () => users,
    saveUsers: (next) => {
      users.splice(0, users.length, ...next);
    },
    deliverEmail: async (to, subject) => {
      sent.push({ to, subject });
      return { sent: true, provider: 'test' };
    },
    hasPaidAccess: (u) => Boolean(u.subscription && u.subscription.status === 'active' || u.paid),
  });

  assert.equal(result.sent, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'trial@example.com');
  assert.ok(users[1].onboardingSent.includes(1));
  assert.deepEqual(users[0].onboardingSent, [0]);
});

test('processOnboardingQueue sends trial d1 convert email', async () => {
  const now = new Date('2026-07-22T12:00:00.000Z');
  const users = [
    {
      email: 'ending@example.com',
      name: 'Ending',
      createdAt: '2026-06-22T12:00:00.000Z',
      trialEnd: '2026-07-23T12:00:00.000Z',
      onboardingSent: [0, 1, 3, 7, 25],
      trialRemindersSent: ['d5'],
    },
  ];
  const sent = [];
  const result = await processOnboardingQueue({
    now,
    loadUsers: () => users,
    saveUsers: (next) => {
      users.splice(0, users.length, ...next);
    },
    deliverEmail: async (to, subject) => {
      sent.push({ to, subject });
      return { sent: true, provider: 'test' };
    },
    hasPaidAccess: () => false,
  });

  assert.equal(result.sent, 1);
  assert.match(sent[0].subject, /Last day/i);
  assert.ok(users[0].trialRemindersSent.includes('d1'));
});
