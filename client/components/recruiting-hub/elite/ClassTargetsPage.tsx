'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './recruiting-hub.css';
import { HighPriorityTargetCard } from '@/components/futurecast/HighPriorityTargetCard';
import { RecruitingHeroStripInline } from '@/components/recruiting-hub/elite/RecruitingHeroStrip';
import { RecruitingClassYearProvider } from '@/components/recruiting-hub/elite/RecruitingClassYearProvider';
import { UiEmpty, UiError } from '@/components/site/UiMessage';
import {
  fetchHighPriorityTargets,
  type HighPriorityResponse,
} from '@/lib/futurecast-high-priority-api';

type Props = {
  year: number;
};

export function ClassTargetsPage({ year }: Props): React.ReactElement {
  const [data, setData] = useState<HighPriorityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    void fetchHighPriorityTargets(year)
      .then((payload) => {
        setData(payload);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not load targets.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  const narrativeBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data?.movementNarratives ?? []) {
      if (row.movementNarrative) map.set(row.slug, row.movementNarrative);
    }
    return map;
  }, [data?.movementNarratives]);

  const players = useMemo(() => {
    const list = [...(data?.players ?? [])];
    list.sort((a, b) => {
      const prio = (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
      if (prio !== 0) return prio;
      return (b.ufProbability ?? 0) - (a.ufProbability ?? 0);
    });
    return list;
  }, [data?.players]);

  return (
    <RecruitingClassYearProvider initialYear={year}>
      <div className="rh-page rh-page--elite mobile-app" data-testid={`rh-${year}-targets-board`}>
        <div className="rh-frame rh-elite-chrome">
          <RecruitingHeroStripInline />
          <p className="rh-elite-back-link">
            <a href="/vault/recruiting">← Recruiting</a>
          </p>

          <section>
            <h2 className="rh-panel-title">{year} targets Florida is chasing</h2>
            <p className="rh-muted">
              Ranked by GatorVault priority (likelihood + fit). On3 RPM is market context. Corner
              movement uses real 7-day GatorVault snapshot deltas only.
            </p>
            {data?.updatedAt ? (
              <p className="rh-muted">Updated {new Date(data.updatedAt).toLocaleString()}</p>
            ) : null}
          </section>

          {loading && <p className="gv-page-status">Loading targets…</p>}

          {error && !loading && (
            <UiError message={error} retry={load} backHref="/vault/recruiting" backLabel="← Recruiting" />
          )}

          {!loading && !error && players.length === 0 && (
            <UiEmpty message="No targets on the board yet." hint="Check back after the next intel refresh." />
          )}

          {!loading && !error && players.length > 0 && (
            <div className="gv-hp-board-grid">
              {players.map((player, idx) => (
                <HighPriorityTargetCard
                  key={player.slug}
                  player={player}
                  rank={idx + 1}
                  movementNarrative={narrativeBySlug.get(player.slug)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </RecruitingClassYearProvider>
  );
}
