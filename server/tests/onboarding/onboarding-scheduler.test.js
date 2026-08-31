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

test('dueTrialReminderKeys catches up when exact day was missed', () => {
  const now = new Date('2026-07-22T12:00:00.000Z');
  // 3 days left — missed the exact d5 window
  const user = {
    email: 'fan@example.com',
    trialEnd: '2026-07-25T12:00:00.000Z',
    trialRemindersSent: [],
  };
  assert.deepEqual(dueTrialReminderKeys(user, now), ['d5']);
});

test('processOnboardingQueue respects maxSends budget and leaves work for next tick', async () => {
  const now = new Date('2026-07-22T12:00:00.000Z');
  const users = [
    {
      email: 'a@example.com',
      createdAt: '2026-07-15T12:00:00.000Z',
      trialEnd: '2026-08-20T12:00:00.000Z',
      onboardingSent: [0],
      trialRemindersSent: [],
    },
    {
      email: 'b@example.com',
      createdAt: '2026-07-15T12:00:00.000Z',
      trialEnd: '2026-08-20T12:00:00.000Z',
      onboardingSent: [0],
      trialRemindersSent: [],
    },
  ];
  const sent = [];
  const result = await processOnboardingQueue({
    now,
    maxSends: 1,
    saveEvery: 1,
    loadUsers: () => users,
    saveUsers: (next) => {
      users.splice(0, users.length, ...next);
    },
    deliverEmail: async (to) => {
      sent.push(to);
      return { sent: true, provider: 'test' };
    },
    hasPaidAccess: () => false,
  });
  assert.equal(result.sent, 1);
  assert.equal(result.hitBudget, true);
  assert.equal(sent.length, 1);
  // Catch-up would owe days 1,3,7 — budget 1 only completes the first due drip.
  assert.ok(users[0].onboardingSent.includes(1) || users[1].onboardingSent.includes(1));
});

test('dripEnabled ignores X_SCHEDULED_JOBS_ENABLED (Starter kill switch)', () => {
  const { dripEnabled } = require('../../lib/onboarding-scheduler');
  const prevJobs = process.env.X_SCHEDULED_JOBS_ENABLED;
  const prevDrip = process.env.ONBOARDING_DRIP_DISABLED;
  try {
    process.env.X_SCHEDULED_JOBS_ENABLED = 'false';
    delete process.env.ONBOARDING_DRIP_DISABLED;
    assert.equal(dripEnabled(), true);
    process.env.ONBOARDING_DRIP_DISABLED = 'true';
    assert.equal(dripEnabled(), false);
  } finally {
    if (prevJobs == null) delete process.env.X_SCHEDULED_JOBS_ENABLED;
    else process.env.X_SCHEDULED_JOBS_ENABLED = prevJobs;
    if (prevDrip == null) delete process.env.ONBOARDING_DRIP_DISABLED;
    else process.env.ONBOARDING_DRIP_DISABLED = prevDrip;
  }
});

test('boot starts onboarding scheduler without X_SCHEDULED_JOBS_ENABLED gate', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
  const block = src.slice(
    src.indexOf('startOnboardingScheduler'),
    src.indexOf('startOnboardingScheduler') + 800
  );
  // Ensure we did not re-introduce the Starter kill switch around the boot call.
  assert.match(src, /startOnboardingScheduler\(\{\s*loadUsers/);
  const gateIdx = src.indexOf("scheduler skipped — X_SCHEDULED_JOBS_ENABLED is not true");
  const startIdx = src.indexOf('startOnboardingScheduler({ loadUsers, saveUsers, deliverEmail, pushEmailLog })');
  assert.ok(startIdx > 0, 'expected unconditional startOnboardingScheduler boot call');
  // Autoposter may still log that skip message; onboarding must not be inside that if-branch.
  const onboardingBlock = src.slice(startIdx - 400, startIdx + 120);
  assert.equal(
    /scheduledJobsEnabled\(\)/.test(onboardingBlock),
    false,
    'onboarding boot must not call scheduledJobsEnabled'
  );
  void block;
  void gateIdx;
});

