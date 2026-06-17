'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
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

function impactScore(p: HighPriorityPlayer): number {
  const fit = p.fitScore ?? 50;
  const prob = p.ufProbability != null ? (p.ufProbability <= 1 ? p.ufProbability * 100 : p.ufProbability) : 40;
  return Math.round((fit + prob) / 2);
}

function nilProjection(p: HighPriorityPlayer): string {
  const stars = p.stars ?? 4;
  const base = stars >= 5 ? 180 : stars >= 4 ? 95 : 45;
  return `$${base}K–$${base * 2}K`;
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
  highPriority: HighPriorityPlayer[];
  targets: RecruitingBoardPlayer[];
};

export function PortalTrackerSection({ highPriority, targets }: SectionProps): React.ReactElement {
  const incoming = highPriority.filter((p) => p.committedTo && p.committedTo !== 'Florida').slice(0, 4);
  const outgoing = targets.filter((p) => p.committedTo === 'Florida' && p.movementDirection === 'down').slice(0, 4);

  return (
    <section className="rh-section rh-container" data-testid="rh-portal-tracker-section">
      <h2 className="rh-section__title">Portal Tracker</h2>
      <div className="rh-portal-grid">
        <PortalColumn title="Incoming Portal Targets">
          {incoming.length === 0 ? (
            <p className="rh-section__empty">No incoming portal targets flagged — flip commits appear here when active.</p>
          ) : (
            incoming.map((p) => (
              <PortalCard
                key={p.slug}
                direction="incoming"
                name={p.name}
                position={p.position}
                slug={p.slug}
                lines={[
                  { label: 'Eligibility', value: 'Immediate' },
                  { label: 'Impact score', value: String(impactScore(p)) },
                  { label: 'NIL projection', value: nilProjection(p) },
                  { label: 'Competing', value: p.committedTo ?? 'Open' },
                ]}
              />
            ))
          )}
        </PortalColumn>
        <PortalColumn title="Outgoing Portal">
          {outgoing.length === 0 ? (
            <p className="rh-section__empty">No outgoing transfers flagged this cycle.</p>
          ) : (
            outgoing.map((p) => (
              <PortalCard
                key={p.slug}
                direction="outgoing"
                name={p.name}
                position={p.position || p.pos || '—'}
                lines={[
                  { label: 'Destination', value: 'TBD' },
                  { label: 'Reason', value: 'Playing time / NIL / depth chart' },
                ]}
              />
            ))
          )}
        </PortalColumn>
      </div>
    </section>
  );
}
