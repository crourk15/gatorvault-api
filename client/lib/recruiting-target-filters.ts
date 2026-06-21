/** Client-side UF target board filters (mirrors server/lib/recruiting-target-filters.js). */

export function isFloridaSchool(value: string | null | undefined): boolean {
  const v = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!v) return false;
  return /\bflorida\b|\bgators\b/i.test(v);
}

export function resolveCommittedTo(player: { committedTo?: string | null }): string | null {
  const raw = player?.committedTo ?? null;
  if (raw == null || raw === '') return null;
  return String(raw).trim();
}

export function isCommittedElsewhere(player: { committedTo?: string | null }): boolean {
  const to = resolveCommittedTo(player);
  if (!to) return false;
  return !isFloridaSchool(to);
}

export function isActiveUfTarget(player: { committedTo?: string | null } | null | undefined): boolean {
  if (!player) return false;
  if (isFloridaSchool(resolveCommittedTo(player))) return false;
  if (isCommittedElsewhere(player)) return false;
  return true;
}
