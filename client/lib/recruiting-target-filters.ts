/** Client-side UF target board filters (mirrors server/lib/recruiting-target-filters.js). */

/** Keep in sync with server/lib/recruiting-verified-commits.js — verified UF commits never show as active targets. */
const VERIFIED_UF_COMMIT_SLUGS = new Set([
  'tre-geathers',
  'jaydee-lane',
  'ellis-mcgaskin',
  'aaron-mcwilliams',
  'kamauri-whitfield',
  'raheem-floyd',
  'armani-strong',
]);

export function isFloridaSchool(value: string | null | undefined): boolean {
  const v = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!v) return false;
  return /\bflorida\b|\bgators\b/i.test(v);
}

export function resolveCommittedTo(player: {
  committedTo?: string | null;
  committed_to?: string | null;
}): string | null {
  const raw = player?.committedTo ?? player?.committed_to ?? null;
  if (raw == null || raw === '') return null;
  return String(raw).trim();
}

export function isCommittedElsewhere(player: {
  committedTo?: string | null;
  committed_to?: string | null;
}): boolean {
  const to = resolveCommittedTo(player);
  if (!to) return false;
  return !isFloridaSchool(to);
}

function looksCommittedStatus(player: { status?: string | null } | null | undefined): boolean {
  const status = String(player?.status || '').toLowerCase();
  return status === 'committed' || status === 'commit' || status === 'signed' || status === 'enrolled';
}

export function isActiveUfTarget(
  player: {
    slug?: string | null;
    id?: string | null;
    committedTo?: string | null;
    committed_to?: string | null;
    status?: string | null;
    category?: string | null;
    classYear?: number | null;
  } | null | undefined
): boolean {
  if (!player) return false;
  const slug = String(player.slug || player.id || '').toLowerCase();
  if (slug && VERIFIED_UF_COMMIT_SLUGS.has(slug)) return false;
  if (looksCommittedStatus(player) && isFloridaSchool(resolveCommittedTo(player))) return false;
  if (looksCommittedStatus(player) && !resolveCommittedTo(player)) return false;
  if (
    String(player.category || '').toLowerCase() === 'recruit' &&
    isFloridaSchool(resolveCommittedTo(player))
  ) {
    return false;
  }
  if (isFloridaSchool(resolveCommittedTo(player))) return false;
  if (isCommittedElsewhere(player)) return false;
  return true;
}
