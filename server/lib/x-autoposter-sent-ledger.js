/**
 * Durable UF commit autopost ledger — survives Render redeploys when queue.json resets.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { commitFingerprint } = require('./commit-fingerprint');

const LEDGER_PATH = path.join(__dirname, '..', 'data', 'x', 'autoposter-sent-commits.json');
const ON3_SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'on3-snapshot.json');
const LEDGER_MAX = parseInt(process.env.X_AUTOPOST_SENT_LEDGER_MAX || '500', 10);
const COMMIT_REPOST_WINDOW_MS = parseInt(
  process.env.X_AUTOPOST_COMMIT_REPOST_WINDOW_MS || String(30 * 24 * 60 * 60 * 1000),
  10
);

const COMMIT_ANNOUNCEMENT_PATTERNS = [
  /shutting it down for the gators/i,
  /\b(committed|commits|flipped|pledged)\b[\s\S]{0,120}\b(florida|gators)\b/i,
  /\b(florida|gators)\b[\s\S]{0,120}\b(committed|commits|flipped|pledged)\b/i,
  /closes another piece of the 2024 puzzle/i,
];

function defaultDoc() {
  return { version: 1, updatedAt: new Date().toISOString(), entries: [] };
}

function loadSnapshotSent() {
  try {
    const raw = JSON.parse(fs.readFileSync(ON3_SNAPSHOT_PATH, 'utf8'));
    const map = raw && raw.xAutopostSent && typeof raw.xAutopostSent === 'object' ? raw.xAutopostSent : {};
    return map;
  } catch {
    return {};
  }
}

function snapshotEntries() {
  const map = loadSnapshotSent();
  return Object.values(map)
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({
      playerSlug: row.playerSlug || null,
      playerName: row.playerName || null,
      commitFingerprint: row.commitFingerprint || null,
      textHash: row.textHash || null,
      eventType: row.eventType || 'commit',
      tweetId: row.tweetId || null,
      sentAt: row.sentAt || null,
      source: row.source || 'on3-snapshot',
    }))
    .filter((row) => row.playerSlug || row.commitFingerprint || row.textHash);
}

function persistSnapshotSent(row) {
  const slug = normalizeSlug(row?.playerSlug);
  if (!slug) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(ON3_SNAPSHOT_PATH, 'utf8'));
    if (!raw || typeof raw !== 'object') return false;
    if (!raw.xAutopostSent || typeof raw.xAutopostSent !== 'object') raw.xAutopostSent = {};
    raw.xAutopostSent[slug] = {
      playerSlug: slug,
      playerName: row.playerName || raw.xAutopostSent[slug]?.playerName || null,
      commitFingerprint: row.commitFingerprint || raw.xAutopostSent[slug]?.commitFingerprint || null,
      textHash: row.textHash || raw.xAutopostSent[slug]?.textHash || null,
      eventType: row.eventType || 'commit',
      tweetId: row.tweetId || raw.xAutopostSent[slug]?.tweetId || null,
      sentAt: row.sentAt || new Date().toISOString(),
      source: row.source || raw.xAutopostSent[slug]?.source || 'autoposter',
    };
    fs.writeFileSync(ON3_SNAPSHOT_PATH, JSON.stringify(raw, null, 2) + '\n', 'utf8');
    return true;
  } catch {
    return false;
  }
}

function mergeSnapshotIntoDoc(doc) {
  const merged = { ...doc, entries: [...(doc.entries || [])] };
  for (const snap of snapshotEntries()) {
    if (merged.entries.some((e) => entryMatches(e, snap))) continue;
    merged.entries.push(snap);
  }
  merged.entries.sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0));
  return merged;
}

function loadLedger() {
  let doc = defaultDoc();
  try {
    const raw = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    if (Array.isArray(raw.entries)) doc = { ...defaultDoc(), ...raw, entries: raw.entries };
  } catch {
    /* use default */
  }
  return mergeSnapshotIntoDoc(doc);
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

function isCommitAnnouncementText(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  return COMMIT_ANNOUNCEMENT_PATTERNS.some((re) => re.test(t));
}

function entryMatches(item, { slug, commitFingerprint: fp, text, playerSlug } = {}) {
  const key = normalizeSlug(slug || playerSlug || item.playerSlug);
  const hash = text ? textHash(text) : item.textHash || null;
  const itemSlug = normalizeSlug(item.playerSlug);
  if (key && itemSlug === key) {
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
  if (doc.entries.some((e) => entryMatches(e, row))) {
    persistSnapshotSent(row);
    return row;
  }
  doc.entries.unshift(row);
  doc.entries = doc.entries.slice(0, LEDGER_MAX);
  saveLedger(doc);
  persistSnapshotSent(row);
  return row;
}

function bootstrapFromQueueItems(items) {
  if (!Array.isArray(items)) return 0;
  let added = 0;
  for (const item of items) {
    if (item?.status !== 'sent') continue;
    const et = String(item.sourceEventType || item.eventType || 'commit').toLowerCase();
    if (et !== 'commit' && et !== 'flip') continue;
    const slug = normalizeSlug(
      item.playerSlug || item.playerContext?.player?.slug || item.validationMeta?.playerSlug || ''
    );
    const fp = item.commitFingerprint || null;
    if (hasRecentSentCommit({ slug, commitFingerprint: fp, text: item.text, eventType: et })) continue;
    const row = recordSentCommit(item);
    if (row) added += 1;
  }
  return added;
}

module.exports = {
  LEDGER_PATH,
  ON3_SNAPSHOT_PATH,
  COMMIT_REPOST_WINDOW_MS,
  loadLedger,
  saveLedger,
  hasRecentSentCommit,
  recordSentCommit,
  bootstrapFromQueueItems,
  isCommitAnnouncementText,
  textHash,
};
