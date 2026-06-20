'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { fetchRecruitingBoard } from '@/lib/recruiting-board-api';
import { formatRank } from '@/lib/recruiting-board-utils';
import { playerProfilePath, recruitingProfileLifecycle } from '@/lib/player-routes';
import { useRecruitingHubQuery } from '@/components/recruiting-hub/elite/useRecruitingHubQuery';
import {
  SIGNING_EVENTS,
  getSigningCountdown,
  type SigningEventId,
} from '@/components/recruiting-hub/elite/signing-day-utils';
import { displayRating, positionLabel, ufPercent, type EnrichedCommitPlayer } from '@/components/recruiting-hub/elite/class-commit-utils';
import './recruiting-hub.css';

const SIGNING_YEAR = 2027;

type SigningPayload = {
  players: EnrichedCommitPlayer[];
};

async function loadSigningPlayers(eventId: SigningEventId): Promise<SigningPayload> {
  const board = await fetchRecruitingBoard(SIGNING_YEAR);
  const commits = new Set((board.commits ?? []).map((p) => p.slug));
  const targets = (board.targets ?? []) as EnrichedCommitPlayer[];

  const pool =
    eventId === 'esp'
      ? targets.filter((p) => p.tier === 'TOP' || p.tier === 'HIGH')
      : targets.filter((p) => !commits.has(p.slug));

  const sorted = [...pool].sort((a, b) => {
    const ra = a.natlRank ?? a.natl ?? 9999;
    const rb = b.natlRank ?? b.natl ?? 9999;
    return ra - rb;
  });

  return { players: sorted };
}

type Props = {
  eventId: SigningEventId;
};

export function SigningDayPage({ eventId }: Props): React.ReactElement {
  const event = SIGNING_EVENTS[eventId];
  const load = useCallback(() => loadSigningPlayers(eventId), [eventId]);
  const { data, loading, error } = useRecruitingHubQuery(load);
  const countdown = getSigningCountdown(event);

  return (
    <div className="rh-page rh-page--elite mobile-app" data-testid={`rh-signing-page-${eventId}`}>
      <div className="rh-frame rh-elite-chrome rh-signing-page">
        <header className="rh-signing-page__header">
          <Link href="/vault/recruiting" className="rh-signing-page__back">
            ← Command Center
          </Link>
          <h1 className="rh-signing-page__title">{event.label}</h1>
          <p className="rh-signing-page__dates">{event.dateLabel}</p>
          {countdown.isLive ? (
            <span className="rh-badge rh-badge--live">{event.liveBadge}</span>
          ) : (
            <span className="rh-badge">{event.badge}</span>
          )}
        </header>

        {loading ? (
          <div className="rh-skeleton" style={{ minHeight: 200 }} aria-hidden="true" />
        ) : !data?.players.length ? (
          <section className="rh-card">
            <p className="rh-empty">
              {error
                ? 'Could not load signing board.'
                : eventId === 'esp'
                  ? 'No expected signees on the board right now.'
                  : 'No remaining targets on the board right now.'}
            </p>
          </section>
        ) : (
          <section className="rh-signing-page__list">
            {data.players.map((player) => {
              const uf = ufPercent(player);
              const href = playerProfilePath(
                player.slug,
                recruitingProfileLifecycle(player),
                true,
                player.name,
                'recruiting'
              );
              return (
                <article key={player.slug} className="rh-signing-page__row">
                  <div>
                    <h3 className="rh-signing-page__name">{player.name}</h3>
                    <p className="rh-signing-page__meta">
                      {positionLabel(player)} · NATL {formatRank(player.natlRank ?? player.natl)} · Rating{' '}
                      {displayRating(player)}
                    </p>
                  </div>
                  <div className="rh-signing-page__aside">
                    {uf != null ? <span className="rh-signing-page__uf">{uf}% UF</span> : null}
                    <Link href={href} className="rh-signing-page__link">
                      Profile →
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
