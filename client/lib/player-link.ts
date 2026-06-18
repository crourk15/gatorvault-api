/**
 * Canonical player profile hrefs — slug-only, never numeric On3 ids in URLs.
 */
import { playerProfilePath } from './player-routes';
import { ensurePlayerSlug, isValidSlug } from './slug';
import type { PlayerProfileContext } from './vault-route-map';

export type PlayerLinkInput = {
  slug?: string | null;
  playerSlug?: string | null;
  name?: string | null;
  id?: string | null;
};

function isNumericKey(value: string | null | undefined): boolean {
  return /^\d+$/.test(String(value ?? '').trim());
}

/** Resolve a URL-safe slug; rejects numeric-only identifiers. */
export function resolvePlayerLinkSlug(input: PlayerLinkInput): string {
  const candidates = [input.playerSlug, input.slug, input.id];
  for (const raw of candidates) {
    if (!raw || isNumericKey(raw)) continue;
    const resolved = ensurePlayerSlug(raw, input.name);
    if (isValidSlug(resolved) && !isNumericKey(resolved)) return resolved;
  }
  const fromName = ensurePlayerSlug(null, input.name);
  return isValidSlug(fromName) && !isNumericKey(fromName) ? fromName : '';
}

/** Canonical vault player profile href, or empty string when slug cannot be resolved. */
export function playerHref(
  input: PlayerLinkInput,
  context: PlayerProfileContext = 'recruiting',
  lifecycle?: string | null,
  inVault = true
): string {
  const slug = resolvePlayerLinkSlug(input);
  if (!slug) return '';
  return playerProfilePath(slug, lifecycle, inVault, input.name, context);
}
