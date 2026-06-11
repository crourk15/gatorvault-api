const fs = require('fs');
const path = require('path');
const { validateContentItem, resolveContentItem, logValidationFailure } = require('./content-validator');
const { sortArticlesByPublishedAtDesc } = require('./article-sort');

const CONTENT_DIR = path.join(__dirname, '..', 'data', 'content');
const ARTICLES_PATH = path.join(CONTENT_DIR, 'articles.json');
const STORYLINES_PATH = path.join(CONTENT_DIR, 'storylines.json');
const QUEUE_PATH = path.join(CONTENT_DIR, 'queue.json');

const STATUSES = ['draft', 'review', 'published', 'rejected'];

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function seedFromIndexHtml() {
  const indexPath = path.join(__dirname, '..', 'index.html');
  try {
    const html = fs.readFileSync(indexPath, 'utf8');
    const articlesMatch = html.match(/var articles=(\[[\s\S]*?\]);\s*var apparelShops/);
    const storyMatch = html.match(/var storylines=(\[[\s\S]*?\]);\s*var articles=/);
    if (articlesMatch) {
      const articles = Function(`"use strict"; return (${articlesMatch[1]});`)();
      writeJson(ARTICLES_PATH, articles);
    }
    if (storyMatch) {
      const storylines = Function(`"use strict"; return (${storyMatch[1]});`)();
      const withIds = storylines.map((s, i) => ({
        id: s.id || `stl_${i + 1}`,
        ...s
      }));
      writeJson(STORYLINES_PATH, withIds);
    }
  } catch (e) {
    console.warn('[content-store] seed from index.html failed:', e.message);
  }
}

function ensurePublishedSeed() {
  const articles = readJson(ARTICLES_PATH, null);
  const storylines = readJson(STORYLINES_PATH, null);
  if (!articles || !articles.length || !storylines || !storylines.length) {
    seedFromIndexHtml();
  }
}

function auditPublishedArticles() {
  const articles = readJson(ARTICLES_PATH, []);
  const missing = articles.filter((a) => !Array.isArray(a.sources) || !a.sources.length);
  if (missing.length) {
    console.warn(
      '[content-store] published articles missing sources:',
      missing.map((a) => a.id).join(', ')
    );
  }
  return { total: articles.length, missingSources: missing.length, ids: missing.map((a) => a.id) };
}

function loadPublishedArticles() {
  ensurePublishedSeed();
  return readJson(ARTICLES_PATH, []);
}

function loadPublishedStorylines() {
  ensurePublishedSeed();
  return readJson(STORYLINES_PATH, []);
}

function savePublishedArticles(articles) {
  writeJson(ARTICLES_PATH, articles);
}

function savePublishedStorylines(storylines) {
  writeJson(STORYLINES_PATH, storylines);
}

function loadQueue() {
  return readJson(QUEUE_PATH, []);
}

function saveQueue(queue) {
  writeJson(QUEUE_PATH, queue);
}

function getArticleById(id) {
  const articles = loadPublishedArticles();
  const raw = articles.find((a) => a.id === id);
  if (!raw) return null;
  return {
    ...resolveContentItem(raw),
    id: raw.id,
    source: 'published',
    sources: raw.sources || [],
    sourcePolicy: 'gatorvault_original'
  };
}

function getPublishedFeed() {
  const articles = sortArticlesByPublishedAtDesc(
    loadPublishedArticles().map((a) => ({
      ...resolveContentItem(a),
      id: a.id,
      source: 'published',
      sources: a.sources || [],
      sourcePolicy: 'gatorvault_original',
      publishedAt: a.publishedAt || null,
      createdAt: a.createdAt || null
    }))
  );
  const storylines = loadPublishedStorylines().map((s) => ({
    ...resolveContentItem(s),
    id: s.id,
    source: 'published'
  }));
  return { articles, storylines };
}

function normalizeQueueItem(raw) {
  return {
    id: raw.id || newId(raw.type || 'item'),
    type: raw.type || 'article',
    status: raw.status || 'draft',
    title: raw.title || '',
    tier: raw.tier || 'locker',
    badge: raw.badge || '',
    badgeClass: raw.badgeClass || '',
    author: raw.author || 'GatorVault Staff',
    date: raw.date || '',
    readMin: raw.readMin || null,
    excerpt: raw.excerpt || '',
    body: raw.body || '',
    takeaways: raw.takeaways || [],
    sources: raw.sources || raw.sourceUrls || raw.citations || [],
    statusClass: raw.statusClass || '',
    storylineStatus: raw.storylineStatus || raw.statusLabel || '',
    createdAt: raw.createdAt || nowIso(),
    updatedAt: raw.updatedAt || nowIso(),
    submittedAt: raw.submittedAt || null,
    publishedAt: raw.publishedAt || null,
    validationErrors: raw.validationErrors || [],
    reviewNotes: raw.reviewNotes || ''
  };
}

