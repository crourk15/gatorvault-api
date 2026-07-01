/** Parse internal scaffold sections from draft HTML. */
const INTERNAL_SECTION_LABELS = {
  thesis: [/^thesis$/i],
  insiderAngles: [/^insider angles?$/i],
  scheme: [/^scheme implications?$/i],
  roster: [/^roster impact$/i],
  recruiting: [/^recruiting and portal impact$/i, /^recruiting & portal impact$/i],
  analytics: [/^analytics and data$/i, /^analytics & data$/i],
  whatsNext: [/^what'?s next$/i],
};

const FORBIDDEN_PUBLISHED_LABELS = [
  /^thesis$/i,
  /^insider angles?$/i,
  /^roster impact$/i,
  /^recruiting and portal impact$/i,
  /^recruiting & portal impact$/i,
  /^analytics and data$/i,
  /^analytics & data$/i,
  /^what'?s next$/i,
];

const SECTION_ORDER = ['thesis', 'insiderAngles', 'scheme', 'roster', 'recruiting', 'analytics', 'whatsNext'];

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchSectionKey(title) {
  const t = String(title || '').trim();
  for (const [key, patterns] of Object.entries(INTERNAL_SECTION_LABELS)) {
    if (patterns.some((re) => re.test(t))) return key;
  }
  return null;
}

function extractInternalSections(html) {
  const sections = {};
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|$)/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const key = matchSectionKey(stripHtml(m[1]));
    if (!key) continue;
    sections[key] = String(m[2] || '').trim();
  }
  return sections;
}

function listH2Titles(html) {
  const titles = [];
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) titles.push(stripHtml(m[1]));
  return titles;
}

function hasForbiddenPublishedLabels(html) {
  return listH2Titles(html).some((t) => FORBIDDEN_PUBLISHED_LABELS.some((re) => re.test(t)));
}

function assemblePublishedHtml({ headers, sections, recruitingHtml, order = SECTION_ORDER }) {
  const parts = [];
  for (const key of order) {
    if (key === 'recruiting' && recruitingHtml) {
      parts.push(`<h2>${escapeHtml(headers.recruiting || headers.recruitingBattles || 'Recruiting Battles')}</h2>`);
      parts.push(recruitingHtml);
      continue;
    }
    const content = sections[key];
    if (!content) continue;
    const header = headers[key];
    if (!header) continue;
    parts.push(`<h2>${escapeHtml(header)}</h2>`);
    parts.push(content);
  }
  return parts.filter(Boolean).join('\n\n');
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  INTERNAL_SECTION_LABELS,
  FORBIDDEN_PUBLISHED_LABELS,
  SECTION_ORDER,
  extractInternalSections,
  hasForbiddenPublishedLabels,
  assemblePublishedHtml,
  listH2Titles,
  stripHtml,
  matchSectionKey,
};