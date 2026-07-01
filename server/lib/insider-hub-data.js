/**
 * Insider hub static enrichments (server-side mirror of client insider-data).
 */

const insiderAuthors = [
  { id: 'staff', name: 'GatorVault Staff', role: 'Editorial', articleCount: 48 },
  { id: 'film-desk', name: 'GatorVault Film Desk', role: 'Film Analysis', articleCount: 32 },
  { id: 'analytics', name: 'GatorVault Analytics', role: 'Data & Trends', articleCount: 21 },
];

const insiderHeatIndex = [
  { id: 'portal', label: 'Portal & roster churn', value: 88 },
  { id: 'qb-battle', label: 'QB battle (Jones Jr. vs Philo)', value: 92 },
  { id: 'scheme-335', label: '3-3-5 defensive install', value: 85 },
  { id: 'recruiting', label: 'Recruiting class health', value: 78 },
  { id: 'nil', label: 'NIL & locker room dynamics', value: 70 },
];

const insiderTags = [
  { id: 'tag-335', label: '3-3-5', hot: true },
  { id: 'tag-portal', label: 'Portal', hot: true },
  { id: 'tag-qb', label: 'QB battle', hot: true },
  { id: 'tag-ol', label: 'OL cohesion', hot: false },
  { id: 'tag-recruiting', label: 'Recruiting', hot: false },
  { id: 'tag-analytics', label: 'Analytics', hot: false },
];

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
};
