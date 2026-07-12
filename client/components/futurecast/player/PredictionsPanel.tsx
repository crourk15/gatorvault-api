/**
 * Player profile predictions panel — ranked FutureCast Picks (logo + %).
 */
import React, { useEffect, useState } from 'react';
import {
  fetchPlayerPredictions,
  type PlayerPrediction,
} from '../../../lib/predictions-api';
import { fetchUnderclassmenIntel } from '../../../lib/futurecast-underclassmen-api';
import { SchoolRankRow } from './SchoolRankRow';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function isFloridaSchool(school: string): boolean {
  return /\bflorida\b|\bgators\b|\buf\b/i.test(school);
}

export interface PredictionsPanelProps {
  playerId: string;
  playerSlug?: string;
  classYear?: number;
  initialPredictions?: PlayerPrediction[];
}

export function PredictionsPanel({
  playerId,
  playerSlug,
  classYear,
  initialPredictions,
}: PredictionsPanelProps): React.ReactElement {
  const [predictions, setPredictions] = useState<PlayerPrediction[]>(initialPredictions ?? []);
  const [loading, setLoading] = useState(!(initialPredictions?.length ?? 0));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialPredictions?.length) {
      setPredictions(initialPredictions);
      setLoading(false);
    }
  }, [initialPredictions]);

  useEffect(() => {
    let cancelled = false;
    if (initialPredictions?.length) {
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    setError(null);

    const load = async (): Promise<void> => {
      const slug = playerSlug?.trim().toLowerCase();
      const underclassmen = classYear != null && classYear >= 2028 && classYear <= 2030;

      if (underclassmen && slug) {
        const intel = await fetchUnderclassmenIntel(slug);
        if (cancelled) return;
        if (intel?.ok && intel.earlyFutureCastPicks?.length) {
          setPredictions(intel.earlyFutureCastPicks);
          return;
        }
      }

      if (!isUuid(playerId)) {
        if (slug) {
          const intel = await fetchUnderclassmenIntel(slug);
          if (cancelled) return;
          if (intel?.ok && intel.earlyFutureCastPicks?.length) {
            setPredictions(intel.earlyFutureCastPicks);
            return;
          }
        }
        setPredictions([]);
        return;
      }

      try {
        const rows = await fetchPlayerPredictions(playerId, slug);
        if (!cancelled) setPredictions(rows);
      } catch (err) {
        if (slug && !cancelled) {
          const intel = await fetchUnderclassmenIntel(slug);
          if (intel?.ok && intel.earlyFutureCastPicks?.length) {
            setPredictions(intel.earlyFutureCastPicks);
            return;
          }
        }
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load predictions');
        }
      }
    };

    void load().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [playerId, playerSlug, classYear, initialPredictions]);

  if (loading) return <p className="fc-profile-muted">Loading predictions…</p>;
  if (error) return <p className="fc-profile-muted">{error}</p>;
  if (!predictions.length) {
    return <p className="fc-profile-muted">No FutureCast Picks on file yet.</p>;
  }

  const ranked = [...predictions].sort((a, b) => b.confidence - a.confidence);

  return (
    <ol className="fc-school-rank-list" data-testid="player-predictions-panel">
      {ranked.map((p, i) => (
        <SchoolRankRow
          key={p.id}
          rank={i + 1}
          school={p.school}
          pct={p.confidence}
          emphasize={i === 0 || isFloridaSchool(p.school)}
        />
      ))}
    </ol>
  );
}
