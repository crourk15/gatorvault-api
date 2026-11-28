'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { fetchRecruitingPortalPayload } from '@/lib/recruiting-api';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { playerProfilePath } from '@/lib/player-routes';
import {
  PORTAL_PREP_SEED,
  daysUntilPortalOpen,
  portalChip,
  type FanPortalPrep,
  type FanPortalPrepChip,
  type FanPortalPrepRoom,
} from '@/lib/portal-prep';

function chipHref(chip: FanPortalPrepChip): string {
  const gap = chip.status === 'gap';
  return playerProfilePath(
    chip.slug,
    gap ? 'PORTAL' : 'HIGH_SCHOOL',
    true,
    chip.name,
    gap ? 'futurecast' : 'recruiting'
  );
}

function chipLabel(chip: FanPortalPrepChip): string {
  const bits = [chip.name];
  if (chip.natlRank) bits.push(`#${chip.natlRank}`);
  if (chip.committedTo) bits.push(chip.committedTo);
  return bits.join(' · ');
}

function RoomChips({
  label,
  rows,
  kind,
}: {
  label: string;
  rows: FanPortalPrepChip[];
  kind: 'signed' | 'gap';
}): React.ReactElement | null {
  if (!rows.length) return null;
  return (
    <div className={`gv-rh-portal-room__chips gv-rh-portal-room__chips--${kind}`}>
      <p className="gv-rh-portal-room__chip-label">{label}</p>
      <ul className="gv-rh-portal-room__signed">
        {rows.map((chip) => {
          const href = chip.slug ? chipHref(chip) : '';
          const text = chipLabel(chip);
          return (
            <li key={chip.slug || chip.name}>
              {href ? <a href={href}>{text}</a> : text}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function isHuntRoom(tier: string): boolean {
  return tier === 'must-add' || tier === 'high';
}

function RoomCard({
  room,
  compact,
}: {
  room: FanPortalPrepRoom;
  compact?: boolean;
}): React.ReactElement {
  const signed = (room.alreadySigned || []).map(portalChip).filter(Boolean) as FanPortalPrepChip[];
  const fillers = (room.gapFillers || []).map(portalChip).filter(Boolean) as FanPortalPrepChip[];
  const hunt = room.hunt || room.dek;
  return (
    <li
      className={`gv-rh-portal-room gv-rh-portal-room--${room.tier}${compact ? ' gv-rh-portal-room--hold' : ''}`}
    >
      <span className="gv-rh-portal-room__rank">#{room.rank}</span>
      <div className="gv-rh-portal-room__main">
        <div className="gv-rh-portal-room__head">
          <h3 className="gv-rh-portal-room__pos">{room.room}</h3>
          <span className="gv-rh-portal-room__tier">{room.tierLabel}</span>
        </div>
        {hunt ? <p className="gv-rh-portal-room__hunt">{hunt}</p> : null}
        <RoomChips label="On the 2027 board" rows={signed} kind="signed" />
        <RoomChips label="Fits this hole" rows={fillers} kind="gap" />
        {!compact && !fillers.length ? (
          <p className="gv-rh-portal-room__empty-gap" data-testid={`portal-gap-empty-${room.room}`}>
            No verified transfer yet — only a college player who can start this room.
          </p>
        ) : null}
      </div>
    </li>
  );
}

/** FutureCast Portal Room — roster holes first, then only verified gap-fillers. */
export function PortalList(): React.ReactElement {
  const [prep, setPrep] = useState<FanPortalPrep>(PORTAL_PREP_SEED);
  const [incoming, setIncoming] = useState<RecruitingBoardPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchRecruitingPortalPayload()
      .then((data) => {
        if (cancelled) return;
        if (data.prep && Array.isArray(data.prep.rooms) && data.prep.rooms.length > 0) {
          setPrep(data.prep);
        }
        setIncoming(Array.isArray(data.incoming) ? data.incoming : []);
      })
      .catch(() => {
        if (cancelled) return;
        setIncoming([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const daysLeft = useMemo(
    () => daysUntilPortalOpen(prep.window.opens),
    [prep.window.opens]
  );
  const windowOpen = prep.season?.active === true;
  const huntRooms = (prep.rooms || []).filter((row) => isHuntRoom(row.tier));
  const holdRooms = (prep.rooms || []).filter((row) => !isHuntRoom(row.tier));
  const gapCount = (prep.rooms || []).reduce(
    (n, room) => n + ((room.gapFillers || []).length),
    0
  );

  return (
    <section className="gv-rh-portal-prep fc-portal-room" data-testid="portal-prep">
      <header className="fc-portal-room__head">
        <p className="fc-portal-room__kicker">{prep.window.label}</p>
        <h2 className="fc-portal-room__title">Portal Room</h2>
        <p className="fc-portal-room__dek">
          {prep.thesis.addCount}. {prep.thesis.not} Names land when they fill a roster hole.
        </p>
        <div className="fc-portal-room__pills" role="list">
          <span role="listitem">
            {windowOpen ? 'Window open' : `Opens in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
          </span>
          <span role="listitem">
            Must add {prep.mustAdd.length ? prep.mustAdd.join(' · ') : '—'}
          </span>
          <span role="listitem">{prep.thesis.addCount.replace(/ difference makers$/i, '') || '10–12'}</span>
          <span role="listitem">{gapCount ? `${gapCount} gap filler${gapCount === 1 ? '' : 's'}` : 'Scanning'}</span>
        </div>
        <ol className="fc-portal-room__steps" data-testid="portal-room-steps">
          <li>
            <strong>Hole</strong>
            What the upcoming roster still needs.
          </li>
          <li>
            <strong>Scan</strong>
            A college transfer who actually plays that room — not a random name.
          </li>
          <li>
            <strong>Class</strong>
            He joins Recruiting with a Portal transfer stamp.
          </li>
        </ol>
      </header>

      <p className="fc-portal-room__note" data-testid="portal-incoming-empty">
        {loading
          ? 'Loading verified names…'
          : incoming.length || gapCount
            ? 'Verified college transfers only — they have to fill the hole.'
            : 'No verified gap-fillers yet. High-school remaining targets stay on Recruiting.'}
      </p>

      <div className="gv-rh-portal-prep__board">
        <h3 className="gv-rh-portal-prep__section-title">Must buy</h3>
        <ol className="gv-rh-portal-prep__rooms gv-rh-portal-prep__rooms--hunt" data-testid="portal-rooms">
          {huntRooms.map((room) => (
            <RoomCard key={room.room} room={room} />
          ))}
        </ol>
      </div>

      {holdRooms.length ? (
        <div className="gv-rh-portal-prep__board gv-rh-portal-prep__board--hold">
          <h3 className="gv-rh-portal-prep__section-title">Hold the room</h3>
          <ol className="gv-rh-portal-prep__rooms gv-rh-portal-prep__rooms--hold" data-testid="portal-hold-rooms">
            {holdRooms.map((room) => (
              <RoomCard key={room.room} room={room} compact />
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

/** @deprecated use PortalList */
export const RecruitingPortalSection = PortalList;
