/**
 * Portal Watchlist card for FutureCast homepage.
 */
import React, { useMemo, useState } from 'react';
import type { PortalWatchlistHomePlayer } from '@/lib/futurecast-home-api';
import { portalLikelihoodBand } from '@/lib/portal-api';
import { playerProfilePath } from '@/lib/player-routes';
import { usePathname } from '@/lib/use-pathname';
import { isVaultPath } from '@/lib/vault-routes';

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

export function PortalWatchlistCard({
  player,
}: {
  player: PortalWatchlistHomePlayer;
}): React.ReactElement {
  const pathname = usePathname();
  const inVault = isVaultPath(pathname);
  const band = portalLikelihoodBand(player.portalLikelihood);
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = useMemo(() => headshotCandidates(player.slug), [player.slug]);
  const showPhoto = photoIndex < photos.length;

  return (
    <a
      href={playerProfilePath(player.slug, 'PORTAL', inVault)}
      className="fc-portal-card fc-home-portal-card"
    >
      <div className="fc-portal-card__inner">
        <div className="fc-portal-card__photo-wrap">
          {showPhoto ? (
            <img
              src={photos[photoIndex]}
              alt=""
              className="fc-portal-card__photo"
              onError={() => setPhotoIndex((i) => i + 1)}
            />
          ) : (
            <div className="fc-portal-card__photo fc-portal-card__photo--placeholder" aria-hidden>
              {playerInitials(player.fullName) || '?'}
            </div>
          )}
        </div>
        <div className="fc-portal-card__body">
          <span className="fc-portal-card__rank">#{player.rank}</span>
          <h3 className="fc-portal-card__name">{player.fullName}</h3>
          <p className="fc-portal-card__meta">
            {player.position} · Class of {player.classYear}
          </p>
          <div className="fc-portal-card__scores">
            <span className={`fc-portal-badge fc-portal-badge--${band}`}>
              Portal {player.portalLikelihood}%
            </span>
            <span className="fc-portal-metric">Depth risk {player.depthChartRisk}</span>
          </div>
        </div>
      </div>
    </a>
  );
}
