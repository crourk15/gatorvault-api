/**
 * G4 — Prod leak audit: zero tolerance for PR6/THIN fallback copy on recruiting surfaces.
 */
const { PR6_FALLBACK_RE } = require('../player-intelligence/golden-four-compose');
const { THIN_FALLBACK_RE } = require('./rewrite/compose-synonym-rotation');
const qa = require('./recruiting-post-qa');
const eliteRecruiting = require('./elite-recruiting-compose');

function isPr789OnlyRecruiting() {
  return eliteRecruiting.isPr789OnlyRecruiting();
}

function classifyLeakText(text = '') {
  const t = String(text || '');
  if (!t.trim()) return null;
  if (PR6_FALLBACK_RE.test(t)) return 'pr6_fallback';
  if (THIN_FALLBACK_RE.test(t)) return 'thin_fallback';
  return null;
}

function isRecruitingSurfaceItem(item = {}) {
  return qa.isRecruitingPlayerCandidate(item);
}

function extractTraceLeak(item = {}) {
  const mode =
    item.validationMeta?.trace?.mode ||
    item.validationMeta?.composeTrace?.mode ||
    item.templateBlocks?.trace?.mode ||
    null;
  if (mode === 'n2_pr6_fallback' && isPr789OnlyRecruiting()) return 'n2_pr6_fallback';
  return null;
}

function auditTextSurface({ text, source, id, slug, status, sentAt, traceLeak = null }) {
  const leak = classifyLeakText(text);
  const leakTypes = [];
  if (leak) leakTypes.push(leak);
  if (traceLeak) leakTypes.push(traceLeak);
  if (!leakTypes.length) return null;
  return {
    source,
    id: id || null,
    slug: slug || null,
    status: status || null,
    sentAt: sentAt || null,
    leakTypes: [...new Set(leakTypes)],
    preview: String(text || '').replace(/\s+/g, ' ').trim().slice(0, 220)
  };
}

function auditQueueItems(items = [], { includeCancelled = false } = {}) {
  const violations = [];
  let scanned = 0;
  for (const item of items) {
    if (!includeCancelled && item.status === 'cancelled') continue;
    if (!isRecruitingSurfaceItem(item)) continue;
    scanned += 1;
    const row = auditTextSurface({
      text: item.text,
      source: 'queue',
      id: item.id,
      slug: item.playerSlug,
      status: item.status,
      sentAt: item.sentAt,
      traceLeak: extractTraceLeak(item)
    });
    if (row) violations.push(row);
  }
  return { scanned, violations };
}

function auditSentLedger(entries = []) {
  const violations = [];
  let scanned = 0;
  for (const entry of entries) {
    if (!entry?.text) continue;
    const slug = entry.playerSlug;
    const eventType = String(entry.eventType || '').toLowerCase();
    const recruiting =
      !!slug ||
      /recruit|detectives|beat|intel|commit|flip|visit|offer/i.test(eventType) ||
      /recruit|gatorvault|futurecast/i.test(String(entry.text || ''));
    if (!recruiting) continue;
    scanned += 1;
    const row = auditTextSurface({
      text: entry.text,
      source: 'sent_ledger',
      id: entry.tweetId || entry.textHash,
      slug,
      status: 'sent',
      sentAt: entry.sentAt
    });
    if (row) violations.push(row);
  }
  return { scanned, violations };
}

function runRecruitingLeakAudit(opts = {}) {
  const pr789Only = isPr789OnlyRecruiting();
  const surfaces = {
    queue: { scanned: 0, violations: [] },
    sent_ledger: { scanned: 0, violations: [] }
  };

  try {
    const store = require('../x-autoposter-store');
    const doc = store.loadQueue();
    surfaces.queue = auditQueueItems(doc.items || [], {
      includeCancelled: opts.includeCancelled === true
    });
  } catch (err) {
    surfaces.queue = { scanned: 0, violations: [], error: err.message };
  }

  try {
    const ledger = require('../x-autoposter-sent-ledger');
    const doc = ledger.loadLedger();
    surfaces.sent_ledger = auditSentLedger(doc.entries || []);
  } catch (err) {
    surfaces.sent_ledger = { scanned: 0, violations: [], error: err.message };
  }

  const violations = [...surfaces.queue.violations, ...surfaces.sent_ledger.violations];
  return {
    ok: true,
    pass: violations.length === 0,
    gate: 'G4',
    pr789Only,
    eliteComposeEnabled:
      typeof eliteRecruiting.eliteRecruitingComposeEnabled === 'function'
        ? eliteRecruiting.eliteRecruitingComposeEnabled()
        : process.env.X_AUTOPOST_ELITE_RECRUITING_COMPOSE !== 'false',
    leakCount: violations.length,
    violations,
    scanned: {
      queue: surfaces.queue.scanned,
      sentLedger: surfaces.sent_ledger.scanned
    },
    surfaces,
    auditedAt: new Date().toISOString()
  };
}

module.exports = {
  classifyLeakText,
  isRecruitingSurfaceItem,
  auditQueueItems,
  auditSentLedger,
  runRecruitingLeakAudit,
  PR6_FALLBACK_RE,
  THIN_FALLBACK_RE
};