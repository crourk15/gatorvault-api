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

type ClassLine = {
  classRank?: string;
  blueChip?: string;
  commits?: string;
  commitLabel?: string;
  avgRating?: string;
};

/**
 * August plate baked into the app and the hub bundle seed.
 * Royal's commit moved the class to #5 / 27 / 90.1. Painting this again
 * on the way back into the hub is the snap-back.
 */
export function isStaleAugust2027ClassLine(year: number, overview: ClassLine | null | undefined): boolean {
  if (Number(year) !== 2027 || !overview) return false;
  const rank = String(overview.classRank || '').trim();
  const commits = String(overview.commits || '').trim();
  const avg = String(overview.avgRating || '').trim();
  return rank === '#8' && (commits === '26' || avg === '89.9' || avg === '89.7');
}

const CLASS_LINE_STORE = 'gv_hub_class_line_v1';

export function readStoredHubClassLine(year: number): ClassLine | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${CLASS_LINE_STORE}:${year}`);
    if (!raw) return null;
    const line = JSON.parse(raw) as ClassLine;
    if (!line?.classRank || isStaleAugust2027ClassLine(year, line)) return null;
    return line;
  } catch {
    return null;
  }
}

export function writeStoredHubClassLine(year: number, overview: ClassLine | null | undefined): void {
  if (typeof window === 'undefined' || !overview?.classRank) return;
  if (isStaleAugust2027ClassLine(year, overview)) return;
  try {
    window.localStorage.setItem(
      `${CLASS_LINE_STORE}:${year}`,
      JSON.stringify({
        classRank: overview.classRank,
        blueChip: overview.blueChip,
        commits: overview.commits,
        commitLabel: overview.commitLabel,
        avgRating: overview.avgRating,
      })
    );
  } catch {
    /* private mode / quota */
  }
}

/** Keep the class line from the last live load. Do not put the August plate back on top. */
export function preferRecruitingHubBundle(
  current: RhHubBundle | null,
  incoming: RhHubBundle | null,
  year: number
): RhHubBundle | null {
  if (!incoming) return current;
  if (!current) return incoming;
  const incomingStale = isStaleAugust2027ClassLine(year, incoming.classOverview);
  const currentStale = isStaleAugust2027ClassLine(year, current.classOverview);
  if (incomingStale && !currentStale) return current;
  return incoming;
}

export function applyStoredHubClassLine(bundle: RhHubBundle | null, year: number): RhHubBundle | null {
  if (!bundle || !isStaleAugust2027ClassLine(year, bundle.classOverview)) return bundle;
  const stored = readStoredHubClassLine(year);
  if (!stored) return bundle;
  const all = { ...(bundle.classOverviewAll || {}) };
  const prev = all[year];
  const nextLine = {
    ...bundle.classOverview,
    ...prev,
    ...stored,
  } as RhHubBundle['classOverview'];
  return {
    ...bundle,
    classOverview: nextLine,
    classOverviewAll: { ...all, [year]: nextLine },
  };
}

/** Stale 2028 first-paint (Armani/Cyion-only) must not block the live Bailey plate. */
export function recruitingHubBundleIsCurrent(bundle: RhHubBundle | null | undefined, year?: number): boolean {
  if (!recruitingHubBundleHasSignal(bundle)) return false;
  const classYear = Number(year ?? bundle?.year);
  if (classYear === 2027 && isStaleAugust2027ClassLine(2027, bundle?.classOverview)) return false;
  if (classYear !== 2028) return true;
  return (bundle?.commits || []).some((row) => String(row?.id || '').toLowerCase() === 'samuel-bailey');
}
