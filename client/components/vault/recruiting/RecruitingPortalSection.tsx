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
} from '@/lib/portal-prep';
import { RecruitingPanelHeader } from '@/components/recruiting-hub/RecruitingPanelHeader';

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
  const opensIn = daysLeft;
  const gapCount = (prep.rooms || []).reduce(
    (n, room) => n + ((room.gapFillers || []).length),
    0
  );

  return (
    <section className="gv-rh-portal-prep" data-testid="portal-prep">
      <RecruitingPanelHeader
        kicker={prep.window.label}
        title="Portal Room"
        dek={`${prep.thesis.addCount}. ${prep.thesis.not} Names land when they fill a roster hole.`}
        stats={[
          {
            label: windowOpen ? 'Window' : 'Opens in',
            value: windowOpen ? 'Open' : `${opensIn} day${opensIn === 1 ? '' : 's'}`,
          },
          { label: 'Hunt', value: prep.thesis.addCount.replace(/ difference makers$/i, '') || '10–12' },
          {
            label: 'Must add',
            value: prep.mustAdd.length ? prep.mustAdd.join(' · ') : '—',
          },
          {
            label: 'Gap fillers',
            value: gapCount ? String(gapCount) : 'Empty',
          },
        ]}
      />

      {prep.thesis.line ? <p className="gv-rh-portal-prep__thesis">{prep.thesis.line}</p> : null}

      <p
        className="gv-rh-portal-prep__empty gv-rh-portal-prep__empty--inline"
        data-testid="portal-incoming-empty"
      >
        {loading
          ? 'Loading verified names…'
          : incoming.length || gapCount
            ? 'Verified college transfers only — they have to fill the hole below.'
            : 'No verified gap-fillers yet. Rooms below are the holes. High-school remaining targets stay on Recruiting. When a transfer commits to Florida, they land on the class board with a Portal transfer stamp.'}
      </p>

      <div className="gv-rh-portal-prep__board">
        <h3 className="gv-rh-portal-prep__section-title">What the roster needs</h3>
        <ol className="gv-rh-portal-prep__rooms" data-testid="portal-rooms">
          {prep.rooms.map((room) => {
            const signed = (room.alreadySigned || []).map(portalChip).filter(Boolean) as FanPortalPrepChip[];
            const fillers = (room.gapFillers || []).map(portalChip).filter(Boolean) as FanPortalPrepChip[];
            return (
              <li key={room.room} className={`gv-rh-portal-room gv-rh-portal-room--${room.tier}`}>
                <span className="gv-rh-portal-room__rank">#{room.rank}</span>
                <div className="gv-rh-portal-room__main">
                  <div className="gv-rh-portal-room__head">
                    <h3 className="gv-rh-portal-room__pos">{room.room}</h3>
                    <span className="gv-rh-portal-room__tier">{room.tierLabel}</span>
                  </div>
                  <p className="gv-rh-portal-room__hunt">{room.hunt || room.dek}</p>
                  {room.dek && room.hunt && room.hunt !== room.dek ? (
                    <p className="gv-rh-portal-room__dek">{room.dek}</p>
                  ) : null}
                  <RoomChips label="Already signed (HS)" rows={signed} kind="signed" />
                  <RoomChips label="Gap fillers" rows={fillers} kind="gap" />
                  {!fillers.length ? (
                    <p className="gv-rh-portal-room__empty-gap" data-testid={`portal-gap-empty-${room.room}`}>
                      Scanning for a college transfer who actually fills this hole.
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/** @deprecated use PortalList */
export const RecruitingPortalSection = PortalList;
