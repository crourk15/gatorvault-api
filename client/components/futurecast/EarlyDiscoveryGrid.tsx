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
  onPlayerClick?: (player: EarlyDiscoveryPlayer) => void;
}

function filterByPosition(
  list: EarlyDiscoveryPlayer[],
  position?: string
): EarlyDiscoveryPlayer[] {
  if (!position) return list;
  const pos = position.toUpperCase();
  return list.filter((p) => (p.position || '').toUpperCase() === pos);
}

export function EarlyDiscoveryGrid({ query, onPlayerClick }: EarlyDiscoveryGridProps): React.ReactElement {
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
  }, [classYearGte, minDiscoveryScore, limit]);

  const players = useMemo(() => {
    const filtered = filterByPosition(fetched, position);
    return filtered.map((p, index) => ({ ...p, rank: index + 1 }));
  }, [fetched, position]);

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
    <div
      className="gv-rb-grid"
      data-testid="early-discovery-grid"
      data-refreshing={isRefreshing ? 'true' : undefined}
    >
      {players.map((player) => {
        const card = (
          <ClassicRecruitCard
            player={fromEarlyDiscovery(player)}
            variant="target"
          />
        );
        if (!onPlayerClick) {
          return <div key={player.id}>{card}</div>;
        }
        return (
          <button
            key={player.id}
            type="button"
            className="gv-rb-card-button"
            onClick={() => onPlayerClick(player)}
            data-testid="player-card"
            data-slug={player.slug}
          >
            {card}
          </button>
        );
      })}
    </div>
  );
}
