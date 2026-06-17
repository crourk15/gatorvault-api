'use client';

import React from 'react';
import { FutureCastHero } from './FutureCastHero';
import { MovementHeatmapCard } from './MovementHeatmapCard';
import { MovementList, VolatilityList, FitScoreList, AlertsList } from './MovementList';
import { InsiderPaywall } from './InsiderPaywall';
import { FutureCastInsiderCTA } from './FutureCastInsiderCTA';
import { isFutureCastInsider } from '@/lib/futurecast-insider';
import type { MovementIntelResponse } from '@/lib/futurecast-board-types';
import { FC_METRIC_LABELS, formatUfPercent } from '@/lib/futurecast-elite-metrics';

type Props = {
  data: MovementIntelResponse;
};

export function MovementIntelLayout({ data }: Props): React.ReactElement {
  const insider = isFutureCastInsider();

  return (
    <div className="gv-elite-stack fc-elite-page" data-testid="fc-movement-intel-layout">
      <FutureCastHero lastUpdated={data.updatedAt} />
      <div className="gv-row fc-elite-row">
        <MovementHeatmapCard
          heatmap={data.movementHeatmap}
          buckets={data.heatmap.buckets}
          windowDays={data.heatmap.windowDays}
        />
      </div>
      <InsiderPaywall
        hideGate
        teaser={
          <section className="gv-card">
            <h2 className="gv-card-title">Movement Intel</h2>
            <p className="gv-card-subtitle">Risers, fallers, volatility, and fit scores — Insider only.</p>
          </section>
        }
      >
        <div className="gv-row gv-row--split fc-elite-row fc-elite-row--split">
          <MovementList
            title="Top Risers"
            players={data.risers}
            tone="up"
            valueLabel={(p) => `+${p.trendDelta7d.toFixed(2)}`}
          />
          <MovementList
            title="Top Fallers"
            players={data.fallers}
            tone="down"
            valueLabel={(p) => p.trendDelta7d.toFixed(2)}
          />
        </div>
        <div className="gv-row gv-row--split fc-elite-row fc-elite-row--split">
          <VolatilityList title="High Volatility" players={data.highVolatility} />
          <MovementList
            title="Stable Targets"
            players={data.stable}
            tone="stable"
            valueLabel={(p) => `${FC_METRIC_LABELS.uf} ${formatUfPercent(p.ufConfidence)}`}
          />
        </div>
        <div className="gv-row gv-row--split fc-elite-row fc-elite-row--split">
          <FitScoreList title={`${FC_METRIC_LABELS.fit} Leaders`} players={data.fitScoreLeaders} leaders />
          <FitScoreList title={`${FC_METRIC_LABELS.fit} Risks`} players={data.fitScoreRisks} />
        </div>
        <AlertsList alerts={data.alerts} />
      </InsiderPaywall>
      {!insider ? (
        <FutureCastInsiderCTA limit={6} total={data.risers.length + data.fallers.length} />
      ) : null}
    </div>
  );
}
