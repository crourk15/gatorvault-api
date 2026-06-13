'use client';

import React from 'react';
import {
  isPortalRosterPlayer,
  portalRosterLabel,
  type RosterPlayer,
} from '@/lib/roster-api';
import { playerProfilePath } from '@/lib/player-routes';

const ACE_PORTAL_SLUG = 'eric-singleton-jr';

export function RosterProfilePage({
  player,
  backHref = '/vault/team',
  backLabel = '← Team',
}: {
  player: RosterPlayer;
  backHref?: string;
  backLabel?: string;
}): React.ReactElement {
  const portalTag = portalRosterLabel(player);
  const isAce = player.slug === ACE_PORTAL_SLUG;

  return (
    <div className="gv-roster-profile" data-testid="roster-profile-page">
      <nav className="fc-profile-back">
        <a href={backHref}>{backLabel}</a>
      </nav>
      <header className={`gv-roster-profile__header${isAce ? ' gv-roster-profile__header--ace' : ''}`}>
        {isAce && <span className="gv-roster-profile__ace-badge">ACE Portal Get</span>}
        {portalTag && (
          <span className="gv-roster-profile__portal-tag">{portalTag}</span>
        )}
        <h1 className="gv-roster-profile__name">{player.name}</h1>
        <p className="gv-roster-profile__meta">
          {player.pos || player.position} · {player.year || player.class || '—'} ·{' '}
          {player.height && player.weight ? `${player.height} / ${player.weight}` : '—'}
        </p>
        {player.hometown && <p className="gv-roster-profile__hometown">{player.hometown}</p>}
        {player.transferInfo && (
          <p className="gv-roster-profile__transfer">{player.transferInfo}</p>
        )}
        {player.bio && <p className="gv-roster-profile__bio">{player.bio}</p>}
        <div className="gv-roster-profile__stats">
          {player.vaultGrade != null && (
            <span className="gv-roster-profile__stat">Vault Grade {player.vaultGrade}</span>
          )}
          {player.stars != null && (
            <span className="gv-roster-profile__stat">{player.stars}★</span>
          )}
          {player.depthChartTier && (
            <span className="gv-roster-profile__stat">Depth: {player.depthChartTier}</span>
          )}
        </div>
      </header>
      {isPortalRosterPlayer(player) && (
        <p className="gv-roster-profile__portal-link">
          <a href={playerProfilePath(player.slug, 'PORTAL', true)}>View Portal Intel →</a>
        </p>
      )}
    </div>
  );
}
