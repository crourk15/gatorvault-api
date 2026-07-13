'use client';

import React from 'react';
import './recruiting-hub.css';
import { RecruitingHeroHydrator, RecruitingHeroStripInline } from '@/components/recruiting-hub/elite/RecruitingHeroStrip';
import { SigningDayTracker } from '@/components/recruiting-hub/elite/SigningDayTracker';
import { ClassCards } from '@/components/recruiting-hub/elite/ClassCards';
import { MovementIntelFeed } from '@/components/recruiting-hub/elite/MovementIntelFeed';
import { YoungerProspectsPanel } from '@/components/recruiting-hub/elite/YoungerProspectsPanel';
import { BattleBoard } from '@/components/recruiting-hub/elite/BattleBoard';
import { RecruitingFootprintMap } from '@/components/recruiting-hub/elite/footprint/RecruitingFootprintMap';
import { RecruitingPositionSnapshot } from '@/components/recruiting-hub/elite/RecruitingPositionSnapshot';
import { RecruitingHubBundleProvider } from '@/components/recruiting-hub/elite/RecruitingHubBundleContext';
import { RecruitingClassYearProvider } from '@/components/recruiting-hub/elite/RecruitingClassYearProvider';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';
import { LazyHubSection } from '@/components/recruiting-hub/elite/LazyHubSection';
import { EliteCommitBoard } from '@/components/recruiting-hub/elite/EliteCommitBoard';
import { useRecruitingHubBundle } from '@/components/recruiting-hub/elite/useRecruitingHubBundle';
import { UiError, UiWarming } from '@/components/site/UiMessage';
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
  }, []);

  const content = (
    <>
      {bundle.loading && bundle.warming ? (
        <div className="rh-hub-warming" role="status" aria-live="polite" aria-busy="true">
          <UiWarming
            title="Loading recruiting hub…"
            hint="Loading class metrics and board data."
          />
        </div>
      ) : null}
      {bundle.error && !bundle.loading ? (
        <UiError
          message="Recruiting data is taking longer than usual. Tap Try again — your board will load when ready."
          retry={bundle.reload}
          backHref="/vault"
          backLabel="← Vault"
        />
      ) : null}
      {deferHero ? <RecruitingHeroHydrator /> : <RecruitingHeroStripInline />}
      <SigningDayTracker />
      <LazyHubSection priority="top-fold" testId="rh-lazy-commit-board">
        <EliteCommitBoard year={activeYear} />
      </LazyHubSection>
      <LazyHubSection priority="top-fold" testId="rh-lazy-class-cards">
        <ClassCards />
      </LazyHubSection>
      <LazyHubSection testId="rh-lazy-battle-board">
        <BattleBoard />
      </LazyHubSection>
      <LazyHubSection testId="rh-lazy-movement-feed">
        <MovementIntelFeed />
      </LazyHubSection>
      <LazyHubSection testId="rh-lazy-position-snapshot">
        <RecruitingPositionSnapshot />
      </LazyHubSection>
      <LazyHubSection minHeight={420} testId="rh-lazy-footprint">
        <RecruitingFootprintMap />
      </LazyHubSection>
      {activeYear === 2028 ? (
        <LazyHubSection testId="rh-lazy-younger-prospects">
          <YoungerProspectsPanel />
        </LazyHubSection>
      ) : null}
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
