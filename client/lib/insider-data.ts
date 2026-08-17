/**
 * Insider Articles hub — static enrichments (categories, heat, tags, authors).
 * Author/tag chips are curated; live counts come from published articles.
 */

export type InsiderCategory = { id: string; name: string; icon: string };

export type InsiderAuthor = {
  id: string;
  name: string;
  role: string;
  articleCount: number;
};

export type InsiderHeatRow = { id: string; label: string; value: number };

export type InsiderTag = { id: string; label: string; hot: boolean; match?: RegExp };

export type InsiderStoryline = {
  id: string;
  icon: string;
  title: string;
  body: string;
};

export const AUTHOR_ROLE_BY_NAME: Record<string, string> = {
  'gatorvault staff': 'Editorial',
  'gatorvault film desk': 'Film Analysis',
  'gatorvault analytics': 'Data & Trends',
};

export const insiderCategories: InsiderCategory[] = [
  { id: 'all', name: 'All', icon: '📚' },
  { id: 'recruiting', name: 'Recruiting', icon: '⭐' },
  { id: 'film-room', name: 'Film Room', icon: '🎥' },
  { id: 'game-week', name: 'Game Week', icon: '📅' },
  { id: 'roster', name: 'Roster', icon: '🏈' },
  { id: 'nil', name: 'NIL', icon: '💰' },
  { id: 'community', name: 'Community', icon: '💬' },
];

/** Curated desk roster — roles only; never use fake article counts. */
export const insiderAuthors: InsiderAuthor[] = [
  { id: 'staff', name: 'GatorVault Staff', role: 'Editorial', articleCount: 0 },
  { id: 'film-desk', name: 'GatorVault Film Desk', role: 'Film Analysis', articleCount: 0 },
  { id: 'analytics', name: 'GatorVault Analytics', role: 'Data & Trends', articleCount: 0 },
];

export const insiderHeatIndex: InsiderHeatRow[] = [
  { id: 'portal', label: 'Portal & roster churn', value: 88 },
  { id: 'qb-battle', label: 'QB battle (Jones Jr. vs Philo)', value: 92 },
  { id: 'scheme-335', label: '3-3-5 defensive install', value: 85 },
  { id: 'recruiting', label: 'Recruiting class health', value: 78 },
  { id: 'nil', label: 'NIL & locker room dynamics', value: 70 },
];

/** Curated topic chips — only shown when deriveTagsFromArticles finds matches. */
export const insiderTags: InsiderTag[] = [
  { id: 'tag-335', label: '3-3-5', hot: true, match: /3[\s-]?3[\s-]?5|scheme install/i },
  { id: 'tag-portal', label: 'Portal', hot: true, match: /\bportal\b/i },
  { id: 'tag-qb', label: 'QB battle', hot: true, match: /\bqb\b|quarterback|philo|jones\s*jr/i },
  { id: 'tag-ol', label: 'OL cohesion', hot: false, match: /\bol\b|offensive line|o-line|oline/i },
  { id: 'tag-film', label: 'Film Room', hot: false, match: /\bfilm\b/i },
  { id: 'tag-recruiting', label: 'Recruiting', hot: false, match: /\brecruit|war room|class health/i },
  { id: 'tag-analytics', label: 'Analytics', hot: false, match: /\banalytics|probability|win model|\bwar\b/i },
];

export const insiderStorylinesFallback: InsiderStoryline[] = [
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

export function categoryFromBadge(badge?: string | null): string {
  const b = String(badge || '').toUpperCase();
  if (!b) return 'Insider';
  if (b.includes('FILM')) return 'Film Room';
  if (b.includes('PORTAL') || b.includes('ROSTER')) return 'Roster';
  if (b.includes('GAME') || b.includes('WEEK')) return 'Game Week';
  if (b.includes('RECRUIT')) return 'Recruiting';
  if (b.includes('HEAT') || b.includes('OV PREVIEW') || b.includes('POST-VISIT') || b.includes('POST VISIT')) {
    return 'Recruiting';
  }
  if (b.includes('NIL')) return 'NIL';
  if (b.includes('COMMUNITY')) return 'Community';
  if (b.includes('WAR')) return 'Recruiting';
  return badge || 'Insider';
}

const STORYLINE_ICON_RE = /^([\u{1F300}-\u{1FAFF}\u2600-\u27BF]+)\s*(.+)$/u;

export function parseStorylineTitle(raw: string): { icon: string; title: string } {
  const m = raw.match(STORYLINE_ICON_RE);
  if (m) return { icon: m[1], title: m[2].trim() };
  return { icon: '📌', title: raw.trim() };
}