function upsertDraft(item) {
  const queue = loadQueue();
  const normalized = normalizeQueueItem({ ...item, status: 'draft' });
  const idx = queue.findIndex((q) => q.id === normalized.id);
  normalized.updatedAt = nowIso();
  if (idx >= 0) queue[idx] = { ...queue[idx], ...normalized };
  else queue.unshift(normalized);
  saveQueue(queue);
  return normalized;
}

function validateQueueItem(id) {
  const queue = loadQueue();
  const item = queue.find((q) => q.id === id);
  if (!item) return { ok: false, error: 'Item not found' };
  const result = validateContentItem(item);
  item.validationErrors = result.errors;
  item.updatedAt = nowIso();
  saveQueue(queue);
  if (!result.valid) {
    logValidationFailure({
      action: 'validate',
      itemId: id,
      type: item.type,
      title: item.title,
      errors: result.errors,
      message: result.errors.map((e) => e.message).join('; ')
    });
  }
  return { ok: true, valid: result.valid, errors: result.errors, resolved: result.resolved };
}

function submitForReview(id) {
  const check = validateQueueItem(id);
  if (!check.ok) return check;
  if (!check.valid) {
    return { ok: false, blocked: true, errors: check.errors, message: 'Validation failed — fix errors before submitting for review.' };
  }
  const queue = loadQueue();
  const item = queue.find((q) => q.id === id);
  item.status = 'review';
  item.submittedAt = nowIso();
  item.updatedAt = nowIso();
  saveQueue(queue);
  return { ok: true, item };
}

function publishItem(id) {
  const queue = loadQueue();
  const item = queue.find((q) => q.id === id);
  if (!item) return { ok: false, error: 'Item not found' };
  if (item.status !== 'review') {
    return { ok: false, error: 'Item must be in review status to publish' };
  }
  const result = validateContentItem(item);
  if (!result.valid) {
    logValidationFailure({
      action: 'publish_blocked',
      itemId: id,
      type: item.type,
      title: item.title,
      errors: result.errors,
      message: result.errors.map((e) => e.message).join('; ')
    });
    item.validationErrors = result.errors;
    saveQueue(queue);
    return { ok: false, blocked: true, errors: result.errors, message: 'Publish blocked — validation failed.' };
  }

  const pubAt = nowIso();
  const published = { ...item, publishedAt: pubAt, updatedAt: pubAt };
  delete published.validationErrors;
  delete published.reviewNotes;
  delete published.submittedAt;

  if (item.type === 'storyline') {
    const storylines = loadPublishedStorylines();
    const idx = storylines.findIndex((s) => s.id === item.id);
    const row = {
      id: item.id,
      title: item.title,
      status: item.storylineStatus || item.statusLabel || 'WATCH',
      statusClass: item.statusClass,
      body: item.body
    };
    if (idx >= 0) storylines[idx] = row;
    else storylines.unshift(row);
    savePublishedStorylines(storylines);
  } else {
    const articles = loadPublishedArticles();
    const idx = articles.findIndex((a) => a.id === item.id);
    const row = {
      id: item.id,
      title: item.title,
      tier: item.tier,
      badge: item.badge,
      badgeClass: item.badgeClass,
      author: item.author,
      date: item.date,
      readMin: item.readMin,
      excerpt: item.excerpt,
      body: item.body,
      takeaways: item.takeaways || [],
      sources: item.sources || item.sourceUrls || item.citations || [],
      publishedAt: pubAt,
      createdAt: item.createdAt || pubAt
    };
    if (idx >= 0) {
      row.createdAt = articles[idx].createdAt || row.createdAt;
      articles[idx] = row;
    } else articles.unshift(row);
    savePublishedArticles(articles);
  }

  item.status = 'published';
  item.publishedAt = nowIso();
  saveQueue(queue);
  return { ok: true, item: published };
}

function rejectItem(id, notes) {
  const queue = loadQueue();
  const item = queue.find((q) => q.id === id);
  if (!item) return { ok: false, error: 'Item not found' };
  item.status = 'draft';
  item.reviewNotes = notes || '';
  item.updatedAt = nowIso();
  saveQueue(queue);
  return { ok: true, item };
}

function getQueue(filterStatus) {
  const queue = loadQueue();
  const filtered = filterStatus ? queue.filter((q) => q.status === filterStatus) : queue;
  return filtered.sort(
    (a, b) =>
      new Date(b.updatedAt || b.publishedAt || b.createdAt || 0) -
      new Date(a.updatedAt || a.publishedAt || a.createdAt || 0)
  );
}

module.exports = {
  CONTENT_DIR,
  STATUSES,
  ensurePublishedSeed,
  auditPublishedArticles,
  seedFromIndexHtml,
  loadPublishedArticles,
  loadPublishedStorylines,
  getPublishedFeed,
  getArticleById,
  upsertDraft,
  validateQueueItem,
  submitForReview,
  publishItem,
  rejectItem,
  getQueue
};
