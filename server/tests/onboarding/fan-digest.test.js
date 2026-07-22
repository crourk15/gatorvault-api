const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  pickBeatItems,
  pickMovementItems,
  pickVisitItems,
  getFanDigestEmail,
  listEligibleFanDigestRecipients,
  processFanDigestWeekly,
} = require('../../lib/fan-digest');

test('pick helpers normalize digest rows', () => {
  const beat = pickBeatItems(
    [{ writerName: 'Beat', text: 'Florida practice notes from The Swamp today', url: 'https://x.com/a' }],
    2
  );
  assert.equal(beat.length, 1);
  assert.equal(beat[0].source, 'Beat');

  const movement = pickMovementItems(
    [{ name: 'Prospect A', summary: 'UF trending up', profileUrl: '/vault/recruiting/player/a' }],
    2
  );
  assert.equal(movement[0].name, 'Prospect A');
  assert.match(movement[0].url, /recruiting/);

  const visits = pickVisitItems(
    [{ name: 'Prospect B', visitStart: '2026-07-18', visitEnd: '2026-07-19', visitSourceLabel: 'On3' }],
    2
  );
  assert.equal(visits[0].name, 'Prospect B');
  assert.match(visits[0].summary, /2026-07-18/);
});

test('getFanDigestEmail builds branded weekly subject/html', () => {
  const built = getFanDigestEmail({
    email: 'fan@example.com',
    name: 'Fan',
    weekKey: '2026-W30',
    beatItems: [{ source: 'Writer', text: 'Notes', url: 'https://example.com' }],
    movementItems: [],
    visitItems: [],
  });
  assert.match(built.subject, /2026-W30/);
  assert.ok(built.html.includes('GATORVAULT'));
  assert.ok(built.html.includes('Beat intel'));
  assert.ok(built.html.includes('Recruiting movement'));
  assert.ok(built.html.includes('Verified visits'));
});

test('listEligibleFanDigestRecipients skips opted-out and expired trial', () => {
  const recipients = listEligibleFanDigestRecipients(() => [
    {
      email: 'paid@x.com',
      paid: true,
      subscription: { status: 'active', expiresAt: '2027-01-01T00:00:00.000Z' },
    },
    { email: 'optout@x.com', paid: true, fanDigestOptOut: true, subscription: { status: 'active' } },
    { email: 'expired@x.com', trialEnd: '2020-01-01T00:00:00.000Z', paid: false },
  ]);
  assert.deepEqual(
    recipients.map((r) => r.email),
    ['paid@x.com']
  );
});

test('processFanDigestWeekly sends once per week and marks users', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-fan-digest-'));
  const usersPath = path.join(tmp, 'users.json');
  const statePath = path.join(tmp, 'fan-digest-state.json');
  fs.writeFileSync(
    usersPath,
    JSON.stringify([
      {
        email: 'member@example.com',
        name: 'Member',
        paid: true,
        subscription: { status: 'active', expiresAt: '2027-01-01T00:00:00.000Z' },
      },
    ])
  );
  process.env.GV_USERS_PATH = usersPath;
  process.env.GV_FAN_DIGEST_STATE_PATH = statePath;

  const sent = [];
  let users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  const result = await processFanDigestWeekly({
    asOf: new Date('2026-07-20T15:00:00.000Z'),
    force: true,
    loadUsers: () => users,
    saveUsers: (next) => {
      users = next;
      fs.writeFileSync(usersPath, JSON.stringify(next));
    },
    deliverEmail: async (to, subject) => {
      sent.push({ to, subject });
      return { sent: true, provider: 'test' };
    },
  });

  assert.equal(result.sent, 1);
  assert.ok(result.weekKey);
  assert.equal(sent.length, 1);
  assert.equal(users[0].fanDigestLastWeekKey, result.weekKey);

  const again = await processFanDigestWeekly({
    asOf: new Date('2026-07-20T15:00:00.000Z'),
    loadUsers: () => users,
    saveUsers: (next) => {
      users = next;
    },
    deliverEmail: async () => ({ sent: true, provider: 'test' }),
  });
  assert.equal(again.skipped, true);
  assert.equal(again.reason, 'already_sent_this_week');
  assert.equal(sent.length, 1);

  delete process.env.GV_USERS_PATH;
  delete process.env.GV_FAN_DIGEST_STATE_PATH;
});
