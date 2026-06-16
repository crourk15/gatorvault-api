export type {
  RecruitingIntelItem,
  RecruitingClassPayload,
  RecruitingPlayer,
  RecruitingPlayerPayload,
  RecruitingPortalEntry,
} from '@/api/recruiting';

export {
  RECRUITING_CACHE_TTL_MS,
  fetchRecruitingClass,
  fetchRecruitingPlayer,
  fetchHighPriorityIntel,
  fetchRecruitingTargets,
  fetchRecruitingPortal,
} from '@/api/recruiting';

/** @deprecated use RECRUITING_CACHE_TTL_MS */
export { RECRUITING_CACHE_TTL_MS as RECRUITING_HUB_CACHE_TTL_MS } from '@/api/recruiting';

/** @deprecated use fetchHighPriorityIntel */
export { fetchHighPriorityIntel as fetchRecruitingHighPriorityIntel } from '@/api/recruiting';

/** @deprecated */
export type { RecruitingClassPayload as RecruitingClassResponse } from '@/api/recruiting';
