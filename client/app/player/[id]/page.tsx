/**
 * Player profile page by UUID — /player/:id (App Router target).
 */
import React, { useEffect, useState } from 'react';
import { ConfidenceBar } from '@/components/futurecast/ConfidenceBar';
import { FitScoreBreakdown } from '@/components/player/FitScoreBreakdown';
import { MovementHistoryGraph } from '@/components/player/MovementHistoryGraph';
import {
  fetchPlayerById,
  fetchPlayerProfiles,
  type HighSchoolProfile,
  type PlayerCore,
} from '@/lib/player-api';
import { fetchPlayerPredictions, type PlayerPrediction } from '@/lib/predictions-api';
import '@/lib/futurecast.css';

const PLACEHOLDER_PHOTO =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect fill="#0D1117" width="128" height="128" rx="12"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#8B949E" font-size="40" font-family="sans-serif">?</text></svg>'
  );

export interface PlayerPageProps {
  params: { id: string };
}

function modelConfidence(predictions: PlayerPrediction[]): number | null {
  const active = predictions.find((p) => p.status === 'ACTIVE' && p.sourceType === 'MODEL');
  return active?.confidence ?? null;
}

function offerSchools(profile: HighSchoolProfile | null): string[] {
  if (!profile?.offers?.length) return [];
  return profile.offers
    .map((offer) => (typeof offer.school === 'string' ? offer.school.trim() : ''))
    .filter(Boolean);
}

function playerSchool(player: PlayerCore, offers: string[]): string {
  return player.committedTo ?? offers[0] ?? player.highSchool ?? '—';
}

function PlayerPageContent({
  player,
  offers,
  modelConfidencePct,
}: {
  player: PlayerCore;
  offers: string[];
  modelConfidencePct: number | null;
}): React.ReactElement {
  return (
    <div className="fc-player-page" data-testid="player-page">
      <h1 className="fc-player-page__title">{player.fullName}</h1>
      <p className="fc-player-page__meta">
        {player.position} • {player.classYear} • {playerSchool(player, offers)}
      </p>
      <img
        src={PLACEHOLDER_PHOTO}
        alt={player.fullName}
        className="fc-player-page__photo"
      />
      <section className="fc-player-page__section">
        <h2 className="fc-player-page__section-title">FutureCast</h2>
        {modelConfidencePct != null ? (
          <>
            <p className="fc-player-page__muted">MODEL Confidence: {modelConfidencePct}%</p>
            <ConfidenceBar value={modelConfidencePct} />
          </>
        ) : (
          <p className="fc-player-page__muted">No active MODEL pick on file.</p>
        )}
      </section>
      <section className="fc-player-page__section">
        <h2 className="fc-player-page__section-title">UF Fit Score</h2>
        {player.ufFitScore != null ? (
          <>
            <p className="fc-player-page__fit-score">{player.ufFitScore}%</p>
            <ConfidenceBar value={player.ufFitScore} />
          </>
        ) : (
          <p className="fc-player-page__muted">No UF Fit Score on file.</p>
        )}
      </section>
      <section className="fc-player-page__section fc-player-page__section--breakdown">
        <h2 className="fc-player-page__section-title">Fit Score Breakdown</h2>
        <FitScoreBreakdown fit={player.fitScoreBreakdown} />
      </section>
      <section className="fc-player-page__section fc-player-page__section--movement">
        <h2 className="fc-player-page__section-title">Movement History</h2>
        <MovementHistoryGraph history={player.movementHistory} />
      </section>
      <section className="fc-player-page__section">
        <h2 className="fc-player-page__section-title">Offers</h2>
        {offers.length ? (
          <ul className="fc-player-page__offers">
            {offers.map((offer) => (
              <li key={offer}>{offer}</li>
            ))}
          </ul>
        ) : (
          <p className="fc-player-page__muted">No offers listed.</p>
        )}
      </section>
    </div>
  );
}

export default function PlayerPage({ params }: PlayerPageProps): React.ReactElement {
  const [player, setPlayer] = useState<PlayerCore | null>(null);
  const [offers, setOffers] = useState<string[]>([]);
  const [modelConfidencePct, setModelConfidencePct] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setError(null);

    async function load() {
      try {
        const [{ player: core }, profiles, predictions] = await Promise.all([
          fetchPlayerById(params.id),
          fetchPlayerProfiles(params.id),
          fetchPlayerPredictions(params.id),
        ]);

        if (cancelled) return;

        setPlayer(core);
        setOffers(offerSchools(profiles.highSchoolProfile));
        setModelConfidencePct(modelConfidence(predictions));
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load player';
        if (/not found|404/i.test(message)) {
          setNotFound(true);
        } else {
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (loading) {
    return <p className="fc-profile-empty fc-player-page-wrap">Loading player…</p>;
  }

  if (notFound) {
    return <p className="fc-profile-error fc-player-page-wrap">Player not found.</p>;
  }

  if (error || !player) {
    return <p className="fc-profile-error fc-player-page-wrap">{error ?? 'Failed to load player.'}</p>;
  }

  return (
    <PlayerPageContent
      player={player}
      offers={offers}
      modelConfidencePct={modelConfidencePct}
    />
  );
}
