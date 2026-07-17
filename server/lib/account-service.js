const fs = require('fs');
const path = require('path');
const { deleteUser, findUserByEmail } = require('./user-store');
const { rememberTrial, markTrialDeleted } = require('./trial-ledger');
const pointsStore = require('./points-store');
const alertEmailPersistence = require('./alert-email-persistence');
const { removeSubscriptionsForEmail } = require('./push-alert-service');

const COMMUNITY_DIR = path.join(__dirname, '..', 'data', 'community');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function purgeCommunityMember(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return;

  const usersPath = path.join(COMMUNITY_DIR, 'users.json');
  const followsPath = path.join(COMMUNITY_DIR, 'follows.json');
  const flagsPath = path.join(COMMUNITY_DIR, 'flags.json');

  const users = readJson(usersPath, []);
  const member = users.find((u) => String(u.email || '').toLowerCase() === normalized);
  if (!member) {
    const follows = readJson(followsPath, []).filter(
      (f) => String(f.email || '').toLowerCase() !== normalized
    );
    writeJson(followsPath, follows);
    return;
  }

  const memberId = member.id;
  writeJson(
    usersPath,
    users.filter((u) => u.id !== memberId)
  );

  writeJson(
    followsPath,
    readJson(followsPath, []).filter(
      (f) =>
        String(f.email || '').toLowerCase() !== normalized &&
        f.userId !== memberId &&
        f.followerId !== memberId
    )
  );

  const flags = readJson(flagsPath, []);
  let flagsChanged = false;
  for (const flag of flags) {
    if (String(flag.reporterEmail || '').toLowerCase() === normalized) {
      flag.reporterEmail = null;
      flagsChanged = true;
    }
  }
  if (flagsChanged) writeJson(flagsPath, flags);
}

async function deleteAccountForUser(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const existing = findUserByEmail(normalized);
  if (!existing) {
    return { ok: false, error: 'Account not found.' };
  }

  // Keep original trial window so re-register cannot mint another free month.
  rememberTrial(normalized, {
    trialEnd: existing.trialEnd,
    trialStart: existing.createdAt,
    createdAt: existing.createdAt,
  });
  markTrialDeleted(normalized);

  const removedAuth = deleteUser(normalized);
  if (!removedAuth) {
    return { ok: false, error: 'Account not found.' };
  }

  pointsStore.deleteUserPoints(normalized);
  purgeCommunityMember(normalized);
  try {
    removeSubscriptionsForEmail(normalized);
  } catch (err) {
    console.warn("[account-delete] push purge failed:", err.message);
  }
  try {
    await alertEmailPersistence.deletePref(normalized);
  } catch (err) {
    console.warn("[account-delete] alert prefs purge failed:", err.message);
  }

  return {
    ok: true,
    deleted: true,
    email: normalized,
    deletedAt: new Date().toISOString(),
  };
}

module.exports = { deleteAccountForUser, purgeCommunityMember };
