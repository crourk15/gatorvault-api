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
]);

const BLOCKED_RECRUIT_NAMES = new Set([
  'camron cooper',
  'jordan williams',
  'trey morrison',
  'trey morrions',
  'malik clark',
  'michael johnson jr.',
  'michael johnson jr',
]);

export function isBlockedRecruit(player: {
  slug?: string | null;
  id?: string | null;
  name?: string | null;
  playerName?: string | null;
}): boolean {
  const slug = String(player.slug || player.id || '').toLowerCase();
  if (BLOCKED_RECRUIT_SLUGS.has(slug)) return true;
  const name = String(player.name || player.playerName || '').trim().toLowerCase();
  return BLOCKED_RECRUIT_NAMES.has(name);
}

export function filterBlockedRecruits<T extends { slug?: string | null; name?: string | null; playerName?: string | null }>(
  list: T[] | null | undefined
): T[] {
  return (list ?? []).filter((p) => !isBlockedRecruit(p));
}
