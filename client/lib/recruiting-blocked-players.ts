/** Client-side mirror of server recruiting-blocked-players.js */

export const BLOCKED_RECRUIT_SLUGS = new Set([
  'jaylen-jordan',
  'kennedee-jackson',
  'tj-shanahan-jr',
  't-j-shanahan',
  'devon-hall',
  'derrick-malone',
  'camron-cooper',
  'jordan-williams',
  'trey-morrison',
  'malik-clark',
  'michael-johnson-jr',
  'change-of',
]);

const BLOCKED_RECRUIT_NAMES = new Set([
  'camron cooper',
  'jordan williams',
  'trey morrison',
  'trey morrions',
  'malik clark',
  'michael johnson jr.',
  'michael johnson jr',
  'change of',
  '(change of)',
]);

export function stripChangeOfNameJunk(name: string | null | undefined): string {
  return String(name || '')
    .replace(/\s*\(\s*change[\s_-]+of[^)]*\)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isGarbageChaseName(name: string | null | undefined): boolean {
  const n = String(name || '').trim();
  if (!n) return false;
  if (/^UF\.?\s+/i.test(n)) return true;
  const stripped = stripChangeOfNameJunk(n);
  if (!stripped) return true;
  if (/^change[\s_-]+of\b/i.test(n) || /^change[\s_-]+of\b/i.test(stripped)) return true;
  if (/^\(\s*change[\s_-]+of/i.test(n)) return true;
  return false;
}

export function isBlockedRecruit(player: {
  slug?: string | null;
  id?: string | null;
  name?: string | null;
  playerName?: string | null;
}): boolean {
  const slug = String(player.slug || player.id || '').toLowerCase();
  if (BLOCKED_RECRUIT_SLUGS.has(slug)) return true;
  if (isGarbageChaseName(player.name || player.playerName)) return true;
  const name = String(player.name || player.playerName || '').trim().toLowerCase();
  return BLOCKED_RECRUIT_NAMES.has(name);
}

export function filterBlockedRecruits<T extends { slug?: string | null; name?: string | null; playerName?: string | null }>(
  list: T[] | null | undefined
): T[] {
  return (list ?? []).filter((p) => !isBlockedRecruit(p));
}
