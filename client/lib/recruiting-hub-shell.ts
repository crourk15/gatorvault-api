/**
 * Recruiting hub layout mode by class year.
 * - signed (2026): signees + footprint only
 * - closing (2027): commits + remaining targets + FutureCast CTA + footprint
 * - open (2028+): full war-room stack
 *
 * Mid-page Recruiting Classes cards are removed for every year — hero tabs own switching.
 */

export type RecruitingHubShellMode = 'signed' | 'closing' | 'open';

export function recruitingHubShellMode(year: number): RecruitingHubShellMode {
  const y = Number(year) || 0;
  if (y <= 2026) return 'signed';
  if (y === 2027) return 'closing';
  return 'open';
}

export function hubShowsOpenCycleSections(year: number): boolean {
  return recruitingHubShellMode(year) === 'open';
}

export function hubShowsSigningDay(year: number): boolean {
  const mode = recruitingHubShellMode(year);
  return mode === 'closing' || mode === 'open';
}

export function hubShowsRemainingTargets(year: number): boolean {
  return recruitingHubShellMode(year) === 'closing';
}

/** Always false — hero year tabs replace mid-page class cards. */
export function hubShowsClassCards(_year: number): boolean {
  return false;
}
