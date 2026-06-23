/**
 * Shared window boot state for recruiting hub hero + class metrics.
 */
import type { RhHubClassOverview, RhHubHeroPayload } from '@/lib/recruiting-hub-elite-api';
import type { RecruitingClassYear } from '@/lib/recruiting-cycle';

export type GvRecruitingHubWindowState = {
  start?: number;
  year?: number;
  ok?: boolean;
  bundleLoadMs?: number;
  heroRenderMs?: number;
  hydrationMs?: number;
  bundleToHeroMs?: number;
  hydrationQueueMs?: Record<string, number>;
  metricsByYear?: Partial<Record<RecruitingClassYear, RhHubClassOverview>>;
};

declare global {
  interface Window {
    __GV_HERO__?: RhHubHeroPayload;
    __GV_HUB__?: GvRecruitingHubWindowState;
  }
}

export {};
