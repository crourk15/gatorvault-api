/**
 * Player Profile 2.0 header — identity, scores, share.
 */
import React, { useCallback, useState } from 'react';
import type { PlayerCore, PortalProfile } from '../../../lib/player-api';
import type { PlayerMetrics } from '../../../lib/player-derived';
import {
  fitTierLabel,
  formatHeight,
  formatWeight,
  lifecycleColor,
} from '../../../lib/player-derived';
import { buildPlayerShareUrl } from '../../../lib/player-api';

export interface PlayerHeaderProps {
  player: PlayerCore;
  metrics: PlayerMetrics;
  portalProfile: PortalProfile | null;
}

export function PlayerHeader({
  player,
  metrics,
  portalProfile,
}: PlayerHeaderProps): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const lifecycle = player.status;
  const location = [player.hometown, player.state].filter(Boolean).join(', ');

  const onShare = useCallback(async () => {
    const url = buildPlayerShareUrl(player.slug);
    try {
      if (navigator.share) {
        await navigator.share({ title: player.fullName, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user cancelled share */
    }
  }, [player.fullName, player.slug]);

  return (
    <header className="fc-profile-header" data-testid="player-header">
      <div className="fc-profile-header__top">
        <div>
          <p className="fc-profile-header__position">{player.position} · Class of {player.classYear}</p>
          <h1 className="fc-profile-header__name">{player.fullName}</h1>
          {location && <p className="fc-profile-header__location">{location}</p>}
          {(player.height || player.weight) && (
            <p className="fc-profile-header__measurables">
              {formatHeight(player.height)} · {formatWeight(player.weight)}
            </p>
          )}
        </div>
        <button type="button" className="fc-profile-share" onClick={onShare}>
          {copied ? 'Link copied!' : 'Share'}
        </button>
      </div>

      <div className="fc-profile-header__badges">
        <span
          className="fc-profile-lifecycle"
          style={{ borderColor: lifecycleColor(lifecycle), color: lifecycleColor(lifecycle) }}
        >
          {lifecycle}
        </span>
        {portalProfile?.portalStatus && (
          <span className="fc-profile-portal-status">{portalProfile.portalStatus.replace(/_/g, ' ')}</span>
        )}
        {player.stars != null && (
          <span className="fc-profile-stars">{player.stars}★</span>
        )}
        {player.committedTo && (
          <span className="fc-profile-commit">Committed: {player.committedTo}</span>
        )}
      </div>

      <div className="fc-profile-header__scores">
        <div className={`fc-score-card fc-score-card--${metrics.ufFitTier}`}>
          <span className="fc-score-card__label">UF Fit Score™</span>
          <span className="fc-score-card__value">{metrics.ufFitScore}</span>
          <span className="fc-score-card__tier">{fitTierLabel(metrics.ufFitTier)}</span>
        </div>
        <div className={`fc-score-card fc-score-card--portal fc-score-card--portal-${metrics.portalColor}`}>
          <span className="fc-score-card__label">Portal Likelihood</span>
          <span className="fc-score-card__value">{metrics.portalLikelihoodPct}%</span>
        </div>
        <div className="fc-score-card fc-score-card--signals">
          <span className="fc-score-card__label">Signals</span>
          <span className="fc-score-card__value">{metrics.signalCount}</span>
        </div>
      </div>
    </header>
  );
}
