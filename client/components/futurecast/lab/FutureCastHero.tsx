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
  ufPctFromFc,
} from './fc-lab-types';
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
    if (discoveryFocus && highPriority.length) {
      return [...highPriority]
        .filter((p) => isActiveUfTarget(p))
        .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))
        .slice(0, 10)
        .map(highPriorityToLabTarget);
    }
    return [...masterBoard.players]
      .filter((p) => isActiveUfTarget(p))
      .sort((a, b) => (b.ufConfidence ?? -1) - (a.ufConfidence ?? -1))
      .slice(0, 10)
      .map(futureCastPlayerToLabTarget);
  }, [discoveryFocus, highPriority, masterBoard.players]);

  const top10Avg = useMemo(() => {
    if (!top10.length) {
      return discoveryFocus
        ? metrics.avgUFProbability
        : Math.round(masterBoard.ufConfidenceAverage ?? metrics.avgUFProbability);
    }
    return Math.round(top10.reduce((acc, p) => acc + ufPctFromFc(p.ufProbability), 0) / top10.length);
  }, [top10, discoveryFocus, metrics.avgUFProbability, masterBoard.ufConfidenceAverage]);

  const avgDelta = useMemo(() => {
    if (!top10.length) return 0;
    return Math.round(top10.reduce((acc, p) => acc + (p.delta7d ?? 0), 0) / top10.length);
  }, [top10]);

  /** One lead signal — elite scheme fit if present, else #1 priority. */
  const lead = useMemo(() => {
    if (!top10.length) return null;
    const elite = [...top10]
      .filter((p) => (p.fitScore ?? 0) >= 80)
      .sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0))[0];
    return elite ?? top10[0];
  }, [top10]);

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
                  {(lead.fitScore ?? 0) >= 80 ? 'Elite scheme fit' : lead.position}
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
