'use client';

import React, { useEffect, useState } from 'react';
import { PlayerNavLink } from '@/components/vault/PlayerNavLink';
import { playerProfileRoute } from '@/lib/site-routes';
import type { NilEliteBundle, NilEliteRosterEarner } from '@/lib/nil-elite-api';

type Props = {
  hero: NilEliteBundle['hero'];
  money?: NilEliteBundle['money'];
  desk?: NilEliteBundle['desk'];
  topEarners?: NilEliteRosterEarner[];
};

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function TopFace({ player, rank }: { player: NilEliteRosterEarner; rank: number }) {
  const [failed, setFailed] = useState(false);
  const href = player.slug ? playerProfileRoute(player.slug, 'team') : undefined;
  const photo = player.slug ? `/headshots/${encodeURIComponent(player.slug)}.jpg` : '';
  const source =
    player.nilSourceLabel ||
    (player.nilSource === 'on3' ? 'On3' : player.nilSource === 'sideline' ? 'Sideline' : 'Est.');

  const inner = (
    <>
      <span className="nil-wow-face__rank">#{rank}</span>
      <span className="nil-wow-face__photo" aria-hidden>
        {photo && !failed ? (
          <img src={photo} alt="" onError={() => setFailed(true)} />
        ) : (
          <span>{initials(player.name)}</span>
        )}
      </span>
      <span className="nil-wow-face__copy">
        <strong>{player.name}</strong>
        <em>
          {player.position}
          {player.classLabel ? ` · ${player.classLabel}` : ''}
        </em>
      </span>
      <span className="nil-wow-face__val">
        <strong>{player.nilValuation}</strong>
        <em>{source}</em>
      </span>
    </>
  );

  if (href) {
    return (
      <PlayerNavLink href={href} className="nil-wow-face">
        {inner}
      </PlayerNavLink>
    );
  }
  return <div className="nil-wow-face">{inner}</div>;
}

export function NilHero({ hero, money, desk, topEarners = [] }: Props): React.ReactElement {
  const [live, setLive] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setLive(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const pool = hero.poolLabel || money?.schoolMarketLabel || money?.poolLabel || '—';
  const football = money?.footballMarketLabel || '—';
  const eliteM = money?.eliteMarketM ?? 65.3;
  const schoolM = money?.schoolMarketM ?? money?.rosterMarketM ?? null;
  const vsPct =
    desk?.stats?.vsElitePct ??
    money?.vsElitePct ??
    (schoolM != null && eliteM ? Math.round((schoolM / eliteM) * 1000) / 10 : null);
  const barPct = vsPct != null ? Math.max(8, Math.min(100, vsPct)) : 50;
  const faces = topEarners.slice(0, 3);
  const oneLiner =
    money?.secRank != null && money?.nationalRank != null
      ? `All-sport school market · SEC #${money.secRank} · Natl #${money.nationalRank}`
      : hero.poolCaption || 'All-sport school market';

  return (
    <section
      className={`nil-hero nil-hero--wow nil-bleed${live ? ' is-live' : ''}`}
      data-testid="nil-hero"
    >
      <div className="nil-hero__bg" aria-hidden />
      <div className="nil-hero__atmosphere" aria-hidden />

      <div className="nil-wow">
        <p className="nil-wow__brand">GatorVault</p>
        <h1 className="nil-wow__product">NIL</h1>

        <div className="nil-wow__market" aria-label={`${pool} all-sport school market`}>
          <span className="nil-wow__amount">{pool}</span>
          <span className="nil-wow__amount-label">{oneLiner}</span>
        </div>

        <div className="nil-wow__race" aria-label="Florida versus Texas school market">
          <div className="nil-wow__race-labels">
            <span>
              Florida <strong>{pool}</strong>
            </span>
            <span>
              Texas <strong>${Number(eliteM).toFixed(1)}M</strong>
            </span>
          </div>
          <div className="nil-wow__race-track">
            <div
              className="nil-wow__race-fill"
              style={{ width: live ? `${barPct}%` : '0%' }}
            />
          </div>
          <p className="nil-wow__race-note">
            {vsPct != null ? `${vsPct}% of the #1 school market` : 'Sideline Market Index'}
            {desk?.stats?.gapToEliteM != null
              ? ` · $${desk.stats.gapToEliteM.toFixed(1)}M behind`
              : ''}
          </p>
        </div>

        <p className="nil-wow__football">
          Football only <strong>{football}</strong>
          {desk?.stats?.footballSharePct != null
            ? ` · ${desk.stats.footballSharePct}% of school market`
            : ''}
        </p>

        {faces.length ? (
          <div className="nil-wow__faces" aria-label="Top Florida NIL valuations">
            <p className="nil-wow__faces-label">Top of the board</p>
            {faces.map((player, idx) => (
              <TopFace key={player.id} player={player} rank={idx + 1} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
