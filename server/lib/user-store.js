const fs = require('fs');
const path = require('path');

const USERS_PATH = path.join(__dirname, '..', 'data', 'users.json');

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.mkdirSync(path.dirname(USERS_PATH), { recursive: true });
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
}

function findUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  return loadUsers().find((u) => u.email === normalized) || null;
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
  USERS_PATH,
  loadUsers,
  saveUsers,
  findUserByEmail,
  updateUser,
  deleteUser,
};
