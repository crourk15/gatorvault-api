/**
 * Player Profile hero — identity, ranks, Fit / Intel panels.
 */
import React, { useCallback, useState } from 'react';
import type { PlayerCore, PortalProfile } from '../../../lib/player-api';
import type { PlayerMetrics } from '../../../lib/player-derived';
import {
  fitTierLabel,
  formatHeight,
  formatWeight,
  formatPlayerLocation,
  validStars,
} from '../../../lib/player-derived';
import { buildPlayerShareUrl } from '../../../lib/player-api';
import { PositionIcon } from '@/components/ui/PositionIcon';
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
  /** Freshest cleaned intel line for the Intel panel (optional). */
  latestIntel?: { label: string; text: string; when?: string | null } | null;
}

function lifecycleLabel(status: string): string {
  const s = String(status || '').toUpperCase();
  if (s === 'HS') return 'High school';
  if (s === 'COLLEGE') return 'College';
  if (s === 'PORTAL') return 'Portal';
  return status;
}

function rankCells(player: PlayerCore): Array<{ rank: string; label: string }> {
  const cells: Array<{ rank: string; label: string }> = [];
  if (player.rankingNational != null && player.rankingNational > 0) {
    cells.push({ rank: `#${player.rankingNational}`, label: 'NATL' });
  }
  if (player.rankingPosition != null && player.rankingPosition > 0) {
    cells.push({
      rank: `#${player.rankingPosition}`,
      label: String(player.position || 'POS').toUpperCase(),
    });
  }
  if (player.rankingState != null && player.rankingState > 0) {
    cells.push({
      rank: `#${player.rankingState}`,
      label: String(player.state || 'ST').toUpperCase(),
    });
  }
  return cells.slice(0, 3);
}

