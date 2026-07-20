import seedJson from './recruiting-hub-hero-seed.json';

export type RecruitingHubHeroMetricSeed = {
  classRank: string;
  blueChip: string;
  commits: string;
  commitLabel?: string;
  avgRating: string;
  trendRank?: string;
  trendBlueChip?: string;
  trendCommits?: string;
  trendRating?: string;
};

export type RecruitingHubHeroSeed = {
  generatedAt: string;
  activeYear: number;
  title: string;
  subtitle: string;
  classYears: number[];
  classOverview: RecruitingHubHeroMetricSeed;
  classOverviewAll: Record<string, RecruitingHubHeroMetricSeed>;
};

export const RECRUITING_HUB_HERO_SEED = seedJson as RecruitingHubHeroSeed;

export function recruitingHubHeroSeedForYear(year: number): RecruitingHubHeroMetricSeed {
  return (
    RECRUITING_HUB_HERO_SEED.classOverviewAll[String(year)] ??
    RECRUITING_HUB_HERO_SEED.classOverview
  );
}
