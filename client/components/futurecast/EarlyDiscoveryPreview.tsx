'use client';

import React, { useEffect, useState } from 'react';
import { ClassicRecruitCard } from '@/components/vault/ClassicRecruitCard';
import { fromEarlyDiscovery } from '@/lib/recruiting-card-adapters';
import {
  fetchEarlyDiscovery,
  type EarlyDiscoveryQuery,
} from '@/lib/early-discovery-api';
import { primaryRecruitingClassYear } from '@/lib/recruiting-cycle';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';

export interface EarlyDiscoveryPreviewProps {
  query?: EarlyDiscoveryQuery;
  footerHref?: string;
  footerLabel?: string;
}

export function EarlyDiscoveryPreview({
  query,
  footerHref = '/vault/futurecast/big-board',
  footerLabel = 'Open Early Discovery board →',
}: EarlyDiscoveryPreviewProps): React.ReactElement {
  const classYearGte = query?.class_year_gte ?? primaryRecruitingClassYear();
  const limit = query?.limit ?? 6;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [players, setPlayers] = useState<RecruitingBoardPlayer[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchEarlyDiscovery({
          ...query,
          class_year_gte: classYearGte,
          limit,
        });
        if (cancelled) return;
        setCount(data.count ?? data.players?.length ?? 0);
        setPlayers((data.players ?? []).slice(0, limit).map(fromEarlyDiscovery));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load Early Discovery');
        setPlayers([]);
        setCount(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [classYearGte, limit, query?.min_discovery_score, query?.position]);

  if (loading) {
    return <p className="fc-home-section__empty">Loading Early Discovery…</p>;
  }
  if (error && !players.length) {
    return <p className="fc-home-section__empty">{error}</p>;
  }
  if (!players.length) {
    return <p className="fc-home-section__empty">No underclassmen on the discovery board yet.</p>;
  }

  return (
    <>
      <div className="fc-home-card-grid gv-rb-grid" data-testid="early-discovery-preview">
        {players.map((player, index) => (
          <ClassicRecruitCard key={player.slug} player={player} variant="target" rank={index + 1} />
        ))}
      </div>
      <p className="fc-home-section__footer-link">
        <a href={footerHref}>
          {footerLabel}
          {count > players.length ? ` (${count} total)` : ''}
        </a>
      </p>
    </>
  );
}
