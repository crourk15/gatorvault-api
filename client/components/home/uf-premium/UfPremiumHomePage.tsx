'use client';

import React from 'react';
import '@/lib/uf-premium-home.css';
import { useUfPremiumHomeData } from '@/hooks/home/useUfPremiumHomeData';
import { HeroSection } from './primitives';
import { RecruitingHubPreview } from './RecruitingHubPreview';
import { FutureCastPreview } from './FutureCastPreview';
import { TeamSnapshotPreview } from './TeamSnapshotPreview';
import { NILTrackerPreview } from './NILTrackerPreview';
import { SchedulePreview } from './SchedulePreview';
import { ContentPreview } from './ContentPreview';

/** UF Premium Homepage — wireframe v1 (hero + 6 sections). */
export function UfPremiumHomePage(): React.ReactElement {
  const data = useUfPremiumHomeData();

  return (
    <div className="uf-premium-home mobile-app" data-testid="uf-premium-home">
      <HeroSection />

      <div className="uf-premium-home__frame">
        <RecruitingHubPreview
          recruiting={data.recruiting}
          board={data.board}
          movement={data.movement}
          loading={data.loading}
        />
        <FutureCastPreview
          futurecast={data.futurecast}
          movement={data.movement}
          loading={data.loading}
        />
        <TeamSnapshotPreview team={data.team} metrics={data.teamMetrics} loading={data.loading} />
        <NILTrackerPreview
          nil={data.nil}
          valuation={data.nilValuation}
          grade={data.nilGrade}
          loading={data.loading}
        />
        <SchedulePreview game={data.schedule} loading={data.loading} />
        <ContentPreview content={data.content} loading={data.loading} />
      </div>
    </div>
  );
}
