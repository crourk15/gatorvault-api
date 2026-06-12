/**
 * Big Board grid — fetches /api/big-board and renders PlayerCards.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchBigBoard,
  type BigBoardPlayer,
  type BigBoardQuery,
} from '../../lib/big-board-api';
import { PlayerCard } from './PlayerCard';

export interface BigBoardGridProps {
  query: BigBoardQuery;
  onPlayerClick?: (player: BigBoardPlayer) => void;
}

export function BigBoardGrid({ query, onPlayerClick }: BigBoardGridProps): React.ReactElement {
  const [players, setPlayers] = useState<BigBoardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBigBoard(query);
      setPlayers(data.players);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Big Board');
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div className="fc-big-board-empty">Loading Big Board…</div>;
  }
  if (error) {
    return <div className="fc-big-board-error">{error}</div>;
  }
  if (!players.length) {
    return <div className="fc-big-board-empty">No players match these filters.</div>;
  }

  return (
    <div className="fc-big-board-grid" data-testid="big-board-grid">
      {players.map((player) => (
        <PlayerCard key={player.id} player={player} onClick={onPlayerClick} />
      ))}
    </div>
  );
}
