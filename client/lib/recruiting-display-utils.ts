/** Seed placeholder when real HS is not yet synced from On3. */
export const PLACEHOLDER_RECRUIT_SCHOOL = 'Florida HS pipeline';

export function isPlaceholderRecruitSchool(school?: string | null): boolean {
  const s = String(school ?? '').trim().toLowerCase();
  return !s || s === 'florida hs pipeline' || s === 'florida hs pipelines';
}

export function formatRecruitSchoolLabel(school?: string | null): string | null {
  if (isPlaceholderRecruitSchool(school)) return 'School pending';
  const trimmed = String(school ?? '').trim();
  return trimmed || null;
}