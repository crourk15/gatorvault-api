'use strict';

/**
 * Extract highlight / Hudl video links from On3 rivals pageProps.videos.
 * On3 stores sourceUrl like "www.hudl.com/embed/video/..." (no scheme).
 */

function ensureHttpsUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^\/\//.test(s)) return `https:${s}`;
  if (/^(www\.|hudl\.com|ve\.hudl\.com|youtube\.com|youtu\.be|vimeo\.com)/i.test(s)) {
    return `https://${s.replace(/^\/+/, '')}`;
  }
  return null;
}

function detectVideoType(url) {
  const u = String(url || '').toLowerCase();
  if (/hudl\.com/.test(u)) return 'hudl';
  if (/youtube\.com|youtu\.be/.test(u)) return 'youtube';
  if (/vimeo\.com/.test(u)) return 'vimeo';
  if (/on3\.com/.test(u)) return 'on3';
  return 'video';
}

function extractOn3Videos(pageProps) {
  const list = pageProps?.videos?.list;
  if (!Array.isArray(list) || !list.length) return [];

  const out = [];
  const seen = new Set();
  for (const row of list) {
    const url = ensureHttpsUrl(row?.sourceUrl || row?.url || row?.embedUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const cat = row?.category?.value || row?.category || null;
    const title = String(row?.title || row?.description || cat || 'Highlight').trim();
    const dateSec = Number(row?.date);
    out.push({
      key: row?.key != null ? Number(row.key) : null,
      type: detectVideoType(url),
      url,
      label: title.slice(0, 120),
      category: cat ? String(cat) : null,
      thumbnail: row?.thumbnail ? ensureHttpsUrl(row.thumbnail) || String(row.thumbnail) : null,
      isFeatured: !!row?.isFeatured,
      publishedAt:
        Number.isFinite(dateSec) && dateSec > 0
          ? new Date(dateSec * 1000).toISOString()
          : null,
    });
  }

  // Featured first, then newest
  out.sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    return String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''));
  });
  return out;
}

function filmSourcesFromOn3Videos(videos, { reviewedBy = 'on3-ingest' } = {}) {
  const now = new Date().toISOString().slice(0, 10);
  return (videos || []).slice(0, 8).map((v) => ({
    type: v.type || detectVideoType(v.url),
    url: v.url,
    label: v.label || 'On3 highlight',
    category: v.category || null,
    thumbnail: v.thumbnail || null,
    on3VideoKey: v.key || null,
    publishedAt: v.publishedAt || null,
    ingestedAt: now,
    reviewedAt: null,
    reviewedBy: reviewedBy,
  }));
}

module.exports = {
  ensureHttpsUrl,
  detectVideoType,
  extractOn3Videos,
  filmSourcesFromOn3Videos,
};
