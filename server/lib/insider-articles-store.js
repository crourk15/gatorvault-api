/**
 * Insider Articles — JSON storage (drafts, published, logs).
 */
const fs = require('fs');
const path = require('path');
const { sortArticlesByPublishedAtDesc } = require('./article-sort');

const DATA_DIR = path.join(__dirname, '..', 'data', 'articles');
const DRAFTS_PATH = path.join(DATA_DIR, 'drafts.json');
const PUBLISHED_PATH = path.join(DATA_DIR, 'published.json');
const LOGS_PATH = path.join(DATA_DIR, 'logs.json');

const CATEGORIES = {
  program_pulse: {
    label: 'Program Pulse',
    byline: 'GatorVault Staff',
    badge: 'PROGRAM PULSE'
  },
  heat_check: {
    label: 'Heat Check',
    byline: 'Recruiting Desk',
    badge: 'HEAT CHECK'
  },
  official_visit_preview: {
    label: 'Official Visit Preview',
    byline: 'Recruiting Desk',
    badge: 'OV PREVIEW'
  },
  post_visit_reaction: {
    label: 'Post-Visit Reaction',
    byline: 'Recruiting Desk',
    badge: 'POST-VISIT'
  },
  staff_intel: {
    label: 'Staff Intel',
    byline: 'GatorVault Staff',
    badge: 'STAFF INTEL'
  },
  summer_preview: {
    label: 'Summer Preview / Camp Battles',
    byline: 'GatorVault Staff',
    badge: 'SUMMER PREVIEW'
  },
  depth_chart_movement: {
    label: 'Depth Chart Movement',
    byline: 'Film Desk',
    badge: 'DEPTH CHART'
  },
  insider: {
    label: 'Insider',
    byline: 'GatorVault Staff',
    badge: 'INSIDER'
  },
  game_week_preview: {
    label: 'Game Week Opponent Preview',
    byline: 'Analytics',
    badge: 'GAME PREVIEW'
  },
  roster_analysis: {
    label: 'Roster Analysis',
    byline: 'Film Desk',
    badge: 'ROSTER ANALYSIS'
  }
};

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return data;
}

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix = 'insider') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeArticle(raw) {
  const category = raw.category || 'insider';
  const meta = CATEGORIES[category] || CATEGORIES.program_pulse;
  return {
    id: raw.id || newId(),
    title: raw.title || 'Untitled',
    slug: raw.slug || null,
    category,
    categoryLabel: meta.label,
    articleType: raw.articleType || null,
    byline: raw.byline || meta.byline,
    status: raw.status || 'draft',
    summary: raw.summary || '',
    thesis: raw.thesis || '',
    body: raw.body || '',
    insiderAngles: Array.isArray(raw.insiderAngles) ? raw.insiderAngles : [],
    readTimeMinutes: raw.readTimeMinutes || raw.readMin || 5,
    sources: Array.isArray(raw.sources) ? raw.sources : [],
    topicKey: raw.topicKey || null,
    angleKey: raw.angleKey || null,
    qualityReasons: Array.isArray(raw.qualityReasons) ? raw.qualityReasons : [],
    triggerIntelFingerprints: Array.isArray(raw.triggerIntelFingerprints) ? raw.triggerIntelFingerprints : [],
    triggerIdentityLog: Array.isArray(raw.triggerIdentityLog) ? raw.triggerIdentityLog : [],
    createdAt: raw.createdAt || nowIso(),
    publishedAt: raw.publishedAt || null,
    lastRefreshedAt: raw.lastRefreshedAt || null,
    archivedAt: raw.archivedAt || null,
    rejectedAt: raw.rejectedAt || null,
    rejectReason: raw.rejectReason || null,
    generationSource: raw.generationSource || null,
    rosterUnits: Array.isArray(raw.rosterUnits) ? raw.rosterUnits : [],
    recruitingTargets: Array.isArray(raw.recruitingTargets) ? raw.recruitingTargets : [],
    schemeTags: Array.isArray(raw.schemeTags) ? raw.schemeTags : [],
    analyticsTags: Array.isArray(raw.analyticsTags) ? raw.analyticsTags : [],
    scaffoldBody: raw.scaffoldBody || null,
    editorialHeaders: raw.editorialHeaders || null,
    battles: Array.isArray(raw.battles) ? raw.battles : [],
  };
}

function loadDraftsDoc() {
  return readJson(DRAFTS_PATH, { version: 1, items: [] });
}

function loadPublishedDoc() {
  return readJson(PUBLISHED_PATH, { version: 1, items: [] });
}

function saveDraftsDoc(doc) {
  writeJson(DRAFTS_PATH, doc);
}

function savePublishedDoc(doc) {
  writeJson(PUBLISHED_PATH, doc);
}

function logEvent(action, details = {}) {
  const doc = readJson(LOGS_PATH, { version: 1, events: [] });
  doc.events.unshift({
    id: newId('log'),
    action,
    at: nowIso(),
    ...details
  });
  doc.events = doc.events.slice(0, 500);
  writeJson(LOGS_PATH, doc);
}

