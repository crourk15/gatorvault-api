'use client';

import React, { useMemo } from 'react';
import { SchedulePageShell } from '@/components/schedule';
import { DYNAMIC_PATH_PATTERNS, segmentFromPath } from '@/lib/dynamic-path-parser';
import { usePathname } from '@/lib/use-pathname';
import type { ScheduleSeason } from '@/lib/schedule-premium';

const VALID_SEASONS = new Set(['2025', '2026', '2027']);

export default function ScheduleSeasonPage(): React.ReactElement {
  const pathname = usePathname();
  const season = useMemo(() => {
    const raw = segmentFromPath(pathname, DYNAMIC_PATH_PATTERNS.scheduleSeason);
    return VALID_SEASONS.has(raw) ? (raw as ScheduleSeason) : '2026';
  }, [pathname]);

  return <SchedulePageShell defaultSeason={season} />;
}
