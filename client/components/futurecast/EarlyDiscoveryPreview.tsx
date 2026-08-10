'use client';

import React, { useEffect, useState } from 'react';
import { ClassicRecruitCard } from '@/components/vault/ClassicRecruitCard';
import { fromEarlyDiscovery } from '@/lib/recruiting-card-adapters';
import {
  fetchEarlyDiscovery,
  type EarlyDiscoveryQuery,
} from '@/lib/early-discovery-api';
import { fetchWithWarmPoll, userFacingLoadError } from '@/lib/api-warm-poll';
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
  const minDiscoveryScore = query?.min_discovery_score;
  const position = query?.position;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [players, setPlayers] = useState<RecruitingBoardPlayer[]>([]);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Keep prior cards painted while refreshing — never stick on infinite Loading.
      if (!players.length) setLoading(true);
      setError(null);
      try {
        const data = await fetchWithWarmPoll(
          () =>
            fetchEarlyDiscovery({
              class_year_gte: classYearGte,
              min_discovery_score: minDiscoveryScore,
              position,
              limit,
            }),
          // Soft/stale allowlist bodies usually land quickly; don't sit in warm-poll forever.
          { maxAttempts: 3, delayMs: 800 }
        );
        if (cancelled) return;
        const next = (data.players ?? []).slice(0, limit).map(fromEarlyDiscovery);
        setCount(data.count ?? next.length);
        if (next.length) {
          setPlayers(next);
          setError(null);
        } else if (!players.length) {
          setPlayers([]);
        }
      } catch (err) {
        if (cancelled) return;
        // Preserve last good paint when a wake/timeout blip hits.
        if (!players.length) {
          setError(
            userFacingLoadError(err, 'Early Discovery is warming up — try again in a moment.')
          );
          setPlayers([]);
          setCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // intentionally omit `players` — refresh on query/retry only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classYearGte, limit, minDiscoveryScore, position, retryTick]);

  if (loading && !players.length) {
    return <p className="fc-home-section__empty">Loading Early Discovery…</p>;
  }
  if (error && !players.length) {
    return (
      <div className="fc-home-section__empty" data-testid="early-discovery-preview-error">
        <p>{error}</p>
        <p>
          <button
            type="button"
            className="rh-cc-link"
            onClick={() => setRetryTick((n) => n + 1)}
          >
            Retry Early Discovery →
          </button>
        </p>
      </div>
    );
  }
  if (!players.length) {
    return <p className="fc-home-section__empty">No underclassmen on the discovery board yet.</p>;
  }

  return (
    <>
      <div className="fc-home-card-grid gv-rb-grid" data-testid="early-discovery-preview">
        {players.map((player) => (
          <ClassicRecruitCard key={player.slug} player={player} variant="target" />
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
