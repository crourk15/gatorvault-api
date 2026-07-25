'use client';

import React from 'react';
import './recruiting-hub.css';
import { RecruitingHeroHydrator, RecruitingHeroStripInline } from '@/components/recruiting-hub/elite/RecruitingHeroStrip';
import { SigningDayTracker } from '@/components/recruiting-hub/elite/SigningDayTracker';
import { MovementIntelFeed } from '@/components/recruiting-hub/elite/MovementIntelFeed';
import { BattleBoard } from '@/components/recruiting-hub/elite/BattleBoard';
import { TopTargetsHeatIndex } from '@/components/recruiting-hub/elite/TopTargetsHeatIndex';
import { RemainingTargetsStrip } from '@/components/recruiting-hub/elite/RemainingTargetsStrip';
import { FutureCastClosingCta } from '@/components/recruiting-hub/elite/FutureCastClosingCta';
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
import { hideRhBootClassCards } from '@/lib/recruiting-hub-boot-read';
import {
  hubShowsOpenCycleSections,
  hubShowsRemainingTargets,
  hubShowsSigningDay,
  recruitingHubShellMode,
} from '@/lib/recruiting-hub-shell';

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
  const shell = recruitingHubShellMode(activeYear);
  const showSigningDay = hubShowsSigningDay(activeYear);
  const showOpenCycle = hubShowsOpenCycleSections(activeYear);
  const showRemaining = hubShowsRemainingTargets(activeYear);

  React.useEffect(() => {
    initGvHydrate();
  }, []);

  // SSR may still paint class cards for older HTML — mid-page cards are retired for all years.
  React.useEffect(() => {
    hideRhBootClassCards();
  }, [activeYear]);

  const content = (
    <>
      {bundle.warming && !bundle.data ? (
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
      {showSigningDay ? <SigningDayTracker /> : null}
      <LazyHubSection key="rh-lazy-commit-board" priority="top-fold" testId="rh-lazy-commit-board">
        <EliteCommitBoard year={activeYear} />
      </LazyHubSection>
      {showRemaining ? (
        <LazyHubSection
          key="rh-lazy-remaining-targets"
          priority="top-fold"
          testId="rh-lazy-remaining-targets"
        >
          <RemainingTargetsStrip />
        </LazyHubSection>
      ) : null}
      {showRemaining ? (
        <LazyHubSection key="rh-lazy-fc-closing-cta" testId="rh-lazy-fc-closing-cta">
          <FutureCastClosingCta />
        </LazyHubSection>
      ) : null}
      {showOpenCycle ? (
        <LazyHubSection key="rh-lazy-battle-board" testId="rh-lazy-battle-board">
          <BattleBoard />
        </LazyHubSection>
      ) : null}
      {showOpenCycle ? (
        <LazyHubSection key="rh-lazy-heat-index" testId="rh-lazy-heat-index">
          <TopTargetsHeatIndex />
        </LazyHubSection>
      ) : null}
      {showOpenCycle ? (
        <LazyHubSection key="rh-lazy-movement-feed" testId="rh-lazy-movement-feed">
          <MovementIntelFeed />
        </LazyHubSection>
      ) : null}
      {showOpenCycle ? (
        <LazyHubSection key="rh-lazy-position-snapshot" testId="rh-lazy-position-snapshot">
          <RecruitingPositionSnapshot />
        </LazyHubSection>
      ) : null}
      <LazyHubSection key="rh-lazy-footprint" minHeight={420} testId="rh-lazy-footprint">
        <RecruitingFootprintMap />
      </LazyHubSection>
      <div className="rh-hub-shell-mode" data-testid="rh-hub-shell-mode" data-shell={shell} hidden />
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

/** WOW Recruiting Hub Elite — year-aware shell (signed / closing / open). */
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
