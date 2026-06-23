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

/** Hide SSR boot mirror once the client section has real data. */
export function hideRhBootSection(bootId: string): void {
  const el = document.querySelector(`[data-rh-boot="${bootId}"]`);
  if (!el) return;
  el.setAttribute('hidden', '');
  const header = el.previousElementSibling;
  if (header?.classList.contains('rh-section-header')) {
    header.setAttribute('hidden', '');
  }
}

export function hideRhBootClassCards(): void {
  const root = document.querySelector('[data-rh-boot-root]');
  const cardsSection = root?.querySelector('section.rh-class-cards');
  if (!cardsSection) return;
  cardsSection.setAttribute('hidden', '');
  const header = cardsSection.previousElementSibling;
  if (header?.classList.contains('rh-section-header')) {
    header.setAttribute('hidden', '');
  }
}
