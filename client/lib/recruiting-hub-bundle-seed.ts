import seedJson from './recruiting-hub-bundle-seed.json';
import type { RhHubBundle } from './recruiting-hub-elite-api';
import { ACTIVE_RECRUITING_CLASS_YEAR } from './recruiting-cycle';

export type RecruitingHubBundleSeedFile = {
  generatedAt: string;
  activeYear: number;
  byYear: Record<string, RhHubBundle>;
};

// Seed JSON is slimmed at generate-time; cast via unknown for nullish seed fields.
export const RECRUITING_HUB_BUNDLE_SEED = seedJson as unknown as RecruitingHubBundleSeedFile;

/** Static first-paint recruiting hub bundle — kept when live is empty/cold. */
export function getRecruitingHubBundleSeed(year = ACTIVE_RECRUITING_CLASS_YEAR): RhHubBundle | null {
  const keyed = RECRUITING_HUB_BUNDLE_SEED.byYear?.[String(year)];
  if (keyed && typeof keyed === 'object') return keyed;
  const active = RECRUITING_HUB_BUNDLE_SEED.byYear?.[String(RECRUITING_HUB_BUNDLE_SEED.activeYear)];
  return active && typeof active === 'object' ? active : null;
}

export function recruitingHubBundleHasSignal(bundle: RhHubBundle | null | undefined): boolean {
  if (!bundle) return false;
  return (
    (bundle.commits?.length ?? 0) > 0 ||
    (bundle.battles?.length ?? 0) > 0 ||
    (bundle.heatIndex?.length ?? 0) > 0 ||
    (bundle.movementFeed?.length ?? 0) > 0 ||
    (bundle.battleBoard?.length ?? 0) > 0
  );
}

/** Stale 2028 first-paint (Armani-only) must not block the live Cyion plate. */
export function recruitingHubBundleIsCurrent(bundle: RhHubBundle | null | undefined, year?: number): boolean {
  if (!recruitingHubBundleHasSignal(bundle)) return false;
  if (Number(year ?? bundle?.year) !== 2028) return true;
  return (bundle?.commits || []).some((row) => String(row?.id || '').toLowerCase() === 'cyion-smith');
}
