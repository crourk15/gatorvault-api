'use client';

import React, { useMemo } from 'react';
import type {
  FutureCastHeatLevel,
  FutureCastHeroMetrics,
  FutureCastPageSummary,
} from '@/lib/api/futurecast';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { MovementSummary } from '@/lib/recruiting-movement-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { formatRelativeUpdated } from '@/components/recruiting-hub/utils/formatDate';
import { UfProbabilityBarHero } from './primitives';

const HEAT_LABELS: Record<FutureCastHeatLevel, string> = {
  hot: 'Hot cycle',
  warm: 'Warm cycle',
  cold: 'Cool cycle',
};

type Props = {
  summary: FutureCastPageSummary;
  metrics: FutureCastHeroMetrics;
  heatLevel: FutureCastHeatLevel;
  highPriority: HighPriorityPlayer[];
  staffDashboard: StaffDashboardResponse | null;
  movementSummary: MovementSummary | null;
  lastUpdated?: string | null;
};

export function FutureCastHero({
  summary,
  metrics,
  heatLevel,
  highPriority,
  staffDashboard,
  movementSummary,
  lastUpdated,
}: Props): React.ReactElement {
  const avgDelta = useMemo(() => {
    if (!highPriority.length) return 0;
    const sum = highPriority.reduce((acc, p) => acc + (p.delta7d ?? p.movementDelta ?? 0), 0);
    return Math.round(sum / highPriority.length);
  }, [highPriority]);

  const volatilityLine = useMemo(() => {
    const volatile = staffDashboard?.highVolatility?.length ?? movementSummary?.volatile ?? 0;
    const risers = staffDashboard?.topRisers?.length ?? movementSummary?.rising ?? 0;
    const fallers = staffDashboard?.topFallers?.length ?? movementSummary?.falling ?? 0;
    return `${volatile} volatile targets · ${risers} risers · ${fallers} fallers in the ${staffDashboard?.movementWindowDays ?? 7}d window.`;
  }, [staffDashboard, movementSummary]);

  const battleAlerts = useMemo(() => {
    const fromStaff = (staffDashboard?.alerts ?? []).slice(0, 3).map((a) => ({
      icon: a.type === 'VISIT' ? '📍' : a.type === 'OFFER' ? '🎯' : '⚠️',
      text: `${a.playerName}: ${a.message}`,
    }));
    if (fromStaff.length >= 3) return fromStaff;
    const fromVolatile = (staffDashboard?.highVolatility ?? []).slice(0, 3 - fromStaff.length).map((p) => ({
      icon: '⚡',
      text: `${p.name}: High volatility — UF prob shifting`,
    }));
    return [...fromStaff, ...fromVolatile];
  }, [staffDashboard]);

  const updatedLabel = lastUpdated ? formatRelativeUpdated(lastUpdated) : null;

  return (
    <section className="fc-lab-hero" data-testid="fc-lab-hero">
      <div className="fc-lab-hero__bg" aria-hidden />
      <div className="fc-lab-hero__inner rh-frame">
        <div className="fc-lab-hero__grid">
          <div className="fc-lab-hero__col fc-lab-hero__col--overview">
            <p className="fc-lab-hero__eyebrow">UF FutureCast Lab</p>
            <h1 className="fc-lab-hero__title">FutureCast Overview — Class of {summary.classYear}</h1>
            <p className="fc-lab-hero__sub">
              Commit likelihood, movement intel, fit scores, and competing schools for UF&apos;s top targets.
            </p>
            <div className="fc-lab-hero__metrics">
              <div className="fc-lab-hero__metric fc-lab-hero__metric--rank">
                <span className="fc-lab-hero__metric-label">Natl Rank</span>
                <strong className="fc-lab-hero__metric-value">
                  {summary.nationalRank != null ? `#${summary.nationalRank}` : '—'}
                </strong>
              </div>
              <div className="fc-lab-hero__metric">
                <span className="fc-lab-hero__metric-label">High Priority</span>
                <strong className="fc-lab-hero__metric-value">{metrics.highPriorityCount}</strong>
              </div>
              <div className="fc-lab-hero__metric">
                <span className="fc-lab-hero__metric-label">Active Predictions</span>
                <strong className="fc-lab-hero__metric-value">{metrics.activePredictions}</strong>
              </div>
              <div className="fc-lab-hero__metric">
                <span className="fc-lab-hero__metric-label">Cycle Heat</span>
                <strong className={`fc-lab-hero__metric-value fc-lab-hero__heat--${heatLevel}`}>
                  {HEAT_LABELS[heatLevel]}
                </strong>
              </div>
            </div>
            {updatedLabel ? <p className="fc-lab-hero__updated">Updated {updatedLabel}</p> : null}
          </div>

          <div className="fc-lab-hero__col fc-lab-hero__col--meter">
            <UfProbabilityBarHero value={metrics.avgUFProbability} delta7d={avgDelta} />
          </div>

          <div className="fc-lab-hero__col fc-lab-hero__col--heat">
            <h2 className="fc-lab-hero__panel-title">Battle Heat &amp; Volatility</h2>
            <p className="fc-lab-hero__movement-line">{volatilityLine}</p>
            <h3 className="fc-lab-hero__alerts-title">Live Alerts</h3>
            <ul className="fc-lab-hero__alerts">
              {battleAlerts.length === 0 ? (
                <li className="fc-lab-hero__alert">No live alerts — monitoring targets.</li>
              ) : (
                battleAlerts.map((alert, i) => (
                  <li key={`${alert.text}-${i}`} className="fc-lab-hero__alert">
                    <span aria-hidden>{alert.icon}</span> {alert.text}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
