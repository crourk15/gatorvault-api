'use client';

import React, { useMemo } from 'react';
import type { PortalPlayer } from '@/components/recruiting-hub/utils/portalData';
import { filterPortalPlayers } from '@/components/recruiting-hub/utils/portalData';
import { playerProfilePath } from '@/lib/player-routes';

export type PortalCardProps = {
  direction: 'incoming' | 'outgoing';
  name: string;
  position: string;
  slug?: string;
  lines: { label: string; value: string }[];
};

export function PortalCard({ direction, name, position, slug, lines }: PortalCardProps): React.ReactElement {
  return (
    <article className={`rh-portal-card rh-portal-card--${direction}`}>
      <span className="rh-portal-card__badge">{direction === 'incoming' ? 'IN' : 'OUT'}</span>
      <h4 className="rh-portal-card__name">{name}</h4>
      <p className="rh-portal-card__pos">{position}</p>
      <dl className="rh-portal-card__meta">
        {lines.map((line) => (
          <div key={line.label}>
            <dt>{line.label}</dt>
            <dd>{line.value}</dd>
          </div>
        ))}
      </dl>
      {slug && direction === 'incoming' ? (
        <a href={playerProfilePath(slug, 'target', true, name, 'recruiting')} className="rh-portal-card__link">
          View intel →
        </a>
      ) : null}
    </article>
  );
}

function playerPosition(p: PortalPlayer): string {
  return p.position || p.pos || '—';
}

function nilProjection(p: PortalPlayer): string {
  const stars = p.stars ?? 4;
  const base = stars >= 5 ? 180 : stars >= 4 ? 95 : 45;
  return `$${base}K–$${base * 2}K`;
}

function impactScore(p: PortalPlayer): number {
  const fit = p.fitScore ?? 50;
  const prob = p.ufProbability != null ? (p.ufProbability <= 1 ? p.ufProbability * 100 : p.ufProbability) : 40;
  return Math.round((fit + prob) / 2);
}

type ColumnProps = {
  title: string;
  children: React.ReactNode;
};

export function PortalColumn({ title, children }: ColumnProps): React.ReactElement {
  return (
    <div className="rh-portal-column">
      <h3 className="rh-portal-column__title">{title}</h3>
      <div className="rh-portal-column__stack">{children}</div>
    </div>
  );
}

type SectionProps = {
  incoming: PortalPlayer[];
  targets: PortalPlayer[];
  outgoing: PortalPlayer[];
};

export function PortalTrackerSection({ incoming, targets, outgoing }: SectionProps): React.ReactElement {
  const incomingRows = useMemo(
    () => filterPortalPlayers([...incoming, ...targets]).filter((p) => p.portalStatus === 'in' || p.portalStatus === 'target'),
    [incoming, targets]
  );
  const outgoingRows = useMemo(
    () => filterPortalPlayers(outgoing).filter((p) => p.portalStatus === 'out'),
    [outgoing]
  );

  return (
    <section className="rh-section rh-section--panel rh-container" data-testid="rh-portal-tracker-section">
      <h2 className="rh-section__title">Portal Tracker</h2>
      <div className="rh-portal-grid">
        <PortalColumn title="Incoming Portal Targets">
          {incomingRows.length === 0 ? (
            <p className="rh-section__empty">No incoming portal targets flagged — flip commits appear here when active.</p>
          ) : (
            incomingRows.map((p) => (
              <PortalCard
                key={p.slug}
                direction="incoming"
                name={p.name}
                position={playerPosition(p)}
                slug={p.slug}
                lines={[
                  { label: 'Status', value: p.portalStatus === 'target' ? 'Portal target' : 'Incoming' },
                  { label: 'Previous', value: p.fromSchool || p.school || '—' },
                  { label: 'Impact score', value: String(impactScore(p)) },
                  { label: 'NIL projection', value: nilProjection(p) },
                  { label: 'Competing', value: p.committedTo ?? 'Open' },
                ]}
              />
            ))
          )}
        </PortalColumn>
        <PortalColumn title="Outgoing Portal">
          {outgoingRows.length === 0 ? (
            <p className="rh-section__empty">No outgoing transfers flagged this cycle.</p>
          ) : (
            outgoingRows.map((p) => (
              <PortalCard
                key={p.slug}
                direction="outgoing"
                name={p.name}
                position={playerPosition(p)}
                lines={[
                  { label: 'Destination', value: p.committedTo && p.committedTo !== 'Florida' ? p.committedTo : 'TBD' },
                  { label: 'Previous', value: p.fromSchool || p.school || 'Florida' },
                ]}
              />
            ))
          )}
        </PortalColumn>
      </div>
    </section>
  );
}
