const fs = require('fs');
const path = require('path');

/** Default ephemeral path (wiped on Render redeploy without a persistent disk). */
function defaultUsersPath() {
  return path.join(__dirname, '..', 'data', 'users.json');
}

function usersPath() {
  return process.env.GV_USERS_PATH || defaultUsersPath();
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

/** Atomic write so concurrent register/login cannot truncate the file mid-write. */
function atomicWriteJson(filePath, value) {
  ensureParentDir(filePath);
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function readJsonArray(filePath) {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/**
 * If the durable path is empty but the legacy ephemeral file has accounts,
 * copy them once so a deploy that adds GV_USERS_PATH does not orphan users.
 */
function migrateUsersFromLegacyIfNeeded() {
  const dest = usersPath();
  const legacy = defaultUsersPath();
  if (path.resolve(dest) === path.resolve(legacy)) return { migrated: false, reason: 'same_path' };
  if (fs.existsSync(dest)) {
    const existing = readJsonArray(dest);
    if (existing.length > 0) return { migrated: false, reason: 'dest_has_users', count: existing.length };
  }
  if (!fs.existsSync(legacy)) return { migrated: false, reason: 'no_legacy' };
  const legacyUsers = readJsonArray(legacy);
  if (!legacyUsers.length) return { migrated: false, reason: 'legacy_empty' };
  atomicWriteJson(dest, legacyUsers);
  return { migrated: true, count: legacyUsers.length, from: legacy, to: dest };
}

let migrateAttempted = false;

/** mtime-aware in-process cache — cuts full-file parse on hot login/tier paths. */
let usersCache = {
  path: null,
  mtimeMs: null,
  users: null,
};

function invalidateUsersCache() {
  usersCache = { path: null, mtimeMs: null, users: null };
}

function setUsersCache(filePath, users) {
  let mtimeMs = Date.now();
  try {
    mtimeMs = fs.statSync(filePath).mtimeMs;
  } catch {
    /* new file */
  }
  usersCache = { path: filePath, mtimeMs, users };
}

function loadUsers() {
  if (!migrateAttempted) {
    migrateAttempted = true;
    try {
      const result = migrateUsersFromLegacyIfNeeded();
      if (result.migrated) {
        console.log(
          `[user-store] migrated ${result.count} account(s) from ephemeral path → ${result.to}`
        );
      }
    } catch (err) {
      console.warn('[user-store] migrate failed:', err instanceof Error ? err.message : err);
    }
  }
  const filePath = usersPath();
  try {
    const st = fs.statSync(filePath);
    if (
      usersCache.path === filePath &&
      usersCache.mtimeMs === st.mtimeMs &&
      Array.isArray(usersCache.users)
    ) {
      return usersCache.users;
    }
  } catch {
    /* missing file → empty */
  }
  const users = readJsonArray(filePath);
  setUsersCache(filePath, users);
  return users;
}

function saveUsers(users) {
  if (!Array.isArray(users)) {
    throw new Error('saveUsers expects an array');
  }
  const filePath = usersPath();
  atomicWriteJson(filePath, users);
  setUsersCache(filePath, users);
}

/**
 * Sync load → mutate → save with no await gap (preferred for entitlement/auth writes).
 * @param {(users: object[]) => void} mutator
 * @returns {object[]}
 */
function mutateUsers(mutator) {
  const users = loadUsers().slice();
  mutator(users);
  saveUsers(users);
  return users;
}

function findUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  return loadUsers().find((u) => u.email === normalized) || null;
}

/**
 * One Map for fan-out eligibility (avoid N× findUserByEmail scans).
 * @param {object[]=} users
 * @returns {Map<string, object>}
 */
function indexUsersByEmail(users) {
  const list = Array.isArray(users) ? users : loadUsers();
  const map = new Map();
  for (const u of list) {
    const e = String(u?.email || '')
      .trim()
      .toLowerCase();
    if (e) map.set(e, u);
  }
  return map;
}

function findUserByOriginalTransactionId(originalTransactionId) {
  const key = String(originalTransactionId || '').trim();
  if (!key) return null;
  return (
    loadUsers().find(
      (u) => String(u.subscription?.originalTransactionId || '').trim() === key
    ) || null
  );
}

function findUserByAppAccountToken(appAccountToken) {
  const key = String(appAccountToken || '').trim().toLowerCase();
  if (!key) return null;
  return (
    loadUsers().find(
      (u) => String(u.subscription?.appAccountToken || '').trim().toLowerCase() === key
    ) || null
  );
}

function updateUser(email, patch) {
  const normalized = String(email || '').trim().toLowerCase();
  const users = loadUsers();
  const idx = users.findIndex((u) => u.email === normalized);
  if (idx < 0) return null;
  const next = users.slice();
  next[idx] = { ...users[idx], ...patch };
  saveUsers(next);
  return next[idx];
}

/**
 * Rename a member login email (typo fixes). Preserves password/trial/subscription.
 * @returns {{ ok: true, from: string, to: string, user: object } | { ok: false, error: string }}
 */
function changeUserEmail(fromEmail, toEmail) {
  const from = String(fromEmail || '').trim().toLowerCase();
  const to = String(toEmail || '').trim().toLowerCase();
  if (!from || !to) return { ok: false, error: 'from and to emails are required' };
  if (from === to) return { ok: false, error: 'from and to are the same' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, error: 'to email looks invalid' };
  }
  const users = loadUsers();
  const idx = users.findIndex((u) => u.email === from);
  if (idx < 0) return { ok: false, error: 'account_not_found' };
  if (users.some((u, i) => i !== idx && u.email === to)) {
    return { ok: false, error: 'target_email_in_use' };
  }
  const previousEmails = Array.isArray(users[idx].previousEmails)
    ? users[idx].previousEmails.slice()
    : [];
  if (!previousEmails.includes(from)) previousEmails.push(from);
  const next = users.slice();
  next[idx] = {
    ...users[idx],
    email: to,
    previousEmails,
    emailCorrectedAt: new Date().toISOString(),
  };
  saveUsers(next);
  return { ok: true, from, to, user: next[idx] };
}

function deleteUser(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;
  const users = loadUsers();
  const idx = users.findIndex((u) => u.email === normalized);
  if (idx < 0) return false;
  const next = users.slice();
  next.splice(idx, 1);
  saveUsers(next);
  return true;
}

function getUsersStoreInfo() {
  const filePath = usersPath();
  const users = loadUsers();
  return {
    path: filePath,
    count: users.length,
    durableEnv: Boolean(process.env.GV_USERS_PATH),
  };
}

module.exports = {
  get usersPath() {
    return usersPath();
  },
  loadUsers,
  saveUsers,
  mutateUsers,
  findUserByEmail,
  indexUsersByEmail,
  findUserByOriginalTransactionId,
  findUserByAppAccountToken,
  updateUser,
  changeUserEmail,
  deleteUser,
  migrateUsersFromLegacyIfNeeded,
  getUsersStoreInfo,
  invalidateUsersCache,
};
