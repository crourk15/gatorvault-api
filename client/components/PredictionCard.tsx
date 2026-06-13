/**
 * FutureCast prediction card — MODEL pick with confidence bar.
 */
import React from 'react';
import { sourceTypeLabel, type FeedPrediction } from '../lib/predictions-api';
import { PredictionBadge } from './futurecast/PredictionBadge';
import { ConfidenceBar } from './futurecast/ConfidenceBar';
import { TrendingIndicator } from './futurecast/TrendingIndicator';

export interface PredictionCardData {
  playerId: string;
  playerSlug?: string;
  playerName: string;
  photoUrl?: string | null;
  position: string;
  class: number | string;
  team: string;
  type: string;
  confidence: number;
  delta?: number;
  createdAt: string;
}

export interface PredictionCardProps {
  prediction: PredictionCardData;
}

const PLACEHOLDER_PHOTO =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect fill="#0D1117" width="64" height="64" rx="8"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#8B949E" font-size="22" font-family="sans-serif">?</text></svg>'
  );

export function feedPredictionToCard(p: FeedPrediction): PredictionCardData {
  return {
    playerId: p.playerId,
    playerSlug: p.playerSlug,
    playerName: p.fullName,
    photoUrl: null,
    position: p.position,
    class: p.classYear,
    team: p.school,
    type: `${sourceTypeLabel(p.sourceType).toLowerCase()} pick`,
    confidence: p.confidence,
    delta: p.delta,
    createdAt: p.createdAt,
  };
}

export function PredictionCard({ prediction }: PredictionCardProps): React.ReactElement {
  const href = prediction.playerSlug
    ? `/futurecast/player/${encodeURIComponent(prediction.playerSlug)}`
    : `/futurecast/player/${encodeURIComponent(prediction.playerId)}`;

  return (
    <a className="fc-prediction-card-v2" href={href} data-testid="prediction-card">
      <img
        src={prediction.photoUrl || PLACEHOLDER_PHOTO}
        alt={prediction.playerName}
        className="fc-prediction-card-v2__photo"
      />
      <div className="fc-prediction-card-v2__body">
        <div>
          <h3 className="fc-prediction-card-v2__name">{prediction.playerName}</h3>
          <p className="fc-prediction-card-v2__meta">
            {prediction.position} • {prediction.class}
          </p>
        </div>
        <div className="fc-prediction-card-v2__pick">
          <PredictionBadge type={prediction.type} team={prediction.team} />
          {prediction.delta !== undefined && (
            <div className="fc-prediction-card-v2__delta">
              <TrendingIndicator delta={prediction.delta} />
            </div>
          )}
          <ConfidenceBar value={prediction.confidence} />
          <p className="fc-prediction-card-v2__date">
            {new Date(prediction.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
    </a>
  );
}
