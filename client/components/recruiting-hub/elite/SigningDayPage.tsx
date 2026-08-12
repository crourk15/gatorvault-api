'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { fetchRecruitingBoard } from '@/lib/recruiting-board-api';
import { formatRank } from '@/lib/recruiting-board-utils';
import { playerProfilePath, recruitingProfileLifecycle } from '@/lib/player-routes';
import { useRecruitingHubQuery } from '@/components/recruiting-hub/elite/useRecruitingHubQuery';
import {
  getSigningEvents,
  getSigningCountdown,
  selectSigningBoardPlayers,
  type SigningEventId,
} from '@/components/recruiting-hub/elite/signing-day-utils';
import { parseRecruitingClassYear } from '@/lib/recruiting-cycle';
import {
  setRecruitingClassYearStore,
  useRecruitingClassYear,
} from '@/lib/recruiting-class-year-store';
import {
  displayRating,
  positionLabel,
  ufPercent,
  type EnrichedCommitPlayer,
} from '@/components/recruiting-hub/elite/class-commit-utils';
import './recruiting-hub.css';

type SigningPayload = {
  players: EnrichedCommitPlayer[];
};

async function loadSigningPlayers(
  eventId: SigningEventId,
  classYear: number
): Promise<SigningPayload> {
  const board = await fetchRecruitingBoard(classYear);
  const players = selectSigningBoardPlayers(
    eventId,
    board,
    classYear
  ) as EnrichedCommitPlayer[];
  return { players };
}

type Props = {
  eventId: SigningEventId;
};

export function SigningDayPage({ eventId }: Props): React.ReactElement {
  const searchParams = useSearchParams();
  const { activeYear } = useRecruitingClassYear();
  const classYear = useMemo(() => {
    const fromQuery = searchParams?.get('year');
    return parseRecruitingClassYear(fromQuery, activeYear);
  }, [searchParams, activeYear]);

  // Keep hub year tabs in sync when deep-linking ?year=2028.
  useEffect(() => {
    setRecruitingClassYearStore(classYear, { pin: true });
  }, [classYear]);

  const event = getSigningEvents(classYear)[eventId];
  const load = useCallback(
    () => loadSigningPlayers(eventId, classYear),
    [eventId, classYear]
  );
  const { data, loading, error } = useRecruitingHubQuery(load);
  const countdown = getSigningCountdown(event);

  return (
    <div
      className="rh-page rh-page--elite mobile-app"
      data-testid={`rh-signing-page-${eventId}`}
      data-class-year={classYear}
    >
      <div className="rh-frame rh-elite-chrome rh-signing-page">
        <header className="rh-signing-page__header">
          <Link href="/vault/recruiting" className="rh-signing-page__back">
            ← Recruiting
          </Link>
          <h1 className="rh-signing-page__title">{event.label}</h1>
          <p className="rh-signing-page__dates">
            Class of {classYear} · {event.dateLabel}
          </p>
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
                  ? `No expected ${classYear} signees on the board right now.`
                  : `No remaining ${classYear} targets on the board right now.`}
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
                      {positionLabel(player)} · NATL {formatRank(player.natlRank ?? player.natl)} ·
                      Rating {displayRating(player)}
                    </p>
                  </div>
                  <div className="rh-signing-page__aside">
                    {eventId === 'esp' ? (
                      <span className="rh-signing-page__uf">UF commit</span>
                    ) : uf != null ? (
                      <span className="rh-signing-page__uf">{uf}% UF</span>
                    ) : null}
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
