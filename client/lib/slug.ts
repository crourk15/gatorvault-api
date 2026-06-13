/**
 * Client-side slug normalization — mirrors server/lib/slug.js
 */
export function slugify(value: string | null | undefined): string {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isValidSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  const s = String(slug).trim();
  return s.length > 0 && s !== 'undefined' && s !== 'null' && /^[a-z0-9-]+$/i.test(s);
}

/** Resolve slug from player row — never returns empty for named players. */
export function ensurePlayerSlug(
  slug: string | null | undefined,
  name?: string | null
): string {
  if (isValidSlug(slug)) return String(slug).trim().toLowerCase();
  const fromName = slugify(name);
  return fromName || '';
}
