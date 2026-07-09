const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const policy = require('./x-autoposter-policy');

const DATA_DIR = path.join(__dirname, '..', 'data', 'x');
const QUEUE_PATH = process.env.X_AUTOPOSTER_QUEUE_PATH || path.join(DATA_DIR, 'autoposter-queue.json');
const OPS_LOG_PATH = path.join(DATA_DIR, 'autoposter-ops-log.json');
const OPS_LOG_MAX = 200;

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return `xp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function defaultDoc() {
  return { version: 2, updatedAt: nowIso(), items: [] };
}

function loadQueue() {
  try {
    const raw = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
    if (!Array.isArray(raw.items)) return defaultDoc();
    return { ...defaultDoc(), ...raw, items: raw.items };
  } catch {
    return defaultDoc();
  }
}

function saveQueue(doc) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  doc.version = 2;
  doc.updatedAt = nowIso();
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(doc, null, 2));
  return doc;
}

function normalizeItem(raw, { validate = true } = {}) {
  const text = String(raw.text || '').trim();
  const category = String(raw.category || 'news').toLowerCase();
  const action = String(raw.action || 'post').toLowerCase();
  const sources = (raw.sources || []).map(policy.normalizeSource).filter(Boolean);

  const scheduledAt = raw.scheduledAt ? new Date(raw.scheduledAt).toISOString() : nowIso();
  if (Number.isNaN(new Date(scheduledAt).getTime())) throw new Error('Invalid scheduledAt');

  const item = {
    id: raw.id || newId(),
    text,
    category,
    action,
    topic: raw.topic ? String(raw.topic).toLowerCase() : null,
    sources,
    inReplyToStatusId: raw.inReplyToStatusId ? String(raw.inReplyToStatusId) : null,
    quoteTweetUrl: raw.quoteTweetUrl ? String(raw.quoteTweetUrl).trim() : null,
    quoteTweetId: raw.quoteTweetId ? String(raw.quoteTweetId) : null,
    promoLink: raw.promoLink ? String(raw.promoLink).trim() : null,
    scheduledAt,
    status: raw.status || 'pending',
    mediaBase64: raw.mediaBase64 || null,
    mediaMime: raw.mediaMime || null,
    createdAt: raw.createdAt || nowIso(),
    sentAt: raw.sentAt || null,
    tweetId: raw.tweetId || null,
    tweetUrl: raw.tweetUrl || null,
    error: raw.error || null,
    validationErrors: raw.validationErrors || [],
    source: raw.source || 'manual',
    commitFingerprint: raw.commitFingerprint || null,
    intelFingerprint: raw.intelFingerprint || raw.commitFingerprint || null,
    sourceEventId: raw.sourceEventId || null,
    sourceIntelId: raw.sourceIntelId || null,
    intelType: raw.intelType || null,
    playerName: raw.playerName || null,
    playerSlug: raw.playerSlug ? String(raw.playerSlug).toLowerCase() : null,
    replyFingerprint: raw.replyFingerprint || null,
    postUrgency: raw.postUrgency || null,
    urgencyLabel: raw.urgencyLabel || null,
    sourceEventType: raw.sourceEventType || null,
    sourceEventCreatedAt: raw.sourceEventCreatedAt || null,
    sourcePublishedAt: raw.sourcePublishedAt || null,
    eventTimestamp: raw.eventTimestamp || null,
    templateBlocks: raw.templateBlocks || null,
    validationMeta: raw.validationMeta || null,
    playerContext: raw.playerContext || null,
    qualityScore: raw.qualityScore != null ? Number(raw.qualityScore) : null,
    qualityBreakdown: raw.qualityBreakdown || null,
    sourceConfidence: raw.sourceConfidence != null ? Number(raw.sourceConfidence) : null,
    triggerType: raw.triggerType || null,
    teamEventType: raw.teamEventType || null,
    programNewsType: raw.programNewsType || null,
    identityConfirmed: raw.identityConfirmed === true ? true : raw.identityConfirmed === false ? false : undefined,
    verifiedCommit: raw.verifiedCommit === true || raw.validationMeta?.verifiedCommit === true,
    monitoringFallback: raw.monitoringFallback === true,
    clusterFingerprint: raw.clusterFingerprint || null,
    clusterMeta: raw.clusterMeta || null
  };

  if (validate) {
    const check = policy.validatePostContent(item);
    if (!check.valid) {
      const err = new Error(check.errors.map((e) => e.message).join(' '));
      err.validation = check;
      throw err;
    }
  }

  return item;
}

function listQueue({ status = null, category = null, triggerType = null, limit = 100 } = {}) {
  const doc = loadQueue();
  let items = [...doc.items];
  if (status) items = items.filter((i) => i.status === status);
  if (category) items = items.filter((i) => i.category === category);
  if (triggerType) {
    const tt = String(triggerType).toLowerCase();
    items = items.filter(
      (i) =>
        String(i.triggerType || '').toLowerCase() === tt ||
        String(i.sourceEventType || '').toLowerCase() === tt ||
        String(i.intelType || '').toLowerCase() === tt
    );
  }
  items.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  return items.slice(0, limit);
}

function getDuePosts(limit = 10) {
  const now = Date.now();
  return listQueue({ status: 'pending' })
    .filter((i) => new Date(i.scheduledAt).getTime() <= now)
    .slice(0, limit);
}

function getMixStats(options) {
  const doc = loadQueue();
  const sent = policy.getSentPosts(doc.items, options);
  return policy.computeMixStats(sent);
}

function appendOpsLog(entry) {
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(OPS_LOG_PATH, 'utf8'));
  } catch {
    doc = { version: 1, entries: [] };
  }
  doc.entries = doc.entries || [];
  doc.entries.unshift({ ts: nowIso(), ...entry });
  doc.entries = doc.entries.slice(0, OPS_LOG_MAX);
  doc.updatedAt = nowIso();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OPS_LOG_PATH, JSON.stringify(doc, null, 2));
  return doc.entries[0];
}

function logQueueOp(action, item, extra = {}) {
  const row = {
    action,
    itemId: item?.id || null,
    intelFingerprint: item?.intelFingerprint || item?.commitFingerprint || null,
    sourceIntelId: item?.sourceIntelId || null,
    playerName: item?.playerName || null,
    status: item?.status || null,
    queueLength: loadQueue().items.length,
    ...extra
  };
  appendOpsLog(row);
  const tag = `[x-autoposter-queue] ${action}`;
  if (extra.error) console.warn(tag, row);
  else console.log(tag, {
    itemId: row.itemId,
    fingerprint: row.intelFingerprint,
    player: row.playerName,
    pending: loadQueue().items.filter((i) => i.status === 'pending').length,
    hubReview: loadQueue().items.filter((i) => i.status === 'hub_review').length
  });
}

function findByIntel(idOrFingerprint) {
  const key = String(idOrFingerprint || '');
  const doc = loadQueue();
  return (
    doc.items.find(
      (i) =>
        i.sourceIntelId === key ||
        i.intelFingerprint === key ||
        i.commitFingerprint === key
    ) || null
  );
}

function hasActiveQueueItemForIntel(idOrFingerprint) {
  const key = String(idOrFingerprint || '');
  const doc = loadQueue();
  return doc.items.some(
    (i) =>
      (i.sourceIntelId === key || i.intelFingerprint === key) &&
      ['pending', 'sent', 'hub_review'].includes(i.status)
  );
}

function enqueuePost(raw) {
  const doc = loadQueue();
  const item = normalizeItem(raw, { validate: true });
  doc.items.push(item);
  saveQueue(doc);
  logQueueOp('enqueue', item, { source: item.source || 'manual' });
  return { item, mix: getMixStats() };
}

function updatePost(id, patch) {
  const doc = loadQueue();
  const idx = doc.items.findIndex((i) => i.id === id);
  if (idx < 0) throw new Error('Queue item not found');
  doc.items[idx] = { ...doc.items[idx], ...patch };
  saveQueue(doc);
  logQueueOp('update', doc.items[idx], { patchKeys: Object.keys(patch || {}) });
  return doc.items[idx];
}

function cancelPost(id) {
  return updatePost(id, { status: 'cancelled' });
}

function promoteToAutoposter(id) {
  const item = updatePost(id, {
    status: 'pending',
    scheduledAt: nowIso(),
    promotedAt: nowIso(),
    postMethod: 'auto_queue'
  });
  logQueueOp('promote_autoposter', item, { from: 'hub_review' });
  return item;
}

function markManualPosted(id, { tweetUrl = null, tweetId = null } = {}) {
  const doc = loadQueue();
  const idx = doc.items.findIndex((i) => i.id === id);
  if (idx < 0) throw new Error('Queue item not found');
  const prev = doc.items[idx];
  const sentAt = nowIso();
  const item = {
    ...prev,
    status: 'sent',
    sentAt,
    tweetUrl: tweetUrl ? String(tweetUrl).trim() : prev.tweetUrl || null,
    tweetId: tweetId ? String(tweetId).trim() : prev.tweetId || null,
    postMethod: 'manual',
    source: prev.source && String(prev.source).includes('manual') ? prev.source : `${prev.source || 'hub'}:manual`
  };
  doc.items[idx] = item;
  saveQueue(doc);
  logQueueOp('manual_posted', item, { tweetUrl: item.tweetUrl });
  try {
    const ledger = require('./x-autoposter-sent-ledger');
    ledger.recordSentPost(item);
  } catch {
    /* optional */
  }
  if (item.sourceIntelId) {
    try {
      const intelStore = require('./recruiting-intel-store');
      intelStore.markIntelXPosted(item.sourceIntelId, {
        tweetId: item.tweetId,
        tweetUrl: item.tweetUrl
      });
    } catch {
      /* optional */
    }
  }
  return item;
}

function getQueueCounts() {
  const doc = loadQueue();
  const counts = { pending: 0, hub_review: 0, sent: 0, failed: 0, cancelled: 0, other: 0 };
  for (const item of doc.items) {
    const s = String(item.status || 'other');
    if (counts[s] != null) counts[s] += 1;
    else counts.other += 1;
  }
  counts.drafts = counts.pending + counts.hub_review;
  return counts;
}

const POST_STUDIO_DRAFT_STATUSES = ['hub_review', 'pending'];

const POST_STUDIO_MAX_DRAFT_AGE_MS = parseInt(
  process.env.POST_STUDIO_MAX_DRAFT_AGE_MS || String(72 * 60 * 60 * 1000),
  10
);
const POST_STUDIO_MAX_INTEL_AGE_MS = parseInt(
  process.env.POST_STUDIO_MAX_INTEL_AGE_MS || String(48 * 60 * 60 * 1000),
  10
);
const STALE_VISIT_TEMPLATE_RE =
  /\bfirst trip to (?:The Swamp|Gainesville)\b|\bMarch trip\b|\bput UF in (?:his|her) early mix\b|\bgave Florida a clean early look, and all three DB coaches\b|\bgave Florida early traction\b/i;
const THIN_RECRUITING_TEMPLATE_RE =
  /\bmaking .+ a priority early\b|\bmutual interest is real\b|\binterest is certainly mutual\b|\boffer carried extra weight\b|\bgatorvaultinsider\.com\/vault\/futurecast\b/i;
const COMPOSED_INTEL_DETAIL_RE = /^20\d{2}\s+[A-Z0-9][^\n]{0,80}·\s*\d+★/m;

function isThinRecruitingPostText(text = '') {
  return THIN_RECRUITING_TEMPLATE_RE.test(String(text || ''));
}

function isComposedIntelPollution(intel = {}) {
  const text = String(intel.detail || intel.skinny || intel.text || '').trim();
  if (!text) return false;
  if (COMPOSED_INTEL_DETAIL_RE.test(text)) return true;
  if (/gatorvaultinsider\.com\/vault\/futurecast/i.test(text)) return true;
  return false;
}

function draftIntelAgeMs(item = {}) {
  const ts = item.sourceEventCreatedAt || item.eventTimestamp || item.createdAt || item.scheduledAt;
  const t = new Date(ts || 0).getTime();
  if (!Number.isFinite(t) || t <= 0) return null;
  return Date.now() - t;
}

function isRecycledVisitTemplate(text = '', intelAgeMs = null) {
  if (!STALE_VISIT_TEMPLATE_RE.test(String(text || ''))) return false;
  const age = intelAgeMs == null ? POST_STUDIO_MAX_INTEL_AGE_MS + 1 : intelAgeMs;
  return age > POST_STUDIO_MAX_INTEL_AGE_MS;
}

function isStalePostStudioDraft(item = {}) {
  const text = String(item.text || '');
  const meta = item.validationMeta || {};
  const beatText = String(meta.beatText || '');
  const intelAgeMs = draftIntelAgeMs(item);
  const queueTs = new Date(item.createdAt || item.scheduledAt || 0).getTime();
  const queueAgeMs = Number.isFinite(queueTs) && queueTs > 0 ? Date.now() - queueTs : null;

  if (queueAgeMs != null && queueAgeMs > POST_STUDIO_MAX_DRAFT_AGE_MS) {
    return { stale: true, reason: 'draft_too_old' };
  }
  if (intelAgeMs != null && intelAgeMs > POST_STUDIO_MAX_INTEL_AGE_MS) {
    return { stale: true, reason: 'intel_too_old' };
  }

  const slug = String(item.playerSlug || '').trim().toLowerCase();
  if (slug && beatText) {
    try {
      const { detectBeatIdentityMismatch } = require('./autoposter/beat-identity-guard');
      const mismatch = detectBeatIdentityMismatch(slug, item.playerName, beatText, {
        fingerprint: item.intelFingerprint || null
      });
      if (mismatch.mismatch) {
        return { stale: true, reason: mismatch.reason || 'beat_identity_mismatch' };
      }
    } catch {
      /* optional */
    }
  }

  try {
    const { PR6_FALLBACK_RE } = require('./player-intelligence/golden-four-compose');
    const { THIN_FALLBACK_RE } = require('./autoposter/rewrite/compose-synonym-rotation');
    if (PR6_FALLBACK_RE.test(text) || THIN_FALLBACK_RE.test(text)) {
      return { stale: true, reason: 'thin_template' };
    }
  } catch {
    /* optional */
  }
  if (isThinRecruitingPostText(text)) {
    return { stale: true, reason: 'thin_recruiting_template' };
  }
  if (isRecycledVisitTemplate(text, intelAgeMs)) {
    return { stale: true, reason: 'recycled_visit_template' };
  }

  return { stale: false };
}

function dedupeDraftsBySlug(items = []) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const slug = String(item.playerSlug || '').trim().toLowerCase();
    if (!slug) {
      out.push(item);
      continue;
    }
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(item);
  }
  return out;
}

function filterVisiblePostStudioDrafts(items = []) {
  const sorted = [...items].sort(
    (a, b) => new Date(b.createdAt || b.scheduledAt) - new Date(a.createdAt || a.scheduledAt)
  );
  return dedupeDraftsBySlug(sorted).filter((item) => !isStalePostStudioDraft(item).stale);
}

function pruneStalePostStudioDrafts({ statuses = POST_STUDIO_DRAFT_STATUSES } = {}) {
  const doc = loadQueue();
  const pruned = [];
  const kept = [];

  for (const item of doc.items) {
    if (!statuses.includes(item.status)) {
      kept.push(item);
      continue;
    }
    const check = isStalePostStudioDraft(item);
    if (check.stale) {
      item.status = 'cancelled';
      item.error = `post_studio_prune:${check.reason}`;
      item.cancelledAt = nowIso();
      pruned.push({ id: item.id, playerSlug: item.playerSlug || null, reason: check.reason });
      kept.push(item);
      continue;
    }
    kept.push(item);
  }

  const visible = filterVisiblePostStudioDrafts(kept.filter((i) => statuses.includes(i.status)));
  const visibleSlugs = new Set(
    visible.map((i) => String(i.playerSlug || '').trim().toLowerCase()).filter(Boolean)
  );

  for (const item of kept) {
    if (!statuses.includes(item.status)) continue;
    const slug = String(item.playerSlug || '').trim().toLowerCase();
    if (!slug || visibleSlugs.has(slug)) continue;
    item.status = 'cancelled';
    item.error = 'post_studio_prune:duplicate_slug';
    item.cancelledAt = nowIso();
    pruned.push({ id: item.id, playerSlug: slug, reason: 'duplicate_slug' });
  }

  if (pruned.length) saveQueue({ ...doc, items: kept });
  return { pruned, prunedCount: pruned.length };
}

function listPostStudioDrafts({ limit = 50 } = {}) {
  const doc = loadQueue();
  const items = doc.items.filter((i) => POST_STUDIO_DRAFT_STATUSES.includes(i.status));
  return filterVisiblePostStudioDrafts(items).slice(0, limit);
}

/** Legacy pending items from pre-hub mode — surface them in Post Studio. */
function migratePendingToHubReview() {
  const pipelineGuards = require('./pipeline-guards');
  if (pipelineGuards.autoposterSchedulerEnabled()) return { migrated: 0 };
  const doc = loadQueue();
  let migrated = 0;
  for (const item of doc.items) {
    if (item.status !== 'pending') continue;
    item.status = 'hub_review';
    item.migratedAt = nowIso();
    migrated += 1;
  }
  if (migrated) saveQueue(doc);
  return { migrated };
}

function isRecoverableFailedItem(item, { maxAgeMs = 30 * 24 * 60 * 60 * 1000 } = {}) {
  if (!item || item.status !== 'failed') return false;
  const err = String(item.error || '');
  if (/duplicate content/i.test(err)) return false;
  const ts = new Date(item.createdAt || item.sourceEventCreatedAt || item.scheduledAt || 0).getTime();
  if (Number.isFinite(ts) && ts > 0 && Date.now() - ts > maxAgeMs) return false;
  if (item.verifiedCommit || item.validationMeta?.verifiedCommit) return true;
  if (isElitePremadeItem(item) && /rewrite_failed|too_short|rewrite failed/i.test(err) && String(item.text || '').trim()) {
    const sentLedger = require('./x-autoposter-sent-ledger');
    const dup = sentLedger.hasRecentSentPost({
      slug: item.playerSlug,
      intelFingerprint: item.intelFingerprint,
      text: item.text,
    });
    if (dup.hit) return false;
    return true;
  }
  const check = policy.validatePostContent(item);
  if (check.valid) return true;
  if (/rewrite_failed|too_short|rewrite failed/i.test(err)) {
    return policy.validatePostContent(item).valid;
  }
  return false;
}

function isElitePremadeItem(item = {}) {
  const meta = item.validationMeta || {};
  return !!(meta.eliteCompose || meta.eliteDigest || String(item.source || '').includes('beat-intel'));
}

function rependFailedItem(item) {
  const prevError = String(item.error || '');
  item.status = 'pending';
  item.error = null;
  item.validationErrors = [];
  item.sentAt = null;
  item.scheduledAt = nowIso();
  if (isElitePremadeItem(item) && /rewrite_failed|too_short/i.test(prevError)) {
    const now = nowIso();
    item.sourceEventCreatedAt = now;
    item.sourcePublishedAt = now;
    item.postUrgency = item.postUrgency || 'normal';
  }
}

/** Re-queue verified commits that failed GM2 rewrite — premade On3 copy is post-ready. */
function recoverFailedVerifiedCommits() {
  const doc = loadQueue();
  let recovered = 0;
  let skippedDuplicate = 0;
  const sentLedger = require('./x-autoposter-sent-ledger');
  for (const item of doc.items) {
    if (item.status !== 'failed') continue;
    if (!(item.verifiedCommit || item.validationMeta?.verifiedCommit)) continue;
    if (/duplicate content/i.test(String(item.error || ''))) continue;
    const dup = sentLedger.hasRecentSentPost({
      slug: item.playerSlug,
      intelFingerprint: item.intelFingerprint,
      text: item.text
    });
    if (dup.hit) {
      item.status = 'skipped_duplicate';
      item.error = dup.reason || 'duplicate';
      item.sentAt = nowIso();
      skippedDuplicate += 1;
      continue;
    }
    rependFailedItem(item);
    recovered += 1;
  }
  if (recovered || skippedDuplicate) {
    saveQueue(doc);
    logQueueOp('recover_verified', { id: 'batch', count: recovered }, { recovered, skippedDuplicate });
  }
  return recovered;
}

/** Re-queue any recent failed item that still passes validation (force-post safety net). */
function recoverFailedPostableItems(opts = {}) {
  const doc = loadQueue();
  let recovered = 0;
  let skippedDuplicate = 0;
  const sentLedger = require('./x-autoposter-sent-ledger');
  for (const item of doc.items) {
    if (item.status !== 'failed') continue;
    if (isElitePremadeItem(item) && /rewrite_failed|too_short|rewrite failed/i.test(String(item.error || ''))) {
      const dup = sentLedger.hasRecentSentPost({
        slug: item.playerSlug,
        intelFingerprint: item.intelFingerprint,
        text: item.text,
      });
      if (dup.hit) {
        item.status = 'skipped_duplicate';
        item.error = dup.reason || 'duplicate';
        item.sentAt = nowIso();
        skippedDuplicate += 1;
        continue;
      }
    }
    if (!isRecoverableFailedItem(item, opts)) continue;
    rependFailedItem(item);
    recovered += 1;
  }
  if (recovered || skippedDuplicate) {
    saveQueue(doc);
    if (recovered) {
      logQueueOp('recover_postable', { id: 'batch', count: recovered }, { recovered });
    }
    if (skippedDuplicate) {
      logQueueOp('skip_duplicate', { id: 'batch', count: skippedDuplicate }, { skippedDuplicate });
    }
  }
  return recovered;
}

module.exports = {
  QUEUE_PATH,
  OPS_LOG_PATH,
  loadQueue,
  saveQueue,
  normalizeItem,
  listQueue,
  getDuePosts,
  getMixStats,
  enqueuePost,
  updatePost,
  cancelPost,
  promoteToAutoposter,
  markManualPosted,
  getQueueCounts,
  listPostStudioDrafts,
  pruneStalePostStudioDrafts,
  isStalePostStudioDraft,
  isRecycledVisitTemplate,
  isThinRecruitingPostText,
  isComposedIntelPollution,
  POST_STUDIO_MAX_INTEL_AGE_MS,
  migratePendingToHubReview,
  POST_STUDIO_DRAFT_STATUSES,
  recoverFailedVerifiedCommits,
  recoverFailedPostableItems,
  isRecoverableFailedItem,
  appendOpsLog,
  logQueueOp,
  findByIntel,
  hasActiveQueueItemForIntel,
  nowIso
};
