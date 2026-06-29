const fs = require('fs');
const path = require('path');

function usersPath() {
  return process.env.GV_USERS_PATH || path.join(__dirname, '..', 'data', 'users.json');
}

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(usersPath(), 'utf8'));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  const filePath = usersPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2));
}

function findUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  return loadUsers().find((u) => u.email === normalized) || null;
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

function updateUser(email, patch) {
  const normalized = String(email || '').trim().toLowerCase();
  const users = loadUsers();
  const idx = users.findIndex((u) => u.email === normalized);
  if (idx < 0) return null;
  users[idx] = { ...users[idx], ...patch };
  saveUsers(users);
  return users[idx];
}

function deleteUser(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;
  const users = loadUsers();
  const idx = users.findIndex((u) => u.email === normalized);
  if (idx < 0) return false;
  users.splice(idx, 1);
  saveUsers(users);
  return true;
}

module.exports = {
  get usersPath() {
    return usersPath();
  },
  loadUsers,
  saveUsers,
  findUserByEmail,
  findUserByOriginalTransactionId,
  updateUser,
  deleteUser,
};
