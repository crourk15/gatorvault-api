/**
 * Durable UF commit autopost ledger — survives Render redeploys when queue.json resets.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { commitFingerprint } = require('./commit-fingerprint');

const LEDGER_PATH = path.join(__dirname, '..', 'data', 'x', 'autoposter-sent-commits.json');
const LEDGER_MAX = parseInt(process.env.X_AUTOPOST_SENT_LEDGER_MAX || '500', 10);
const COMMIT_REPOST_WINDOW_MS = parseInt(
  process.env.X_AUTOPOST_COMMIT_REPOST_WINDOW_MS || String(7 * 24 * 60 * 60 * 1000),
  10
);

function defaultDoc() {
  return { version: 1, updatedAt: new Date().toISOString(), entries: [] };
}

function loadLedger() {
  try {
    const raw = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    if (!Array.isArray(raw.entries)) return defaultDoc();
    return { ...defaultDoc(), ...raw, entries: raw.entries };
  } catch {
    return defaultDoc();
  }
}

function saveLedger(doc) {
  fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
  doc.version = 1;
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(doc, null, 2));
  return doc;
}

function textHash(text) {
  return crypto.createHash('sha256').update(String(text || '').trim().toLowerCase()).digest('hex').slice(0, 16);
}

function normalizeSlug(raw) {
  return String(raw || '').trim().toLowerCase();
}

function entryMatches(item, { slug, commitFingerprint: fp, text }) {
  const key = normalizeSlug(slug);
  const hash = text ? textHash(text) : null;
  if (key && normalizeSlug(item.playerSlug) === key) {
    if (hash && item.textHash === hash) return true;
    if (fp && item.commitFingerprint === fp) return true;
    if (item.eventType === 'commit' || item.eventType === 'flip') return true;
  }
  if (fp && item.commitFingerprint === fp) return true;
  if (hash && item.textHash === hash) return true;
  return false;
}

function hasRecentSentCommit({ slug, commitFingerprint: fp, text, eventType = 'commit' } = {}) {
  const cutoff = Date.now() - COMMIT_REPOST_WINDOW_MS;
  const doc = loadLedger();
  return doc.entries.some((entry) => {
    const ts = new Date(entry.sentAt || 0).getTime();
    if (!Number.isFinite(ts) || ts < cutoff) return false;
    if (eventType && entry.eventType && entry.eventType !== eventType) return false;
    return entryMatches(entry, { slug, commitFingerprint: fp, text });
  });
}

function recordSentCommit(item) {
  if (!item || item.status !== 'sent') return null;
  const player = item.playerContext?.player || null;
  const slug = normalizeSlug(
    item.playerSlug || player?.slug || item.validationMeta?.playerSlug || ''
  );
  const fp =
    item.commitFingerprint ||
    commitFingerprint(player || { slug, committedTo: 'Florida', commitDate: item.sourceEventCreatedAt });
  const row = {
    playerSlug: slug || null,
    playerName: item.playerName || null,
    commitFingerprint: fp || null,
    textHash: textHash(item.text),
    eventType: item.sourceEventType || 'commit',
    tweetId: item.tweetId || null,
    sentAt: item.sentAt || new Date().toISOString(),
    source: item.source || null,
  };
  if (!row.playerSlug && !row.commitFingerprint && !row.textHash) return null;

  const doc = loadLedger();
  if (doc.entries.some((e) => entryMatches(e, row))) return row;
  doc.entries.unshift(row);
  doc.entries = doc.entries.slice(0, LEDGER_MAX);
  saveLedger(doc);
  return row;
}

module.exports = {
  LEDGER_PATH,
  COMMIT_REPOST_WINDOW_MS,
  loadLedger,
  saveLedger,
  hasRecentSentCommit,
  recordSentCommit,
  textHash,
};
