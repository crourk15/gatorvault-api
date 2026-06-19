'use client';

import React from 'react';
import { FutureCastSubPageHero } from './FutureCastSubPageHero';
import { MovementHeatmapCard } from './MovementHeatmapCard';
import { MovementList, VolatilityList, FitScoreList, AlertsList } from './MovementList';
import { InsiderPaywall } from './InsiderPaywall';
import { FutureCastInsiderCTA } from './FutureCastInsiderCTA';
import { FutureCastPanelShell } from './lab/primitives';
import { isFutureCastInsider } from '@/lib/futurecast-insider';
import type { MovementIntelResponse } from '@/lib/futurecast-board-types';
import { FC_METRIC_LABELS, formatUfPercent } from '@/lib/futurecast-elite-metrics';

type Props = {
  data: MovementIntelResponse;
};

export function MovementIntelLayout({ data }: Props): React.ReactElement {
  const insider = isFutureCastInsider();
  const updatedLabel = data.updatedAt
    ? `Updated ${new Date(data.updatedAt).toLocaleString()}`
    : 'Updated daily';

  return (
    <div className="rh-cc-page fc-lab-cc-page" data-testid="fc-movement-intel-layout">
      <FutureCastSubPageHero
        title="Movement Intel"
        sub="Risers, fallers, volatility, fit scores, and alerts across the 7-day window."
        badge={updatedLabel}
        metrics={[
          { label: 'Risers', value: data.risers.length, highlight: true },
          { label: 'Fallers', value: data.fallers.length },
          { label: 'Volatile', value: data.highVolatility.length },
        ]}
      />

      <div className="rh-cc-main rh-frame">
        <div className="rh-cc-col">
          <section>
            <FutureCastPanelShell
              title={`Movement Heatmap — ${data.heatmap.windowDays} Days`}
              sub="Directional distribution across the allow-list."
              testId="fc-movement-heatmap"
            >
              <MovementHeatmapCard
                heatmap={data.movementHeatmap}
                buckets={data.heatmap.buckets}
                windowDays={data.heatmap.windowDays}
              />
            </FutureCastPanelShell>
          </section>
        </div>
      </div>

      <InsiderPaywall
        hideGate
        teaser={
          <FutureCastPanelShell title="Movement Intel" sub="Risers, fallers, volatility, and fit scores — Insider only.">
            <p className="rh-cc-empty">Unlock FutureCast Insider for full movement intel.</p>
          </FutureCastPanelShell>
        }
      >
        <div className="rh-cc-main rh-frame">
          <div className="rh-cc-col rh-cc-col--left">
            <section>
              <FutureCastPanelShell title="Top Risers" sub="7-day UF probability gainers." testId="fc-movement-risers">
                <MovementList
                  title="Top Risers"
                  players={data.risers}
                  tone="up"
                  valueLabel={(p) => `+${p.trendDelta7d.toFixed(2)}`}
                />
              </FutureCastPanelShell>
            </section>
            <section>
              <FutureCastPanelShell title="High Volatility" sub="Targets with unstable signals." testId="fc-movement-volatile">
                <VolatilityList title="High Volatility" players={data.highVolatility} />
              </FutureCastPanelShell>
            </section>
            <section>
              <FutureCastPanelShell
                title={`${FC_METRIC_LABELS.fit} Leaders`}
                sub="Top fit scores on the board."
                testId="fc-movement-fit-leaders"
              >
                <FitScoreList title={`${FC_METRIC_LABELS.fit} Leaders`} players={data.fitScoreLeaders} leaders />
              </FutureCastPanelShell>
            </section>
          </div>

          <div className="rh-cc-col rh-cc-col--right">
            <section>
              <FutureCastPanelShell title="Top Fallers" sub="7-day UF probability decliners." testId="fc-movement-fallers">
                <MovementList
                  title="Top Fallers"
                  players={data.fallers}
                  tone="down"
                  valueLabel={(p) => p.trendDelta7d.toFixed(2)}
                />
              </FutureCastPanelShell>
            </section>
            <section>
              <FutureCastPanelShell title="Stable Targets" sub="Minimal movement in the window." testId="fc-movement-stable">
                <MovementList
                  title="Stable Targets"
                  players={data.stable}
                  tone="stable"
                  valueLabel={(p) => `${FC_METRIC_LABELS.uf} ${formatUfPercent(p.ufConfidence)}`}
                />
              </FutureCastPanelShell>
            </section>
            <section>
              <FutureCastPanelShell
                title={`${FC_METRIC_LABELS.fit} Risks`}
                sub="Fit score concerns on the board."
                testId="fc-movement-fit-risks"
              >
                <FitScoreList title={`${FC_METRIC_LABELS.fit} Risks`} players={data.fitScoreRisks} />
              </FutureCastPanelShell>
            </section>
          </div>
        </div>

        <div className="rh-frame">
          <section>
            <FutureCastPanelShell title="Movement Alerts" sub="Automated flags from the model." testId="fc-movement-alerts">
              <AlertsList alerts={data.alerts} />
            </FutureCastPanelShell>
          </section>
        </div>
      </InsiderPaywall>

      {!insider ? (
        <FutureCastInsiderCTA limit={6} total={data.risers.length + data.fallers.length} />
      ) : null}
    </div>
  );
}
