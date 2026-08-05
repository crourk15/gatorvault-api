'use client';

import React, { useMemo } from 'react';
import type {
  FutureCastHeatLevel,
  FutureCastHeroMetrics,
  FutureCastPageSummary,
} from '@/lib/api/futurecast';
import type { MasterBoardResponse, MovementIntelResponse } from '@/lib/futurecast-board-types';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { formatRelativeUpdated } from '@/components/recruiting-hub/utils/formatDate';
import { UfProbabilityBarHero } from './primitives';
import {
  futureCastPlayerToLabTarget,
  highPriorityToLabTarget,
  isLabHeroEliteFit,
  movementDeltasAreBelievable,
  pickLabHeroLead,
  ufPctFromFc,
} from './fc-lab-types';
import { closingClassUrgencyScore, isClosingClassInPlayTarget } from './competing-schools';
import { FutureCastLabCycleToggle } from './FutureCastLabCycleToggle';
import { useFutureCastLabCycle } from './FutureCastLabCycleContext';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { isActiveUfTarget } from '@/lib/recruiting-target-filters';

type Props = {
  summary: FutureCastPageSummary;
  metrics: FutureCastHeroMetrics;
  heatLevel: FutureCastHeatLevel;
  masterBoard: MasterBoardResponse;
  movementIntel: MovementIntelResponse;
  highPriority?: HighPriorityPlayer[];
  lastUpdated?: string | null;
};

export function FutureCastHero({
  metrics,
  masterBoard,
  highPriority = [],
  lastUpdated,
}: Props): React.ReactElement {
  const { discoveryView: discoveryFocus } = useFutureCastLabCycle();
  const focusYear = discoveryFocus ? 2028 : 2027;

  const top10 = useMemo(() => {
    // Discovery meter must stay on the 2028 high-priority board — never fall back to
    // Closing Class masterBoard under a "top 2028" label while HP is still loading.
    if (discoveryFocus) {
      return [...highPriority]
        .filter((p) => isActiveUfTarget(p))
        .filter((p) => Number(p.classYear) === focusYear)
        .filter((p) => {
          const uf =
            p.ufProbability ??
            (p as { ufConfidence?: number | null }).ufConfidence;
          return uf != null && Number.isFinite(Number(uf)) && Number(uf) > 0;
        })
        .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))
        .slice(0, 10)
        .map(highPriorityToLabTarget);
    }
    const mapped = [...masterBoard.players]
      .filter((p) => isActiveUfTarget(p))
      .map(futureCastPlayerToLabTarget)
      .filter(isClosingClassInPlayTarget)
      .sort((a, b) => closingClassUrgencyScore(b) - closingClassUrgencyScore(a));
    return mapped.slice(0, 10);
  }, [discoveryFocus, highPriority, masterBoard.players, focusYear]);

  const top10Avg = useMemo(() => {
    if (!top10.length) {
      return discoveryFocus
        ? Math.round(metrics.avgUFProbability || 0)
        : Math.round(masterBoard.ufConfidenceAverage ?? metrics.avgUFProbability);
    }
    return Math.round(top10.reduce((acc, p) => acc + ufPctFromFc(p.ufProbability), 0) / top10.length);
  }, [top10, discoveryFocus, metrics.avgUFProbability, masterBoard.ufConfidenceAverage]);

  const avgDelta = useMemo((): number | null => {
    if (!top10.length) return null;
    if (!movementDeltasAreBelievable(top10)) return null;
    const withDelta = top10.filter((p) => p.delta7d != null && Number(p.delta7d) !== 0);
    if (!withDelta.length) return null;
    return Math.round(withDelta.reduce((acc, p) => acc + (p.delta7d ?? 0), 0) / withDelta.length);
  }, [top10]);

  /** Hottest #1; elite scheme fit only steals the lead with real Florida odds (≥25%). */
  const lead = useMemo(() => pickLabHeroLead(top10), [top10]);

  const updatedLabel = lastUpdated ? formatRelativeUpdated(lastUpdated) : 'just now';
  const meterLabel = discoveryFocus
    ? `Commit likelihood — top ${focusYear}`
    : 'Commit likelihood — top targets';

  return (
    <section className="fc-lab-hero fc-lab-hero--slim fc-lab-bleed" data-testid="fc-lab-hero">
      <div className="fc-lab-hero__bg" aria-hidden />
      <div className="fc-lab-hero__inner rh-frame">
        <div className="fc-lab-hero__grid fc-lab-hero__grid--slim">
          <div className="fc-lab-hero__col fc-lab-hero__col--overview">
            <p className="fc-lab-hero__eyebrow rh-cc-hero__eyebrow">FutureCast</p>
            <h1 className="fc-lab-hero__title rh-cc-hero__title">UF FUTURECAST LAB</h1>
            <p className="fc-lab-hero__sub rh-cc-hero__sub">
              {discoveryFocus
                ? `${focusYear} discovery — the UF board, and how it fits Florida.`
                : '2027 closing class — Florida odds, visits, and flip watch.'}
            </p>
            <FutureCastLabCycleToggle className="fc-lab-hero__cycle-toggle" />
            {lead ? (
              <a
                href={playerProfileRoute(lead.slug, 'futurecast')}
                className="fc-lab-hero__lead"
                data-testid="fc-lab-hero-lead"
              >
                <span className="fc-lab-hero__lead-name">{lead.name}</span>
                <span className="fc-lab-hero__lead-meta">
                  {isLabHeroEliteFit(lead) ? 'Elite scheme fit' : lead.position}
                  {' · '}
                  {ufPctFromFc(lead.ufProbability)}% Florida
                </span>
              </a>
            ) : null}
            <p className="fc-lab-hero__updated">Updated {updatedLabel}</p>
          </div>

          <div className="fc-lab-hero__col fc-lab-hero__col--meter">
            <UfProbabilityBarHero value={top10Avg} delta7d={avgDelta} label={meterLabel} />
          </div>
        </div>
      </div>
    </section>
  );
}