function listDrafts({ status = 'draft' } = {}) {
  const doc = loadDraftsDoc();
  let items = doc.items || [];
  if (status) items = items.filter((a) => a.status === status);
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function listPublished() {
  const doc = loadPublishedDoc();
  return sortArticlesByPublishedAtDesc(
    (doc.items || []).filter((a) => a.status === 'published')
  );
}

function countDraftsPending() {
  return listDrafts({ status: 'draft' }).length;
}

function countPublished() {
  return listPublished().length;
}

function draftsCreatedSince(sinceMs) {
  const since = Date.now() - sinceMs;
  return listDrafts({ status: null }).filter((a) => {
    if (a.status === 'archived') return false;
    return new Date(a.createdAt).getTime() >= since;
  });
}

function getArticleById(id) {
  const published = listPublished().find((a) => a.id === id);
  if (published) return published;
  const draft = (loadDraftsDoc().items || []).find((a) => a.id === id);
  return draft || null;
}

function addDraft(article) {
  const doc = loadDraftsDoc();
  const entry = normalizeArticle({ ...article, status: 'draft', publishedAt: null });
  const existingIdx = doc.items.findIndex((a) => a.topicKey && a.topicKey === entry.topicKey && a.status === 'draft');
  if (existingIdx >= 0) {
    doc.items[existingIdx] = { ...doc.items[existingIdx], ...entry, id: doc.items[existingIdx].id, createdAt: doc.items[existingIdx].createdAt };
  } else {
    doc.items.unshift(entry);
  }
  saveDraftsDoc(doc);
  logEvent('draft_created', { articleId: entry.id, title: entry.title, category: entry.category });
  return entry;
}

function approveDraft(id) {
  const doc = loadDraftsDoc();
  const idx = doc.items.findIndex((a) => a.id === id);
  if (idx < 0) throw new Error('Draft not found');
  const draft = doc.items[idx];
  if (draft.status !== 'draft') throw new Error('Article is not a pending draft');

  const templates = require('./insider-articles-templates');
  const quality = templates.validateDraftQuality(draft);
  if (!quality.ok) {
    throw new Error(`Draft failed quality gate: ${quality.reasons.join(', ')}`);
  }

  const published = normalizeArticle({
    ...draft,
    status: 'published',
    publishedAt: nowIso()
  });

  doc.items.splice(idx, 1);
  saveDraftsDoc(doc);

  const pubDoc = loadPublishedDoc();
  pubDoc.items = pubDoc.items || [];
  const pubIdx = pubDoc.items.findIndex((a) => a.id === id);
  if (pubIdx >= 0) pubDoc.items[pubIdx] = published;
  else pubDoc.items.unshift(published);
  savePublishedDoc(pubDoc);

  publishToContentFeed(published);

  logEvent('draft_approved', { articleId: id, title: published.title });
  return published;
}

function rejectDraft(id, { reason = 'manual', auto = false } = {}) {
  const doc = loadDraftsDoc();
  const item = doc.items.find((a) => a.id === id);
  if (!item) throw new Error('Draft not found');
  item.status = auto ? 'auto-rejected' : 'archived';
  item.archivedAt = nowIso();
  item.rejectedAt = nowIso();
  item.rejectReason = reason;
  saveDraftsDoc(doc);
  logEvent(auto ? 'draft_auto_rejected_manual' : 'draft_rejected', {
    articleId: id,
    title: item.title,
    reason,
    angleKey: item.angleKey,
    topicKey: item.topicKey,
  });
  return item;
}

function listUsedAnglesForTopic(topicKey) {
  if (!topicKey) return [];
  const items = listDrafts({ status: null });
  return items
    .filter((a) => a.topicKey === topicKey && a.angleKey)
    .map((a) => a.angleKey);
}

function calcReadTime(body) {
  const words = String(body || '')
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(3, Math.min(12, Math.ceil(words / 200)));
}

function updateDraft(id, patch = {}) {
  const doc = loadDraftsDoc();
  const idx = doc.items.findIndex((a) => a.id === id);
  if (idx < 0) throw new Error('Draft not found');
  const item = doc.items[idx];
  if (item.status !== 'draft') throw new Error('Article is not a pending draft');

  const body = patch.body != null ? patch.body : item.body;
  const readTimeMinutes =
    patch.readTimeMinutes != null
      ? patch.readTimeMinutes
      : patch.readTime != null
        ? patch.readTime
        : calcReadTime(body);

  doc.items[idx] = normalizeArticle({
    ...item,
    ...patch,
    id: item.id,
    status: 'draft',
    createdAt: item.createdAt,
    publishedAt: null,
    title: patch.title != null ? patch.title : item.title,
    summary: patch.summary != null ? patch.summary : patch.subheadline != null ? patch.subheadline : item.summary,
    body,
    readTimeMinutes,
    category: patch.category != null ? patch.category : item.category
  });
  saveDraftsDoc(doc);
  logEvent('draft_updated', { articleId: id, title: doc.items[idx].title });
  return doc.items[idx];
}

function refreshPublished(id, patch) {
  const pubDoc = loadPublishedDoc();
  const idx = pubDoc.items.findIndex((a) => a.id === id);
  if (idx < 0) throw new Error('Published article not found');
  pubDoc.items[idx] = normalizeArticle({
    ...pubDoc.items[idx],
    ...patch,
    status: 'published',
    lastRefreshedAt: nowIso()
  });
  savePublishedDoc(pubDoc);
  publishToContentFeed(pubDoc.items[idx]);
  logEvent('article_refreshed', { articleId: id, title: pubDoc.items[idx].title });
  return pubDoc.items[idx];
}

function retirePublished(id) {
  const pubDoc = loadPublishedDoc();
  const idx = pubDoc.items.findIndex((a) => a.id === id);
  if (idx < 0) throw new Error('Published article not found');
  const item = normalizeArticle({
    ...pubDoc.items[idx],
    status: 'archived',
    archivedAt: nowIso()
  });
  pubDoc.items.splice(idx, 1);
  savePublishedDoc(pubDoc);

  removeFromContentFeed(item);

  const draftDoc = loadDraftsDoc();
  draftDoc.items.unshift(item);
  saveDraftsDoc(draftDoc);

  logEvent('article_retired', { articleId: id, title: item.title });
  return item;
}

function toPublicArticle(article) {
  const meta = CATEGORIES[article.category] || CATEGORIES.program_pulse;
  const date = article.publishedAt || article.createdAt;
  return {
    id: article.id,
    title: article.title,
    slug: article.slug || null,
    topicKey: article.topicKey || null,
    tier: 'insider',
    badge: article.articleType || meta.badge,
    badgeClass: 'bg-gator-orange/20 text-gator-orange',
    author: article.byline || meta.byline,
    date: date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
    readMin: article.readTimeMinutes,
    excerpt: article.summary,
    body: article.body,
    takeaways: (article.insiderAngles || []).slice(0, 6),
    sources: (article.sources || []).map((s) => ({
      reporter: s.name || s.reporter,
      outlet: s.outlet,
      url: s.url || null
    })),
    category: article.category,
    categoryLabel: meta.label,
    articleType: article.articleType || null,
    publishedAt: article.publishedAt,
    createdAt: article.createdAt,
    insiderEngine: true,
    angleKey: article.angleKey || null,
    rosterUnits: article.rosterUnits || [],
    recruitingTargets: article.recruitingTargets || [],
    schemeTags: article.schemeTags || [],
    analyticsTags: article.analyticsTags || [],
    generationSource: article.generationSource || null,
  };
}

function publishToContentFeed(published) {
  try {
    const { loadPublishedArticles, savePublishedArticles } = require('./content-store');
    const row = toPublicArticle(published);
    const articles = loadPublishedArticles();
    const idx = articles.findIndex(
      (a) => a.id === row.id || (row.topicKey && a.topicKey === row.topicKey)
    );
    if (idx >= 0) {
      row.createdAt = articles[idx].createdAt || row.createdAt || published.createdAt;
      articles[idx] = { ...articles[idx], ...row };
    } else {
      articles.unshift(row);
    }
    savePublishedArticles(articles);
    logEvent('content_feed_synced', { articleId: published.id, title: published.title, topicKey: row.topicKey });
    return row;
  } catch (err) {
    console.warn('[insider-articles] content-store sync failed:', err.message);
    logEvent('content_feed_sync_failed', { articleId: published.id, error: err.message });
    return null;
  }
}

function removeFromContentFeed(published) {
  try {
    const { loadPublishedArticles, savePublishedArticles } = require('./content-store');
    const articles = loadPublishedArticles().filter(
      (a) => a.id !== published.id && !(published.topicKey && a.topicKey === published.topicKey)
    );
    savePublishedArticles(articles);
    logEvent('content_feed_removed', { articleId: published.id, topicKey: published.topicKey });
  } catch (err) {
    console.warn('[insider-articles] content-store remove failed:', err.message);
  }
}

function listBlockedTopicKeys() {
  const blocked = new Set(['draft', 'published', 'archived', 'auto-rejected']);
  return listDrafts({ status: null })
    .filter((a) => blocked.has(a.status))
    .map((a) => a.topicKey)
    .filter(Boolean);
}

module.exports = {
  DATA_DIR,
  DRAFTS_PATH,
  PUBLISHED_PATH,
  LOGS_PATH,
  CATEGORIES,
  listDrafts,
  listPublished,
  countDraftsPending,
  countPublished,
  draftsCreatedSince,
  getArticleById,
  addDraft,
  approveDraft,
  rejectDraft,
  listUsedAnglesForTopic,
  updateDraft,
  refreshPublished,
  retirePublished,
  toPublicArticle,
  publishToContentFeed,
  removeFromContentFeed,
  logEvent,
  normalizeArticle,
  listBlockedTopicKeys
};
