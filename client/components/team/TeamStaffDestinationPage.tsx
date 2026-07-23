'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  buildSeedTeamHubBundle,
  fetchTeamHubBundle,
  readCachedTeamHubBundle,
  type TeamHubBundle,
} from '@/lib/team-hub-api';
import type { Coach } from '@/lib/team-hub-types';
import { lockBodyScroll } from '@/lib/body-scroll-lock';
import { CoachingStaffModal } from '@/components/team/CoachingStaffModal';
import { TeamElitePageShell } from '@/components/team/premium/TeamElitePageShell';
import { StaffCardGrid } from '@/components/team/premium/StaffCardGrid';
import { useVaultDataReload } from '@/lib/vault-navigation';

const SEED_BUNDLE: TeamHubBundle = buildSeedTeamHubBundle();

export function TeamStaffDestinationPage(): React.ReactElement {
  const cachedHub = typeof window !== 'undefined' ? readCachedTeamHubBundle() : null;
  const [bundle, setBundle] = useState<TeamHubBundle>(cachedHub ?? SEED_BUNDLE);
  const [loading, setLoading] = useState(!cachedHub && SEED_BUNDLE.coaches.length === 0);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial && !readCachedTeamHubBundle() && SEED_BUNDLE.coaches.length === 0) {
      setLoading(true);
    }
    try {
      const hub = await fetchTeamHubBundle({ onFresh: setBundle });
      setBundle(hub);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  useVaultDataReload(() => void load(false));

  useEffect(() => {
    if (!selectedCoach) return;
    return lockBodyScroll();
  }, [selectedCoach]);

  const staffLoading = loading && bundle.coaches.length === 0;
  const coachingCount = bundle.coaches.filter((c) => c.group === 'coaching').length;

  return (
    <TeamElitePageShell testId="vault-team-staff">
      <section className="team-dest-hero team-dest-hero--staff team-premium-bleed" aria-labelledby="team-staff-hero-title">
        <div className="rh-frame team-dest-hero__inner">
          <p className="team-dest-hero__kicker">GatorVault · Team</p>
          <h1 id="team-staff-hero-title" className="team-dest-hero__title">
            Coaching Staff
          </h1>
          <p className="team-dest-hero__sub">
            Sumrall&apos;s room — {coachingCount || '—'} coaches on the Florida card.
          </p>
        </div>
      </section>

      <div className="rh-frame rh-cc-page team-premium-cc-page team-dest-page">
        <Link href="/vault/team/" className="team-dest-back">
          ← Back to Team hub
        </Link>

        <StaffCardGrid
          coaches={bundle.coaches}
          onSelectCoach={setSelectedCoach}
          loading={staffLoading}
        />
      </div>

      <CoachingStaffModal coach={selectedCoach} onClose={() => setSelectedCoach(null)} />
    </TeamElitePageShell>
  );
}
