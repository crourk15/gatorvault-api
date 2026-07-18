/**
 * Durable log of App Store Server Notifications (audit / support).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const BUNDLE_PATH = path.join(__dirname, '..', 'data', 'war-room', 'apple-iap-notifications.json');

function resolvePath() {
  const fromEnv = String(process.env.GV_APPLE_IAP_NOTIFICATIONS_PATH || '').trim();
  if (fromEnv) return fromEnv;
  try {
    if (process.env.NODE_ENV === 'production' && fs.existsSync('/var/data')) {
      return '/var/data/subscription/apple-iap-notifications.json';
    }
  } catch {
    /* ignore */
  }
  return BUNDLE_PATH;
}

function readDoc() {
  try {
    const raw = JSON.parse(fs.readFileSync(resolvePath(), 'utf8'));
    return {
      version: 1,
      updatedAt: raw.updatedAt || null,
      entries: Array.isArray(raw.entries) ? raw.entries : [],
    };
  } catch {
    return { version: 1, updatedAt: null, entries: [] };
  }
}

function writeDoc(doc) {
  const filePath = resolvePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const next = { ...doc, updatedAt: new Date().toISOString() };
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`);
  fs.renameSync(tmp, filePath);
  return next;
}

function appendNotification(entry) {
  const doc = readDoc();
  doc.entries.unshift({
    at: new Date().toISOString(),
    ...entry,
  });
  doc.entries = doc.entries.slice(0, 200);
  writeDoc(doc);
  return doc.entries[0];
}

function getRecentNotifications(limit = 20) {
  const doc = readDoc();
  return {
    path: resolvePath(),
    durable: String(resolvePath()).startsWith('/var/data'),
    updatedAt: doc.updatedAt,
    entries: (doc.entries || []).slice(0, Math.max(1, Math.min(100, Number(limit) || 20))),
  };
}

module.exports = {
  appendNotification,
  getRecentNotifications,
  resolvePath,
};
