'use client';

import React, { useCallback, useEffect, useState } from 'react';
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

export function EarlyDiscoveryGrid({ query, onPlayerClick }: EarlyDiscoveryGridProps): React.ReactElement {
  const { position, ...apiQuery } = query;
  const [players, setPlayers] = useState<EarlyDiscoveryPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEarlyDiscovery(apiQuery);
      let list = data.players ?? [];
      if (position) {
        const pos = position.toUpperCase();
        list = list.filter((p) => (p.position || '').toUpperCase() === pos);
      }
      setPlayers(list.map((p, index) => ({ ...p, rank: index + 1 })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Early Discovery');
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [apiQuery, position]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div className="fc-big-board-empty">Loading Early Discovery…</div>;
  }
  if (error) {
    return <div className="fc-big-board-error">{error}</div>;
  }
  if (!players.length) {
    return <div className="fc-big-board-empty">No underclassmen match these filters yet.</div>;
  }

  return (
    <div className="gv-rb-grid" data-testid="early-discovery-grid">
      {players.map((player) => {
        const card = (
          <ClassicRecruitCard
            player={fromEarlyDiscovery(player)}
            variant="target"
            rank={player.rank}
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
