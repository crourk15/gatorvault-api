/**
 * Inbox account-delete matcher -- full name / exact email only.
 * Run: node --test server/test/inbox-account-delete.test.js
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  INBOX_DELETE_REQUESTS,
  foldName,
  userMatchesTarget,
  findMatches,
  isProtectedAccount,
  runInboxAccountDeletes,
  deleteMembersByEmails,
} = require('../lib/inbox-account-delete');

const logan = INBOX_DELETE_REQUESTS.find((t) => t.id === 'logan-cannon');
const jason = INBOX_DELETE_REQUESTS.find((t) => t.id === 'jason-mccoy');
const ken = INBOX_DELETE_REQUESTS.find((t) => t.id === 'ken-wilkerson');
const jeff = INBOX_DELETE_REQUESTS.find((t) => t.id === 'jeff-clawson');

describe('inbox account delete matching', () => {
  it('folds inbox display names to the same key', () => {
    assert.equal(foldName('Logan Cannon'), 'logancannon');
    assert.equal(foldName('Jeffclawson'), 'jeffclawson');
    assert.equal(foldName('Jason McCoy'), foldName('JasonMccoy'));
  });

  it('matches Logan by the SEBTS address and Ken by the hotmail typo address', () => {
    assert.equal(userMatchesTarget({ email: 'lec7575@sebts.edu', name: '' }, logan), true);
    assert.equal(userMatchesTarget({ email: 'atdiamondndarfur@hotmail.com', name: 'Other' }, ken), true);
    assert.equal(userMatchesTarget({ email: 'jeff@example.com', name: 'Jeff Clawson' }, jeff), true);
    assert.equal(userMatchesTarget({ email: 'jason.mccoy@yahoo.com', name: 'JasonMccoy' }, jason), true);
  });

  it('does not match a last name only or a different McCoy', () => {
    assert.equal(userMatchesTarget({ email: 'other@x.com', name: 'McCoy' }, jason), false);
    assert.equal(userMatchesTarget({ email: 'jareylan@x.com', name: 'JaReylan McCoy' }, jason), false);
    assert.equal(userMatchesTarget({ email: 'random@x.com', name: 'Cannon' }, logan), false);
  });

  it('never matches operator / App Review accounts', () => {
    assert.equal(isProtectedAccount({ email: 'gatorvaultinsider@gmail.com' }), true);
    assert.equal(userMatchesTarget({ email: 'crourk15@gmail.com', name: 'Logan Cannon' }, logan), false);
    assert.equal(userMatchesTarget({ email: 'appreview@apple.com', name: 'Ken Wilkerson' }, ken), false);
  });

  it('finds each listed member once', () => {
    const users = [
      { email: 'lec7575@sebts.edu', name: 'Logan Cannon' },
      { email: 'jeff.c@example.com', name: 'Jeff Clawson' },
      { email: 'jareylan@x.com', name: 'JaReylan McCoy' },
      { email: 'jason.m@yahoo.com', name: 'Jason McCoy' },
      { email: 'atdiamondndarfur@hotmail.com', name: 'Ken Wilkerson' },
    ];
    const emails = INBOX_DELETE_REQUESTS.flatMap((t) => findMatches(users, t)).map((m) => m.email);
    assert.deepEqual(emails.sort(), [
      'atdiamondndarfur@hotmail.com',
      'jeff.c@example.com',
      'jason.m@yahoo.com',
      'lec7575@sebts.edu',
    ].sort());
  });
});

describe('inbox account delete runner', () => {
  it('deletes matches and is idempotent after the stamp', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-inbox-del-'));
    const stamp = path.join(dir, 'stamp.json');
    const removed = [];
    const users = [
      { email: 'lec7575@sebts.edu', name: 'Logan Cannon' },
      { email: 'jeff.c@example.com', name: 'Jeff Clawson' },
    ];
    const first = await runInboxAccountDeletes({
      stampPath: stamp,
      loadUsers: () => users,
      deleteAccountForUser: async (email) => {
        removed.push(email);
        return { ok: true, email };
      },
    });
    assert.equal(first.deletedCount, 2);
    assert.equal(first.completed, true);
    const second = await runInboxAccountDeletes({
      stampPath: stamp,
      loadUsers: () => users,
      deleteAccountForUser: async (email) => {
        removed.push(email);
        return { ok: true, email };
      },
    });
    assert.equal(second.skipped, true);
    assert.equal(removed.length, 2);
  });

  it('skips protected emails when deleting an explicit list', async () => {
    const result = await deleteMembersByEmails(
      ['fan@example.com', 'gatorvaultinsider@gmail.com', 'missing@example.com'],
      {
        loadUsers: () => [
          { email: 'fan@example.com', name: 'Fan' },
          { email: 'gatorvaultinsider@gmail.com', name: 'Ops' },
        ],
        deleteAccountForUser: async (email) => ({ ok: true, email }),
      }
    );
    assert.equal(result.deletedCount, 1);
    assert.equal(result.deleted[0].email, 'fan@example.com');
    assert.equal(result.skipped.some((s) => s.reason === 'protected'), true);
    assert.equal(result.skipped.some((s) => s.reason === 'not_found'), true);
  });
});