export function PlayerHeader({
  player,
  metrics,
  portalProfile,
  futurecastSummary = null,
  movementWindow = null,
  latestIntel = null,
}: PlayerHeaderProps): React.ReactElement {
  const pathname = usePathname();
  const inVault = isVaultPath(pathname);
  const [copied, setCopied] = useState(false);
  const location = formatPlayerLocation(player.hometown, player.state);
  const stars = validStars(player.stars);
  const ufPct =
    futurecastSummary?.gvProbability ??
    futurecastSummary?.ufProbability ??
    null;
  const moveDelta = movementWindow?.delta7d ?? futurecastSummary?.movementDelta ?? null;
  const ranks = rankCells(player);
  const composite =
    player.compositeRating != null && Number.isFinite(player.compositeRating)
      ? player.compositeRating <= 1
        ? (player.compositeRating * 100).toFixed(1)
        : player.compositeRating.toFixed(1)
      : null;
  const committed = Boolean(player.committedTo);
  const fitLabel = metrics.ufFitLabel ?? fitTierLabel(metrics.ufFitTier);

  const onShare = useCallback(async () => {
    const url = buildPlayerShareUrl(player.slug, player.status, inVault);
    const starBit = stars != null ? `${stars}★ ${player.position}` : player.position;
    const statusBit = player.committedTo
      ? `Committed to ${player.committedTo}`
      : `Class of ${player.classYear}`;
    const title = `${player.fullName} · ${starBit} | GatorVault`;
    const text = `${player.fullName} — ${statusBit}. Open the Vault profile:`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${title}\n${text}\n${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user cancelled share */
    }
  }, [
    player.fullName,
    player.slug,
    player.status,
    player.position,
    player.classYear,
    player.committedTo,
    stars,
    inVault,
  ]);

  return (
    <header className="fc-profile-header fc-profile-header--hero" data-testid="player-header">
      <div className="fc-profile-header__glow" aria-hidden />

      <div className="fc-profile-header__top">
        <div className="fc-profile-header__identity-block">
          <p className="fc-profile-header__position">
            <PositionIcon
              position={player.position}
              size="sm"
              variant="on-blue"
              showLabel={false}
              className="fc-profile-header__pos-icon"
            />
            {player.position} · Class of {player.classYear}
          </p>
          <h1 className="fc-profile-header__name gv-h1">{player.fullName}</h1>
          <p className="fc-profile-header__identity-line">
            {stars != null ? <span className="fc-profile-header__stars">{stars}★</span> : null}
            {location ? <span>{location}</span> : null}
            {player.height || player.weight ? (
              <span>
                {formatHeight(player.height)}
                {player.weight ? ` · ${formatWeight(player.weight)}` : ''}
              </span>
            ) : null}
          </p>
        </div>
        <button type="button" className="fc-profile-share" onClick={onShare}>
          {copied ? 'Link copied!' : 'Share'}
        </button>
      </div>

      <div className="fc-profile-header__status-row">
        {committed ? (
          <span className="fc-profile-header__stamp fc-profile-header__stamp--committed">
            Committed · {player.committedTo}
          </span>
        ) : portalProfile?.portalStatus ? (
          <span className="fc-profile-header__stamp">
            {portalProfile.portalStatus.replace(/_/g, ' ')}
          </span>
        ) : (
          <span className="fc-profile-header__stamp fc-profile-header__stamp--muted">
            {lifecycleLabel(player.status)}
          </span>
        )}
        {ufPct != null ? (
          <span className="fc-profile-header__metric">UF {Math.round(ufPct)}%</span>
        ) : null}
        {moveDelta != null && Number(moveDelta) !== 0 ? (
          <span className={`fc-profile-move ${Number(moveDelta) > 0 ? 'is-up' : 'is-down'}`}>
            {Number(moveDelta) > 0 ? '▲' : '▼'} {Number(moveDelta) > 0 ? '+' : ''}
            {Math.round(Number(moveDelta))} / 7d
          </span>
        ) : null}
      </div>

      {ranks.length ? (
        <ul className="fc-profile-header__rank-strip" aria-label="Rankings">
          {ranks.map((cell) => (
            <li key={`${cell.rank}-${cell.label}`} className="fc-profile-header__rank-cell">
              <span className="fc-profile-header__rank-num">{cell.rank}</span>
              <span className="fc-profile-header__rank-label">{cell.label}</span>
            </li>
          ))}
          {composite ? (
            <li className="fc-profile-header__rank-cell fc-profile-header__rank-cell--composite">
              <span className="fc-profile-header__rank-num">{composite}</span>
              <span className="fc-profile-header__rank-label">Composite</span>
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="fc-profile-header__scores">
        <div className={`fc-score-card fc-score-card--elite-panel fc-score-card--${metrics.ufFitTier}`}>
          <span className="fc-score-card__label">UF Fit</span>
          <span className="fc-score-card__value">{metrics.ufFitScore}</span>
          <span className="fc-score-card__tier">{fitLabel}</span>
        </div>
        {!metrics.portalHidden ? (
          <div
            className={`fc-score-card fc-score-card--elite-panel fc-score-card--portal fc-score-card--portal-${metrics.portalColor}`}
          >
            <span className="fc-score-card__label">Portal odds</span>
            <span className="fc-score-card__value">{metrics.portalLikelihoodPct ?? 0}%</span>
            <span className="fc-score-card__tier">Likelihood</span>
          </div>
        ) : null}
        <div className="fc-score-card fc-score-card--elite-panel fc-score-card--signals">
          <span className="fc-score-card__label">Intel</span>
          {latestIntel?.text ? (
            <>
              <p className="fc-score-card__intel-text">{latestIntel.text}</p>
              <span className="fc-score-card__tier">
                {latestIntel.label}
                {latestIntel.when ? ` · ${latestIntel.when}` : ''}
              </span>
            </>
          ) : (
            <>
              <span className="fc-score-card__value">{metrics.signalCount}</span>
              <span className="fc-score-card__tier">
                {metrics.signalCount === 1 ? 'Recent hit' : 'Recent hits'}
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
