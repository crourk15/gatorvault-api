/**
 * FutureCast homepage player card — commits, targets, and trending variants.
 */
import React, { useMemo, useState } from 'react';
import type { FeedPrediction } from '@/lib/predictions-api';
import { playerProfilePath } from '@/lib/player-routes';
import { usePathname } from '@/lib/use-pathname';
import { isVaultPath } from '@/lib/vault-routes';
import { TrendingIndicator } from './TrendingIndicator';

export type FutureCastHomeCardVariant =
  | 'commit'
  | 'target'
  | 'trending-up'
  | 'trending-down';

export interface FutureCastHomeCardProps {
  prediction: FeedPrediction;
  variant: FutureCastHomeCardVariant;
}

function playerInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function headshotCandidates(slug: string): string[] {
  return [
    `/headshots/${encodeURIComponent(slug)}.jpg`,
    `/headshots/${encodeURIComponent(slug)}.png`,
    `/headshots/${encodeURIComponent(slug)}.svg`,
  ];
}

function ufProbabilityDisplay(p: FeedPrediction): number | null {
  if (p.ufProbability != null) return p.ufProbability;
  if (p.committedTo?.toLowerCase().includes('florida')) return p.confidence;
  return p.confidence;
}

export function FutureCastHomeCard({
  prediction,
  variant,
}: FutureCastHomeCardProps): React.ReactElement {
  const pathname = usePathname();
  const inVault = isVaultPath(pathname);
  const slug = prediction.playerSlug || prediction.playerId;
  const href = playerProfilePath(slug, prediction.lifecycle ?? 'HIGH_SCHOOL', inVault);
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = useMemo(() => headshotCandidates(slug), [slug]);
  const showPhoto = photoIndex < photos.length;
  const ufProb = ufProbabilityDisplay(prediction);
  const movement = prediction.delta;
  const showMovement = movement !== undefined && movement !== 0;

  return (
    <a
      className={`fc-home-card fc-home-card--${variant}`}
      href={href}
      data-testid={`home-card-${variant}`}
    >
      <div className="fc-home-card__inner">
        <div className="fc-home-card__photo-wrap">
          {showPhoto ? (
            <img
              src={photos[photoIndex]}
              alt=""
              className="fc-home-card__photo"
              onError={() => setPhotoIndex((i) => i + 1)}
            />
          ) : (
            <div className="fc-home-card__photo fc-home-card__photo--placeholder" aria-hidden>
              {playerInitials(prediction.fullName) || '?'}
            </div>
          )}
        </div>

        <div className="fc-home-card__content">
          <div className="fc-home-card__head">
            <div className="fc-home-card__title-block">
              <h3 className="fc-home-card__name">{prediction.fullName}</h3>
              <p className="fc-home-card__meta">
                {prediction.position} · {prediction.classYear}
              </p>
              {prediction.school && (
                <p className="fc-home-card__school">{prediction.school}</p>
              )}
            </div>
            {variant === 'commit' && (
              <span className="fc-home-card__badge fc-home-card__badge--commit">Committed</span>
            )}
            {variant === 'target' && (
              <span className="fc-home-card__badge fc-home-card__badge--target">Target</span>
            )}
            {showMovement && (
              <div className="fc-home-card__movement">
                <TrendingIndicator delta={movement} />
              </div>
            )}
          </div>

          <div className="fc-home-card__metrics-row">
            {ufProb != null && variant !== 'commit' && (
              <div className="fc-home-card__stat">
                <span className="fc-home-card__stat-label">UF Probability</span>
                <span className="fc-home-card__stat-value fc-home-card__stat-value--orange">
                  {ufProb}%
                </span>
              </div>
            )}
            {prediction.ufFitScore != null && (
              <div className="fc-home-card__stat">
                <span className="fc-home-card__stat-label">Fit Score</span>
                <span className="fc-home-card__stat-value">{prediction.ufFitScore}</span>
              </div>
            )}
            {variant === 'commit' && ufProb != null && (
              <div className="fc-home-card__stat">
                <span className="fc-home-card__stat-label">UF Probability</span>
                <span className="fc-home-card__stat-value fc-home-card__stat-value--orange">
                  {ufProb}%
                </span>
              </div>
            )}
            {variant === 'commit' && prediction.stabilityScore != null && (
              <div className="fc-home-card__stat">
                <span className="fc-home-card__stat-label">Stability</span>
                <span className="fc-home-card__stat-value">{prediction.stabilityScore}</span>
              </div>
            )}
            {showMovement && (variant === 'trending-up' || variant === 'trending-down') && (
              <div className="fc-home-card__stat">
                <span className="fc-home-card__stat-label">Movement</span>
                <span className="fc-home-card__stat-value">
                  <TrendingIndicator delta={movement} />
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}
