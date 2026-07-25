'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchEarlyDiscovery,
  type EarlyDiscoveryPlayer,
  type EarlyDiscoveryQuery,
} from '@/lib/early-discovery-api';
import { ClassicRecruitCard } from '@/components/vault/ClassicRecruitCard';
import { fromEarlyDiscovery } from '@/lib/recruiting-card-adapters';

export interface EarlyDiscoveryGridProps {
  query: EarlyDiscoveryQuery;
  /** @deprecated Cards navigate via VaultNavLink — kept for call-site compat. */
  onPlayerClick?: (player: EarlyDiscoveryPlayer) => void;
}

export function EarlyDiscoveryGrid({ query }: EarlyDiscoveryGridProps): React.ReactElement {
  const classYearGte = query.class_year_gte;
  const minDiscoveryScore = query.min_discovery_score;
  const limit = query.limit;
  const position = query.position;

  const [fetched, setFetched] = useState<EarlyDiscoveryPlayer[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      setIsRefreshing(true);
      try {
        const data = await fetchEarlyDiscovery({
          class_year_gte: classYearGte,
          min_discovery_score: minDiscoveryScore,
          limit,
          position,
        });
        if (cancelled) return;
        setFetched(data.players ?? []);
        setHasLoaded(true);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load Early Discovery');
      } finally {
        if (!cancelled) setIsRefreshing(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [classYearGte, minDiscoveryScore, limit, position]);

  const players = useMemo(() => fetched, [fetched]);
  const allowlistCount = useMemo(
    () => players.filter((p) => p.allowlistTarget).length,
    [players]
  );

  if (!hasLoaded && !error) {
    return <div className="fc-big-board-empty">Loading Early Discovery…</div>;
  }
  if (error && !players.length) {
    return <div className="fc-big-board-error">{error}</div>;
  }
  if (!players.length) {
    return <div className="fc-big-board-empty">No underclassmen match these filters yet.</div>;
  }

  return (
    <>
      <p className="fc-big-board-summary" data-testid="early-discovery-summary">
        {players.length} prospect{players.length === 1 ? '' : 's'}
        {classYearGte != null ? ` · Class ${classYearGte}+` : ''}
        {minDiscoveryScore != null && minDiscoveryScore > 0
          ? ` · Discovery score ≥ ${minDiscoveryScore}`
          : ''}
        {allowlistCount > 0 ? ` · ${allowlistCount} locked UF targets` : ''}
        {position ? ` · ${position}` : ''}
      </p>
      <div
        className="gv-rb-grid"
        data-testid="early-discovery-grid"
        data-refreshing={isRefreshing ? 'true' : undefined}
      >
        {players.map((player) => (
          <div key={player.id} data-testid="player-card" data-slug={player.slug}>
            <ClassicRecruitCard
              player={fromEarlyDiscovery(player)}
              variant="target"
              rank={player.rank}
              profileContext="futurecast"
            />
          </div>
        ))}
      </div>
    </>
  );
}
