const fs = require('fs');
const path = require('path');
const { deleteUser, findUserByEmail } = require('./user-store');
const pointsStore = require('./points-store');

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

function deleteAccountForUser(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const existing = findUserByEmail(normalized);
  if (!existing) {
    return { ok: false, error: 'Account not found.' };
  }

  const removedAuth = deleteUser(normalized);
  if (!removedAuth) {
    return { ok: false, error: 'Account not found.' };
  }

  pointsStore.deleteUserPoints(normalized);
  purgeCommunityMember(normalized);

  return {
    ok: true,
    deleted: true,
    email: normalized,
    deletedAt: new Date().toISOString(),
  };
}

module.exports = { deleteAccountForUser, purgeCommunityMember };
