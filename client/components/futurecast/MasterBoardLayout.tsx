'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FutureCastSubPageHero } from './FutureCastSubPageHero';
import { FutureCastSubPageLoading } from './FutureCastSubPageLoading';
import { MovementHeatmapCard } from './MovementHeatmapCard';
import { ConfidenceMeter } from './ConfidenceMeter';
import { CommitWatch } from './CommitWatch';
import { HighPriorityList } from './HighPriorityList';
import { MovementSummary } from './MovementSummary';
import { InsiderPaywall } from './InsiderPaywall';
import { FutureCastInsiderCTA } from './FutureCastInsiderCTA';
import { FutureCastPanelShell } from './lab/primitives';
import { isFutureCastInsider } from '@/lib/futurecast-insider';
import { UiError } from '@/components/site/UiMessage';
import { fetchFutureCastMasterBoard } from '@/lib/futurecast-board-api';
import type { MasterBoardResponse } from '@/lib/futurecast-board-types';
import { FC_METRIC_LABELS } from '@/lib/futurecast-elite-metrics';

const REFRESH_MS = 60_000;

export function MasterBoardLayout(): React.ReactElement {
  const [data, setData] = useState<MasterBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (initial: boolean) => {
    if (initial) {
      setLoading(true);
      setError(null);
    }
    try {
      const next = await fetchFutureCastMasterBoard();
      setData(next);
      setError(null);
    } catch (err) {
      if (initial) setError(err instanceof Error ? err.message : 'Failed to load master board.');
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    void load(true);
    timer = setInterval(() => {
      if (!cancelled) void load(false);
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [load]);

  if (loading && !data) {
    return <FutureCastSubPageLoading testId="fc-master-board-loading" />;
  }
  if (error && !data) {
    return (
      <UiError
        message={error}
        retry={() => void load(true)}
        backHref="/vault/futurecast"
        backLabel="← FutureCast"
      />
    );
  }
  if (!data) {
    return <p className="rh-cc-empty">No master board data.</p>;
  }

  const insider = isFutureCastInsider();

  return (
    <div className="rh-cc-page fc-lab-cc-page" data-testid="fc-master-board-layout">
      <FutureCastSubPageHero
        title="Master Board"
        sub="High-priority targets, movement heatmap, commit watch, and UF confidence across the cycle."
        badge="Updated daily"
        metrics={[
          { label: 'High Priority', value: data.highPriority.players.length, highlight: true },
          { label: 'Active Targets', value: data.players.length },
          { label: `Avg ${FC_METRIC_LABELS.uf}`, value: `${Math.round(data.ufConfidenceAverage)}%` },
        ]}
      />

      <div className="rh-cc-main rh-frame">
        <div className="rh-cc-col rh-cc-col--left">
          <section>
            <FutureCastPanelShell
              title={`Movement Heatmap — ${data.heatmap.windowDays} Days`}
              sub="Directional shifts across the allow-list."
              testId="fc-master-heatmap"
            >
              <MovementHeatmapCard
                heatmap={data.movementHeatmap}
                buckets={data.heatmap.buckets}
                windowDays={data.heatmap.windowDays}
              />
            </FutureCastPanelShell>
          </section>
          <section>
            <FutureCastPanelShell
              title="High Priority Targets"
              sub="Top UF intel board ranked by probability and fit."
              testId="fc-master-priority"
            >
              <HighPriorityList players={data.highPriority.players} />
            </FutureCastPanelShell>
          </section>
          <InsiderPaywall
            hideGate
            teaser={
              <FutureCastPanelShell title="Movement Summary" sub="Insider unlock required">
                <p className="rh-cc-empty">Risers, fallers, and volatile targets — Insider only.</p>
              </FutureCastPanelShell>
            }
          >
            <section>
              <FutureCastPanelShell
                title="Movement Summary"
                sub="Risers, fallers, and volatile targets in the current window."
                testId="fc-master-movement-summary"
              >
                <MovementSummary
                  risers={data.movementSummary.riserPlayers}
                  fallers={data.movementSummary.fallerPlayers}
                  volatile={data.movementSummary.volatilePlayers}
                />
              </FutureCastPanelShell>
            </section>
          </InsiderPaywall>
        </div>

        <div className="rh-cc-col rh-cc-col--right">
          <section>
            <FutureCastPanelShell
              title={`${FC_METRIC_LABELS.uf} Meter`}
              sub="Average commit likelihood across top targets."
              testId="fc-master-confidence"
            >
              <ConfidenceMeter average={data.ufConfidenceAverage} sparkline={data.confidenceSparkline} />
            </FutureCastPanelShell>
          </section>
          <section>
            <FutureCastPanelShell
              title="Commit Watch"
              sub="Top 3 closest to popping."
              testId="fc-master-commit-watch"
            >
              <CommitWatch entries={data.commitWatch} />
            </FutureCastPanelShell>
          </section>
        </div>
      </div>

      {!insider ? <FutureCastInsiderCTA /> : null}
    </div>
  );
}
