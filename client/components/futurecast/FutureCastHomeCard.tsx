/**
 * FutureCast homepage player card — commits, targets, and trending variants.
 */
import React from 'react';
import type { FeedPrediction } from '@/lib/predictions-api';
import { ConfidenceBar } from './ConfidenceBar';
import { TrendingIndicator } from './TrendingIndicator';

export type FutureCastHomeCardVariant = 'commit' | 'target' | 'trending';

export interface FutureCastHomeCardProps {
  prediction: FeedPrediction;
  variant: FutureCastHomeCardVariant;
}

const PLACEHOLDER_PHOTO =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72"><rect fill="#0a1628" width="72" height="72" rx="10"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-size="24" font-family="sans-serif">?</text></svg>'
  );

function headshotUrl(slug: string): string {
  return `/headshots/${encodeURIComponent(slug)}.svg`;
}

export function FutureCastHomeCard({
  prediction,
  variant,
}: FutureCastHomeCardProps): React.ReactElement {
  const slug = prediction.playerSlug || prediction.playerId;
  const href = `/player/${encodeURIComponent(slug)}`;
  const photoSrc = headshotUrl(slug);

  return (
    <a
      className={`fc-home-card fc-home-card--${variant}`}
      href={href}
      data-testid={`home-card-${variant}`}
    >
      <div className="fc-home-card__media">
        <img
          src={photoSrc}
          alt=""
          className="fc-home-card__photo"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = PLACEHOLDER_PHOTO;
          }}
        />
        {variant === 'commit' && <span className="fc-home-card__badge fc-home-card__badge--commit">Committed</span>}
        {variant === 'target' && <span className="fc-home-card__badge fc-home-card__badge--target">Target</span>}
      </div>
      <div className="fc-home-card__body">
        <h3 className="fc-home-card__name">{prediction.fullName}</h3>
        <p className="fc-home-card__meta">
          {prediction.position} · Class of {prediction.classYear}
        </p>
        {prediction.school && (
          <p className="fc-home-card__school">{prediction.school}</p>
        )}
        <div className="fc-home-card__metrics">
          {variant === 'target' && prediction.ufProbability != null && (
            <div className="fc-home-card__metric fc-home-card__metric--primary">
              <span className="fc-home-card__metric-label">UF Probability</span>
              <span className="fc-home-card__metric-value">{prediction.ufProbability}%</span>
            </div>
          )}
          {variant === 'commit' && prediction.ufFitScore != null && (
            <div className="fc-home-card__metric fc-home-card__metric--primary">
              <span className="fc-home-card__metric-label">Fit Score</span>
              <span className="fc-home-card__metric-value">{prediction.ufFitScore}</span>
            </div>
          )}
          {variant === 'commit' && prediction.stabilityScore != null && (
            <div className="fc-home-card__metric">
              <span className="fc-home-card__metric-label">Stability</span>
              <span className="fc-home-card__metric-value">{prediction.stabilityScore}</span>
            </div>
          )}
          {variant === 'trending' && prediction.delta !== undefined && (
            <div className="fc-home-card__trend">
              <TrendingIndicator delta={prediction.delta} />
            </div>
          )}
          <ConfidenceBar value={prediction.confidence} />
        </div>
      </div>
    </a>
  );
}
