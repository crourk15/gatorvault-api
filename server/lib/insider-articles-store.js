/**
 * Insider Articles — JSON storage (drafts, published, logs).
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'articles');
const DRAFTS_PATH = path.join(DATA_DIR, 'drafts.json');
const PUBLISHED_PATH = path.join(DATA_DIR, 'published.json');
const LOGS_PATH = path.join(DATA_DIR, 'logs.json');

const CATEGORIES = {
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
  const meta = CATEGORIES[category] || CATEGORIES.insider;
  return {
    id: raw.id || newId(),
    title: raw.title || 'Untitled',
    category,
    categoryLabel: meta.label,
    byline: raw.byline || meta.byline,
    status: raw.status || 'draft',
    summary: raw.summary || '',
    body: raw.body || '',
    readTimeMinutes: raw.readTimeMinutes || raw.readMin || 5,
    sources: Array.isArray(raw.sources) ? raw.sources : [],
    topicKey: raw.topicKey || null,
    createdAt: raw.createdAt || nowIso(),
    publishedAt: raw.publishedAt || null,
    lastRefreshedAt: raw.lastRefreshedAt || null,
    archivedAt: raw.archivedAt || null
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
  return (doc.items || [])
    .filter((a) => a.status === 'published')
    .sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt));
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

  logEvent('draft_approved', { articleId: id, title: published.title });
  return published;
}

function rejectDraft(id) {
  const doc = loadDraftsDoc();
  const item = doc.items.find((a) => a.id === id);
  if (!item) throw new Error('Draft not found');
  item.status = 'archived';
  item.archivedAt = nowIso();
  saveDraftsDoc(doc);
  logEvent('draft_rejected', { articleId: id, title: item.title });
  return item;
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

  const draftDoc = loadDraftsDoc();
  draftDoc.items.unshift(item);
  saveDraftsDoc(draftDoc);

  logEvent('article_retired', { articleId: id, title: item.title });
  return item;
}

function toPublicArticle(article) {
  const meta = CATEGORIES[article.category] || CATEGORIES.insider;
  const date = article.publishedAt || article.createdAt;
  return {
    id: article.id,
    title: article.title,
    tier: 'insider',
    badge: meta.badge,
    badgeClass: 'bg-gator-orange/20 text-gator-orange',
    author: article.byline || meta.byline,
    date: date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
    readMin: article.readTimeMinutes,
    excerpt: article.summary,
    body: article.body,
    takeaways: [],
    sources: (article.sources || []).map((s) => ({
      reporter: s.name || s.reporter,
      outlet: s.outlet,
      url: s.url || null
    })),
    category: article.category,
    categoryLabel: meta.label,
    publishedAt: article.publishedAt,
    insiderEngine: true
  };
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
  refreshPublished,
  retirePublished,
  toPublicArticle,
  logEvent,
  normalizeArticle
};
