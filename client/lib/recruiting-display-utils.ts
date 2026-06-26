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

/** Build card school line without duplicating state already in the school label. */
export function formatRecruitSchoolLine(
  school?: string | null,
  state?: string | null,
  city?: string | null,
): string {
  const schoolLabel = formatRecruitSchoolLabel(school);
  const st = state?.trim();
  const cityTrim = city?.trim();
  const parts: string[] = [];
  if (schoolLabel) parts.push(schoolLabel);
  if (cityTrim && !(schoolLabel && schoolLabel.toLowerCase().includes(cityTrim.toLowerCase()))) {
    parts.push(cityTrim);
  }
  if (
    st &&
    !(
      schoolLabel &&
      new RegExp(`,\\s*${st.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(schoolLabel)
    )
  ) {
    parts.push(st);
  }
  return parts.length ? parts.join(' · ') : '—';
}