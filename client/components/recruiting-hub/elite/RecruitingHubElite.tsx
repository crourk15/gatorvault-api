'use client';

import React from 'react';
import './recruiting-hub.css';
import { RecruitingHeroHydrator, RecruitingHeroStripInline } from '@/components/recruiting-hub/elite/RecruitingHeroStrip';
import { SigningDayTracker } from '@/components/recruiting-hub/elite/SigningDayTracker';
import { ClassCards } from '@/components/recruiting-hub/elite/ClassCards';
import { RecruitingClassOverview } from '@/components/recruiting-hub/elite/RecruitingClassOverview';
import { TopTargetsHeatIndex } from '@/components/recruiting-hub/elite/TopTargetsHeatIndex';
import { MovementIntelFeed } from '@/components/recruiting-hub/elite/MovementIntelFeed';
import { BattleBoard } from '@/components/recruiting-hub/elite/BattleBoard';
import { RecruitingFootprintMap } from '@/components/recruiting-hub/elite/footprint/RecruitingFootprintMap';
import { RecruitingBattlesMovement } from '@/components/recruiting-hub/elite/RecruitingBattlesMovement';
import { RecruitingPositionSnapshot } from '@/components/recruiting-hub/elite/RecruitingPositionSnapshot';
import { RecruitingHubBundleProvider } from '@/components/recruiting-hub/elite/RecruitingHubBundleContext';
import { RecruitingClassYearProvider } from '@/components/recruiting-hub/elite/RecruitingClassYearProvider';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';
import { LazyHubSection } from '@/components/recruiting-hub/elite/LazyHubSection';
import { useRecruitingHubBundle } from '@/components/recruiting-hub/elite/useRecruitingHubBundle';
import { initGvHydrate } from '@/lib/gv-hydrate';

type Props = {
  /** When true, SSR hero partial is rendered by the page shell — skip duplicate strip. */
  deferHero?: boolean;
  /** When true, skip outer rh-frame wrapper (parent shell provides chrome). */
  embedded?: boolean;
  /** Initial class year tab (2026/2027/2028). */
  initialYear?: number;
};

function RecruitingHubEliteContent({
  deferHero = false,
  embedded = false,
}: Omit<Props, 'initialYear'>): React.ReactElement {
  const { activeYear } = useRecruitingClassYear();
  const bundle = useRecruitingHubBundle(activeYear);

  React.useEffect(() => {
    initGvHydrate();
    document.querySelector('[data-testid="rh-elite-chrome"]')?.setAttribute('data-rh-client-ready', 'true');
  }, []);

  const content = (
    <>
      {deferHero ? <RecruitingHeroHydrator /> : <RecruitingHeroStripInline />}
      <SigningDayTracker />
      <LazyHubSection priority="top-fold" testId="rh-lazy-class-cards">
        <ClassCards />
      </LazyHubSection>
      <LazyHubSection priority="top-fold" testId="rh-lazy-class-overview-bridge">
        <RecruitingClassOverview />
      </LazyHubSection>
        <LazyHubSection testId="rh-lazy-heat-index">
          <TopTargetsHeatIndex />
        </LazyHubSection>
        <LazyHubSection testId="rh-lazy-movement-feed">
          <MovementIntelFeed />
        </LazyHubSection>
        <LazyHubSection testId="rh-lazy-battle-board">
          <BattleBoard />
        </LazyHubSection>
        <LazyHubSection minHeight={420} testId="rh-lazy-footprint">
          <RecruitingFootprintMap />
        </LazyHubSection>
        <LazyHubSection testId="rh-lazy-battles-movement">
          <RecruitingBattlesMovement />
        </LazyHubSection>
        <LazyHubSection testId="rh-lazy-position-snapshot">
          <RecruitingPositionSnapshot />
        </LazyHubSection>
    </>
  );

  return (
    <RecruitingHubBundleProvider value={bundle}>
      {embedded ? (
        content
      ) : (
        <div className="rh-frame rh-elite-chrome" data-testid="rh-elite-chrome">
          {content}
        </div>
      )}
    </RecruitingHubBundleProvider>
  );
}

/** WOW Recruiting Hub Elite — War Room vertical layout. */
export function RecruitingHubElite({
  deferHero = false,
  embedded = false,
  initialYear,
}: Props): React.ReactElement {
  return (
    <RecruitingClassYearProvider initialYear={initialYear}>
      <RecruitingHubEliteContent deferHero={deferHero} embedded={embedded} />
    </RecruitingClassYearProvider>
  );
}
