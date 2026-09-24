/**
 * Honor inbound company-inbox delete / stop-email requests.
 * Matches members in the durable user store only (never recruiting/roster names).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { isAdminAccount, isReservedOperatorEmail } = require('./session-auth');

const STAMP_NAME = 'inbox-account-delete-2026-09-24.json';

/** Company-inbox delete list (Sep 24 2026). Full name or exact email only. */
const INBOX_DELETE_REQUESTS = [
  {
    id: 'logan-cannon',
    emails: ['lec7575@sebts.edu'],
    names: ['Logan Cannon', 'logancannon'],
  },
  {
    id: 'jeff-clawson',
    emails: [],
    names: ['Jeff Clawson', 'Jeffclawson'],
  },
  {
    id: 'jason-mccoy',
    emails: [],
    names: ['Jason McCoy', 'JasonMccoy'],
  },
  {
    id: 'ken-wilkerson',
    emails: ['atdiamondndarfur@hotmail.com'],
    names: ['Ken Wilkerson', 'Kenwilkerson'],
  },
];

function foldName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isProtectedAccount(user) {
  const email = normalizeEmail(user?.email);
  if (!email || !email.includes('@')) return true;
  if (isAdminAccount(email) || isReservedOperatorEmail(email)) return true;
  if (/appreview|app.?review|apple.?review/.test(email)) return true;
  if (email.endsWith('@gatorvault.test') || email.endsWith('@gatorvaultinsider.com')) return true;
  return false;
}

function targetFolds(target) {
  const emails = (target.emails || []).map(normalizeEmail).filter(Boolean);
  const names = new Set((target.names || []).map(foldName).filter((n) => n.length >= 8));
  return { emails, names };
}

function userMatchesTarget(user, target) {
  if (!user || isProtectedAccount(user)) return false;
  const email = normalizeEmail(user.email);
  const { emails, names } = targetFolds(target);
  if (email && emails.includes(email)) return true;
  const foldedName = foldName(user.name);
  if (foldedName && names.has(foldedName)) return true;
  const local = foldName(email.split('@')[0] || '');
  if (local && names.has(local)) return true;
  return false;
}

function findMatches(users, target) {
  const list = Array.isArray(users) ? users : [];
  const seen = new Set();
  const matches = [];
  for (const user of list) {
    if (!userMatchesTarget(user, target)) continue;
    const email = normalizeEmail(user.email);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    matches.push({
      email,
      name: user.name || null,
      targetId: target.id,
    });
  }
  return matches;
}

function stampPath(explicit) {
  if (explicit) return explicit;
  if (process.env.GV_OPS_DIR) return path.join(process.env.GV_OPS_DIR, STAMP_NAME);
  if (process.env.GV_USERS_PATH) {
    return path.join(path.dirname(process.env.GV_USERS_PATH), 'ops', STAMP_NAME);
  }
  if (fs.existsSync('/var/data')) return path.join('/var/data/ops', STAMP_NAME);
  return path.join(__dirname, '..', 'data', 'ops', STAMP_NAME);
}

function readStamp(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeStamp(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

async function runInboxAccountDeletes(opts = {}) {
  const filePath = stampPath(opts.stampPath);
  const prior = readStamp(filePath);
  if (prior?.completed === true && opts.force !== true) {
    return { ok: true, skipped: true, reason: 'already_completed', ...prior };
  }

  const loadUsersFn = opts.loadUsers || (() => require('./user-store').loadUsers());
  const deleteFn = opts.deleteAccountForUser || ((email) => require('./account-service').deleteAccountForUser(email));

  let users = [];
  try {
    users = loadUsersFn() || [];
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const already = new Set(
    (prior?.deleted || []).map((row) => normalizeEmail(row.email)).filter(Boolean)
  );
  const deleted = Array.isArray(prior?.deleted) ? prior.deleted.slice() : [];
  const missing = [];
  const protectedHits = [];
  const failed = [];

  for (const target of INBOX_DELETE_REQUESTS) {
    const matches = findMatches(users, target);
    if (!matches.length) {
      missing.push({ id: target.id, reason: 'not_found' });
      continue;
    }
    for (const match of matches) {
      if (already.has(match.email)) continue;
      try {
        const result = await deleteFn(match.email);
        if (result && result.ok) {
          already.add(match.email);
          deleted.push({
            id: target.id,
            email: match.email,
            name: match.name,
            at: new Date().toISOString(),
          });
        } else if (result && /not found/i.test(String(result.error || ''))) {
          missing.push({ id: target.id, email: match.email, reason: 'not_found' });
        } else {
          failed.push({
            id: target.id,
            email: match.email,
            error: result?.error || 'delete_failed',
          });
        }
      } catch (err) {
        failed.push({
          id: target.id,
          email: match.email,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const completed = failed.length === 0;
  const report = {
    ok: failed.length === 0,
    completed,
    at: new Date().toISOString(),
    deletedCount: deleted.length,
    deleted,
    missing,
    protectedHits,
    failed,
  };
  try {
    writeStamp(filePath, report);
  } catch (err) {
    report.stampError = err instanceof Error ? err.message : String(err);
  }
  return report;
}

async function deleteMembersByEmails(emails, opts = {}) {
  const deleteFn = opts.deleteAccountForUser || ((email) => require('./account-service').deleteAccountForUser(email));
  const loadUsersFn = opts.loadUsers || (() => require('./user-store').loadUsers());
  const users = loadUsersFn() || [];
  const wanted = [...new Set((emails || []).map(normalizeEmail).filter((e) => e.includes('@')))];
  const deleted = [];
  const skipped = [];
  const failed = [];

  for (const email of wanted) {
    const user = users.find((u) => normalizeEmail(u?.email) === email);
    if (!user) {
      skipped.push({ email, reason: 'not_found' });
      continue;
    }
    if (isProtectedAccount(user)) {
      skipped.push({ email, reason: 'protected' });
      continue;
    }
    try {
      const result = await deleteFn(email);
      if (result && result.ok) deleted.push({ email, name: user.name || null });
      else failed.push({ email, error: result?.error || 'delete_failed' });
    } catch (err) {
      failed.push({ email, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return {
    ok: failed.length === 0,
    deletedCount: deleted.length,
    deleted,
    skipped,
    failed,
  };
}

module.exports = {
  INBOX_DELETE_REQUESTS,
  STAMP_NAME,
  foldName,
  userMatchesTarget,
  findMatches,
  isProtectedAccount,
  runInboxAccountDeletes,
  deleteMembersByEmails,
};
