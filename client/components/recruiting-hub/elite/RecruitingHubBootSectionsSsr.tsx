import React from 'react';
import { ACTIVE_RECRUITING_CLASS_YEAR } from '@/lib/recruiting-cycle';

/**
 * Mid-page recruiting class cards retired — hero year tabs own class switching.
 * Kept as a no-op so command-center boot root stays stable.
 */
export function RecruitingHubBootSectionsSsr({
  year = ACTIVE_RECRUITING_CLASS_YEAR,
}: {
  year?: number;
}): React.ReactElement | null {
  void year;
  return null;
}
