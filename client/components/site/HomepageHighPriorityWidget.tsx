'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { HighPriorityTargetCard } from '@/components/futurecast/HighPriorityTargetCard';
import {
  fetchHighPriorityTargets,
  readHighPriorityCache,
  writeHighPriorityCache,
  type HighPriorityPlayer,
  type HighPriorityResponse,
} from '@/lib/futurecast-high-priority-api';
import { primaryRecruitingClassYear } from '@/lib/recruiting-cycle';

const REFRESH_MS = 60_000;
const TOP_N = 3;

function WidgetSkeleton(): React.ReactElement {
  return (
    <div className="gv-hp-widget gv-hp-widget--loading" data-testid="hp-widget-skeleton">
      <div className="gv-hp-widget__skeleton" />
      <div className="gv-hp-widget__skeleton" />
      <div className="gv-hp-widget__skeleton" />
    </div>
  );
}

export function HomepageHighPriorityWidget(): React.ReactElement {
  const focusYear = primaryRecruitingClassYear();
  const [players, setPlayers] = useState<HighPriorityPlayer[]>(
    () => readHighPriorityCache(focusYear)?.players ?? []
  );
  const [loading, setLoading] = useState(!players.length);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isBackground: boolean) => {
    if (!isBackground && !players.length) setLoading(true);
    try {
      const data: HighPriorityResponse = await fetchHighPriorityTargets(focusYear);
      setPlayers(data.players.slice(0, TOP_N));
      writeHighPriorityCache(data);
      setError(null);
    } catch (err) {
      if (!players.length) {
        setError(err instanceof Error ? err.message : 'High Priority targets unavailable.');
      }
    } finally {
      setLoading(false);
    }
  }, [focusYear, players.length]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function run(isBackground: boolean) {
      if (cancelled) return;
      await load(isBackground);
    }

    void run(!!players.length);
    timer = setInterval(() => void run(true), REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [load, players.length]);

  if (loading && !players.length) {
    return <WidgetSkeleton />;
  }

  if (error && !players.length) {
    return (
      <div className="gv-hp-widget gv-hp-widget--error" data-testid="hp-widget-error">
        <p>{error}</p>
        <button type="button" onClick={() => void load(false)}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <section className="gv-hp-widget" data-testid="homepage-high-priority-widget">
      <header className="gv-hp-widget__head">
        <h3>High Priority Targets</h3>
        <p>Top {TOP_N} UF board priorities · {focusYear} cycle</p>
      </header>
      <div className="gv-hp-widget__grid">
        {players.map((p, i) => (
          <HighPriorityTargetCard key={p.slug} player={p} rank={i + 1} compact />
        ))}
      </div>
      <a href={focusYear >= 2028 ? '/vault/recruiting/2028/targets' : '/vault/recruiting/priority'} className="gv-hp-widget__link">
        View full priority board →
      </a>
    </section>
  );
}
