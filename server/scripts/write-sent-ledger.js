const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'lib', 'x-autoposter-sent-ledger.js');

const content = `/**
 * Durable UF commit autopost ledger - survives Render redeploys via on3-snapshot seed + file cache.
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

const COMMIT_TEXT_PATTERNS = [
  /\\bshutting it down for the gators\\b/i,
  /\\bcommitted to florida\\b/i,
  /\\bcommits to florida\\b/i,
  /\\bflipped to florida\\b/i,
  /\\bpledged to florida\\b/i,
  /\\bcloses another piece of the \\d{4} puzzle\\b/i,
];

function defaultDoc() {
  return { version: 1, updatedAt: new Date().toISOString(), entries: [] };
}

function loadSnapshotSent() {
  try {
    const raw = JSON.parse(fs.readFileSync(ON3_SNAPSHOT_PATH, 'utf8'));
    return raw.xAutopostSent && typeof raw.xAutopostSent === 'object' ? raw.xAutopostSent : {};
  } catch {
    return {};
  }
}

function snapshotEntries() {
  const sent = loadSnapshotSent();
  return Object.values(sent)
    .filter(Boolean)
    .map((row) => ({
      playerSlug: normalizeSlug(row.playerSlug),
      playerName: row.playerName || null,
      commitFingerprint: row.commitFingerprint || null,
      textHash: row.textHash || null,
      eventType: row.eventType || 'commit',
      tweetId: row.tweetId || null,
      sentAt: row.sentAt || row.xCommitAutopostAt || null,
      source: row.source || 'snapshot',
    }));
}

function loadLedger() {
  let doc = defaultDoc();
  try {
    const raw = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    if (Array.isArray(raw.entries)) {
      doc = { ...defaultDoc(), ...raw, entries: [...raw.entries] };
    }
  } catch {
    /* use default */
  }
  for (const seed of snapshotEntries()) {
    if (!seed.playerSlug && !seed.commitFingerprint) continue;
    if (!doc.entries.some((e) => entryMatches(e, seed))) {
      doc.entries.push(seed);
    }
  }
  return doc;
}

function saveLedger(doc) {
  fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
  doc.version = 1;
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(doc, null, 2));
  return doc;
}

function persistSnapshotSent(row) {
  if (!row?.playerSlug) return;
  try {
    const raw = JSON.parse(fs.readFileSync(ON3_SNAPSHOT_PATH, 'utf8'));
    raw.xAutopostSent = raw.xAutopostSent || {};
    raw.xAutopostSent[row.playerSlug] = {
      playerSlug: row.playerSlug,
      playerName: row.playerName,
      commitFingerprint: row.commitFingerprint,
      textHash: row.textHash,
      eventType: row.eventType,
      tweetId: row.tweetId,
      sentAt: row.sentAt,
      source: row.source || 'autoposter',
    };
    fs.writeFileSync(ON3_SNAPSHOT_PATH, JSON.stringify(raw, null, 2));
  } catch {
    /* non-fatal on read-only deploys */
  }
}

function textHash(text) {
  return crypto.createHash('sha256').update(String(text || '').trim().toLowerCase()).digest('hex').slice(0, 16);
}

function normalizeSlug(raw) {
  return String(raw || '').trim().toLowerCase();
}

function isCommitAnnouncementText(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  return COMMIT_TEXT_PATTERNS.some((re) => re.test(t));
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
  persistSnapshotSent(row);
  return row;
}

function bootstrapFromQueueItems(items) {
  if (!Array.isArray(items) || !items.length) return 0;
  let added = 0;
  for (const item of items) {
    if (item.status !== 'sent') continue;
    if (
      !isCommitAnnouncementText(item.text) &&
      item.sourceEventType !== 'commit' &&
      item.sourceEventType !== 'flip'
    ) {
      continue;
    }
    const before = loadLedger().entries.length;
    recordSentCommit(item);
    const after = loadLedger().entries.length;
    if (after > before) added++;
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
`;

fs.writeFileSync(target, content, 'utf8');
console.log('Wrote', target);
