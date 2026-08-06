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
  formatPlayerLocation,
  lifecycleColor,
  validStars,
} from '../../../lib/player-derived';
import { buildPlayerShareUrl } from '../../../lib/player-api';
import { PositionIcon } from '@/components/ui/PositionIcon';
import { Chip, portalStatusToChipVariant } from '@/components/ui/Chip';
import { usePathname } from '@/lib/use-pathname';
import { isVaultPath } from '@/lib/vault-routes';
import type {
  FullProfileFuturecastSummary,
  FullProfileMovementWindow,
} from '@/lib/player-full-profile-api';

export interface PlayerHeaderProps {
  player: PlayerCore;
  metrics: PlayerMetrics;
  portalProfile: PortalProfile | null;
  futurecastSummary?: FullProfileFuturecastSummary | null;
  movementWindow?: FullProfileMovementWindow | null;
}

function playerInitials(fullName: string, position: string | null | undefined): string {
  const parts = String(fullName || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase() || '').join('');
  if (initials) return initials;
  return String(position || 'GV').slice(0, 2).toUpperCase();
}

export function PlayerHeader({
  player,
  metrics,
  portalProfile,
  futurecastSummary = null,
  movementWindow = null,
}: PlayerHeaderProps): React.ReactElement {
  const pathname = usePathname();
  const inVault = isVaultPath(pathname);
  const [copied, setCopied] = useState(false);
  const lifecycle = player.status;
  const location = formatPlayerLocation(player.hometown, player.state);
  const stars = validStars(player.stars);
  const initials = playerInitials(player.fullName, player.position);
  const ufPct =
    futurecastSummary?.gvProbability ??
    futurecastSummary?.ufProbability ??
    null;
  const fitPct = futurecastSummary?.fitScore ?? metrics.ufFitScore ?? null;
  const moveDelta = movementWindow?.delta7d ?? futurecastSummary?.movementDelta ?? null;

  const onShare = useCallback(async () => {
    const url = buildPlayerShareUrl(player.slug, player.status, inVault);
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
  }, [player.fullName, player.slug, player.status, inVault]);

  return (
    <header className="fc-profile-header fc-profile-header--elite" data-testid="player-header">
      <div className="fc-profile-header__top">
        <div className="fc-profile-header__identity">
          <div className="fc-profile-header__mark" aria-hidden>
            {initials}
          </div>
          <div>
            <p className="fc-profile-header__position">
              <PositionIcon position={player.position} size="sm" variant="on-blue" showLabel={false} className="fc-profile-header__pos-icon" />
              {player.position} · Class of {player.classYear}
            </p>
            <h1 className="fc-profile-header__name gv-h1">{player.fullName}</h1>
            {location && <p className="fc-profile-header__location">{location}</p>}
            {(player.height || player.weight) && (
              <p className="fc-profile-header__measurables">
                {formatHeight(player.height)} · {formatWeight(player.weight)}
              </p>
            )}
          </div>
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
          <Chip variant={portalStatusToChipVariant(portalProfile.portalStatus)}>
            {portalProfile.portalStatus.replace(/_/g, ' ')}
          </Chip>
        )}
        {stars != null && (
          <span className="fc-profile-stars">{stars}★</span>
        )}
        {player.committedTo && (
          <span className="fc-profile-commit">Committed: {player.committedTo}</span>
        )}
        {ufPct != null ? <span className="fc-profile-commit">UF {Math.round(ufPct)}%</span> : null}
        {fitPct != null ? <span className="fc-profile-commit">Fit {Math.round(fitPct)}%</span> : null}
        {moveDelta != null && Number(moveDelta) !== 0 ? (
          <span className={`fc-profile-move ${Number(moveDelta) > 0 ? 'is-up' : 'is-down'}`}>
            {Number(moveDelta) > 0 ? '▲' : '▼'} {Number(moveDelta) > 0 ? '+' : ''}
            {Math.round(Number(moveDelta))} / 7d
          </span>
        ) : null}
      </div>

      <div className="fc-profile-header__scores">
        <div className={`fc-score-card fc-score-card--${metrics.ufFitTier}`}>
          <span className="fc-score-card__label">UF Fit Score™</span>
          <span className="fc-score-card__value">{metrics.ufFitScore}</span>
          <span className="fc-score-card__tier">
            {metrics.ufFitLabel ?? fitTierLabel(metrics.ufFitTier)}
          </span>
        </div>
        {!metrics.portalHidden ? (
          <div className={`fc-score-card fc-score-card--portal fc-score-card--portal-${metrics.portalColor}`}>
            <span className="fc-score-card__label">Portal Likelihood</span>
            <span className="fc-score-card__value">{metrics.portalLikelihoodPct ?? 0}%</span>
          </div>
        ) : null}
        <div className="fc-score-card fc-score-card--signals">
          <span className="fc-score-card__label">Signals</span>
          <span className="fc-score-card__value">{metrics.signalCount}</span>
        </div>
      </div>
    </header>
  );
}
