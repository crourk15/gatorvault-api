import type { RhHubClassOverview } from '@/lib/recruiting-hub-elite-api';
import type { RecruitingClassYear } from '@/lib/recruiting-cycle';
import '@/lib/recruiting-hub-window';

export function readBootClassMetrics(year: number): RhHubClassOverview | null {
  if (typeof window === 'undefined') return null;
  const byYear = window.__GV_HUB__?.metricsByYear;
  if (byYear && byYear[year as RecruitingClassYear]) {
    return byYear[year as RecruitingClassYear] ?? null;
  }
  const hero = window.__GV_HERO__;
  if (hero?.classOverview && Number(hero.year ?? 0) === year) {
    return hero.classOverview;
  }
  return null;
}

export function readBootClassMetricsByYear(): Partial<Record<RecruitingClassYear, RhHubClassOverview>> {
  if (typeof window === 'undefined') return {};
  const fromHub = window.__GV_HUB__?.metricsByYear ?? {};
  const hero = window.__GV_HERO__;
  const merged = { ...fromHub } as Partial<Record<RecruitingClassYear, RhHubClassOverview>>;
  if (hero?.classOverview && hero.year) {
    merged[hero.year as RecruitingClassYear] = hero.classOverview;
  }
  return merged;
}
