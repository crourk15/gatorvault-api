'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { fetchRecruitingPortalPayload } from '@/lib/recruiting-api';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { PlayerCardEnhanced } from '@/components/vault/recruiting/EliteRecruitCard';
import { schoolLogoInitials } from '@/lib/recruiting-hub-utils';
import { playerProfilePath } from '@/lib/player-routes';
import {
  PORTAL_PREP_SEED,
  daysUntilPortalOpen,
  portalChip,
  type FanPortalPrep,
  type FanPortalPrepChip,
} from '@/lib/portal-prep';
import { RecruitingPanelHeader } from '@/components/recruiting-hub/RecruitingPanelHeader';
import { EliteCommitBoard } from '@/components/recruiting-hub/elite/EliteCommitBoard';
import { RemainingTargetsStrip } from '@/components/recruiting-hub/elite/RemainingTargetsStrip';
import { RecruitingHubBundleProvider } from '@/components/recruiting-hub/elite/RecruitingHubBundleContext';
import { useRecruitingHubBundle } from '@/components/recruiting-hub/elite/useRecruitingHubBundle';
import '@/components/recruiting-hub/elite/recruiting-hub.css';

function incomingName(p: RecruitingBoardPlayer): string {
  return String(p.name || '').trim() || 'Portal target';
}

function chipHref(chip: FanPortalPrepChip): string {
  return playerProfilePath(chip.slug, 'HIGH_SCHOOL', true, chip.name, 'recruiting');
}

function chipLabel(chip: FanPortalPrepChip): string {
  const bits = [chip.name];
  if (chip.natlRank) bits.push(`#${chip.natlRank}`);
  if (chip.status === 'flip' && chip.committedTo) bits.push(chip.committedTo);
  return bits.join(' · ');
}

function RoomChips({
  label,
  rows,
  kind,
}: {
  label: string;
  rows: FanPortalPrepChip[];
  kind: 'signed' | 'recruiting';
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

function PortalClassList(): React.ReactElement {
  const bundle = useRecruitingHubBundle(2027);
  return (
    <RecruitingHubBundleProvider value={bundle}>
      <div className="gv-rh-portal-prep__class" data-testid="portal-class-list">
        <EliteCommitBoard year={2027} />
        <RemainingTargetsStrip year={2027} />
      </div>
    </RecruitingHubBundleProvider>
  );
}

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

  return (
    <section className="gv-rh-portal-prep" data-testid="portal-prep">
      <RecruitingPanelHeader
        kicker={prep.window.label}
        title="Portal War Room"
        dek={`${prep.thesis.addCount}. ${prep.thesis.not} ${prep.namesLandWhen}`}
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
            label: 'Incoming',
            value: incoming.length ? String(incoming.length) : 'Empty',
          },
        ]}
      />

      {prep.thesis.line ? <p className="gv-rh-portal-prep__thesis">{prep.thesis.line}</p> : null}

      {incoming.length > 0 ? (
        <div className="gv-rh-portal-prep__incoming" data-testid="portal-incoming">
          <h3 className="gv-rh-portal-prep__section-title">Incoming</h3>
          <div className="gv-rh-portal-grid" data-testid="portal-grid">
            {incoming.map((p) => (
              <article key={p.slug} className="gv-rh-portal-card gv-rh-portal-card--in">
                <span className="gv-rh-portal-card__badge gv-rh-portal-card__badge--in">IN</span>
                <PlayerCardEnhanced
                  forceElite
                  variant="target"
                  player={{
                    slug: p.slug,
                    name: incomingName(p),
                    position: p.position || p.pos || undefined,
                    classYear: p.classYear,
                    fitScore: p.fitScore ?? undefined,
                    lifecycle: 'PORTAL',
                    movementDirection: 'up',
                    school: p.fromSchool || p.school || undefined,
                    predictionSchools:
                      p.fromSchool || p.school
                        ? [{ school: String(p.fromSchool || p.school), pct: 0 }]
                        : undefined,
                  }}
                />
                {(p.fromSchool || p.school) && (
                  <div className="gv-rh-portal-card__school">
                    <span className="gv-rh-portal-card__school-logo" aria-hidden="true">
                      {schoolLogoInitials(String(p.fromSchool || p.school))}
                    </span>
                    <span>Previous: {p.fromSchool || p.school}</span>
                  </div>
                )}
                <a
                  href={playerProfilePath(p.slug, 'PORTAL', true, incomingName(p), 'recruiting')}
                  className="gv-rh-portal-card__link"
                >
                  View profile →
                </a>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <p
          className="gv-rh-portal-prep__empty gv-rh-portal-prep__empty--inline"
          data-testid="portal-incoming-empty"
        >
          {loading
            ? 'Loading verified names…'
            : 'Incoming portal names stay empty until a transfer is verified. The 2027 class below is the live board.'}
        </p>
      )}

      <div className="gv-rh-portal-prep__board">
        <h3 className="gv-rh-portal-prep__section-title">Position rooms</h3>
        <ol className="gv-rh-portal-prep__rooms" data-testid="portal-rooms">
          {prep.rooms.map((room) => {
            const signed = (room.alreadySigned || []).map(portalChip).filter(Boolean) as FanPortalPrepChip[];
            const recruiting = (room.stillRecruiting || []).map(portalChip).filter(Boolean) as FanPortalPrepChip[];
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
                  <RoomChips label="2027 commits" rows={signed} kind="signed" />
                  <RoomChips
                    label="Still recruiting"
                    rows={recruiting}
                    kind="recruiting"
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <PortalClassList />
    </section>
  );
}

/** @deprecated use PortalList */
export const RecruitingPortalSection = PortalList;
