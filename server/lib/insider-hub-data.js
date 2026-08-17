/**
 * Insider hub static enrichments (server-side mirror of client insider-data).
 * Author/tag *catalog* chips are curated; live counts come from published articles.
 */

const AUTHOR_ROLE_BY_NAME = {
  'gatorvault staff': 'Editorial',
  'gatorvault film desk': 'Film Analysis',
  'gatorvault analytics': 'Data & Trends',
};

/** Curated desk roster — roles only; never use fake article counts. */
const insiderAuthors = [
  { id: 'staff', name: 'GatorVault Staff', role: 'Editorial', articleCount: 0 },
  { id: 'film-desk', name: 'GatorVault Film Desk', role: 'Film Analysis', articleCount: 0 },
  { id: 'analytics', name: 'GatorVault Analytics', role: 'Data & Trends', articleCount: 0 },
];

const insiderHeatIndex = [
  { id: 'portal', label: 'Portal & roster churn', value: 88 },
  { id: 'qb-battle', label: 'QB battle (Jones Jr. vs Philo)', value: 92 },
  { id: 'scheme-335', label: '3-3-5 defensive install', value: 85 },
  { id: 'recruiting', label: 'Recruiting class health', value: 78 },
  { id: 'nil', label: 'NIL & locker room dynamics', value: 70 },
];

/** Curated topic chips — only shown when deriveTagsFromArticles finds matches. */
const insiderTags = [
  { id: 'tag-335', label: '3-3-5', hot: true, match: /3[\s-]?3[\s-]?5|scheme install/i },
  { id: 'tag-portal', label: 'Portal', hot: true, match: /\bportal\b/i },
  { id: 'tag-qb', label: 'QB battle', hot: true, match: /\bqb\b|quarterback|philo|jones\s*jr/i },
  { id: 'tag-ol', label: 'OL cohesion', hot: false, match: /\bol\b|offensive line|o-line|oline/i },
  { id: 'tag-film', label: 'Film Room', hot: false, match: /\bfilm\b/i },
  { id: 'tag-recruiting', label: 'Recruiting', hot: false, match: /\brecruit|war room|class health/i },
  { id: 'tag-analytics', label: 'Analytics', hot: false, match: /\banalytics|probability|win model|\bwar\b/i },
];

function slugPart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function deriveAuthorsFromArticles(articles) {
  const counts = new Map();
  for (const a of articles || []) {
    const name = String(a.author || 'GatorVault Staff').trim() || 'GatorVault Staff';
    const key = name.toLowerCase();
    const prev = counts.get(key);
    if (prev) prev.articleCount += 1;
    else {
      counts.set(key, {
        id: `author-${slugPart(name)}`,
        name,
        role: AUTHOR_ROLE_BY_NAME[key] || 'GatorVault Insider',
        articleCount: 1,
      });
    }
  }
  return [...counts.values()].sort((a, b) => b.articleCount - a.articleCount || a.name.localeCompare(b.name));
}

function articleTagHaystack(a) {
  return [a.title, a.preview, a.category, a.author, a.articleType].filter(Boolean).join(' ');
}

function deriveTagsFromArticles(articles) {
  const rows = articles || [];
  const out = [];
  for (const tag of insiderTags) {
    const re = tag.match;
    if (!re) continue;
    let n = 0;
    for (const a of rows) {
      if (re.test(articleTagHaystack(a))) n += 1;
    }
    if (n < 1) continue;
    out.push({ id: tag.id, label: tag.label, hot: Boolean(tag.hot) || n >= 2 });
  }
  // Also surface known hub categories that aren't already covered by curated labels.
  const knownCats = new Set([
    'recruiting',
    'film room',
    'game week',
    'roster',
    'nil',
    'community',
  ]);
  const covered = new Set(out.map((t) => t.label.toLowerCase()));
  const catCounts = new Map();
  for (const a of rows) {
    const label = String(a.category || '').trim();
    if (!label || !knownCats.has(label.toLowerCase())) continue;
    if (covered.has(label.toLowerCase())) continue;
    catCounts.set(label, (catCounts.get(label) || 0) + 1);
  }
  for (const [label, n] of [...catCounts.entries()].sort((a, b) => b[1] - a[1])) {
    out.push({
      id: `tag-cat-${slugPart(label)}`,
      label,
      hot: n >= 2,
    });
  }
  return out.slice(0, 12);
}

const insiderStorylinesFallback = [
  {
    id: 'ol-cohesion',
    icon: '💪',
    title: 'OL Cohesion — 5 new starters, can they gel?',
    body: 'Entirely rebuilt through the 2026 portal class. Building chemistry is the biggest question heading into fall camp.',
  },
  {
    id: 'defense-335',
    icon: '🛡️',
    title: 'Defensive 3-3-5 Install',
    body: 'Spring practice showed the scheme ahead of schedule. Woods at JACK is the best player on this defense.',
  },
  {
    id: 'recruiting-health',
    icon: '🎯',
    title: 'Recruiting Class Health',
    body: 'No attrition concerns. Groce and Morris are the two most closely watched freshmen.',
  },
  {
    id: 'qb-competition',
    icon: '📈',
    title: 'QB Competition — Jones Jr. vs Philo',
    body: 'The spring battle is real. Jones Jr. brings dual-threat ability; Philo provides a pro-style floor.',
  },
];

function categoryFromBadge(badge) {
  const b = String(badge || '').toUpperCase();
  if (!b) return 'Insider';
  if (b.includes('FILM')) return 'Film Room';
  if (b.includes('PORTAL') || b.includes('ROSTER')) return 'Roster';
  if (b.includes('GAME') || b.includes('WEEK')) return 'Game Week';
  if (b.includes('RECRUIT')) return 'Recruiting';
  if (b.includes('NIL')) return 'NIL';
  if (b.includes('COMMUNITY')) return 'Community';
  if (b.includes('WAR')) return 'Game Week';
  return badge || 'Insider';
}

const STORYLINE_ICON_RE = /^([\u{1F300}-\u{1FAFF}\u2600-\u27BF]+)\s*(.+)$/u;

function parseStorylineTitle(raw) {
  const m = String(raw || '').match(STORYLINE_ICON_RE);
  if (m) return { icon: m[1], title: m[2].trim() };
  return { icon: '📌', title: String(raw || '').trim() };
}

module.exports = {
  insiderAuthors,
  insiderHeatIndex,
  insiderTags,
  insiderStorylinesFallback,
  categoryFromBadge,
  parseStorylineTitle,
  deriveAuthorsFromArticles,
  deriveTagsFromArticles,
};
