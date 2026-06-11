/**
 * Article ordering — publishedAt DESC, fallback createdAt DESC (then human date string).
 * No implicit pinning; pass respectPin only when pinned/sticky is explicitly configured.
 */

function parseMs(value) {
  if (value == null || value === '') return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function articlePublishedAtMs(article) {
  return parseMs(article?.publishedAt);
}

function articleCreatedAtMs(article) {
  return parseMs(article?.createdAt) ?? parseMs(article?.date);
}

function articleSortMs(article) {
  return articlePublishedAtMs(article) ?? articleCreatedAtMs(article) ?? 0;
}

function sortArticlesByPublishedAtDesc(articles, { respectPin = false } = {}) {
  return [...(articles || [])].sort((a, b) => {
    if (respectPin) {
      const ap = a?.pinned || a?.sticky ? 1 : 0;
      const bp = b?.pinned || b?.sticky ? 1 : 0;
      if (ap !== bp) return bp - ap;
    }
    return articleSortMs(b) - articleSortMs(a);
  });
}

module.exports = {
  articleSortMs,
  articlePublishedAtMs,
  articleCreatedAtMs,
  sortArticlesByPublishedAtDesc
};
