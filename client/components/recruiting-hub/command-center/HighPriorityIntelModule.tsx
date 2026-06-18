'use client';

import React from 'react';
import type { HighPriorityIntelItem, HighPriorityIntelType } from '@/components/recruiting-hub/HighPriorityIntel/types';
import { formatIntelUpdated } from '@/components/recruiting-hub/utils/formatDate';
import { playerProfilePath } from '@/lib/player-routes';
import { playerProfileRoute } from '@/lib/site-routes';
import { ModuleShell, MovementBadge, UfProbBar } from './primitives';

type Props = {
  items: HighPriorityIntelItem[];
  loading?: boolean;
  lastUpdated?: string | null;
};

function intelIcon(type: HighPriorityIntelType): string {
  switch (type) {
    case 'BATTLE':
      return '⚠️';
    case 'VISIT':
      return '📍';
    case 'RPM':
      return '🎯';
    case 'NIL':
      return '💰';
    case 'HEAT':
      return '🔥';
    default:
      return 'ℹ️';
  }
}

function IntelCard({ item }: { item: HighPriorityIntelItem }): React.ReactElement {
  const pct = Math.max(0, Math.min(100, Math.round(item.ufProb)));
  const delta = item.delta7d ?? 0;

  return (
    <article
      className={`rh-cc-intel-card rh-cc-intel-card--${item.intelType.toLowerCase()}`}
      data-testid="rh-cc-intel-card"
    >
      <header className="rh-cc-intel-card__head">
        <div>
          <a href={playerProfileRoute(item.slug, 'recruiting')} className="rh-cc-intel-card__name">
            {item.name}
          </a>
          <p className="rh-cc-intel-card__meta">
            {item.position}
            {item.school ? ` · ${item.school}` : ''} · {item.classYear}
          </p>
        </div>
        <span className="rh-cc-intel-card__label">
          <span aria-hidden>{intelIcon(item.intelType)}</span> {item.intelLabel}
        </span>
      </header>

      <div className="rh-cc-intel-card__prob">
        <UfProbBar value={pct} />
        <MovementBadge
          delta={delta}
          tone={delta > 0 ? 'rise' : delta < 0 ? 'fall' : 'flat'}
        />
      </div>

      <p className="rh-cc-intel-card__summary">{item.intelSummary}</p>

      <footer className="rh-cc-intel-card__foot">
        <a
          href={playerProfilePath(item.slug, 'target', true, item.name, 'recruiting')}
          className="rh-cc-intel-card__link rh-cc-intel-card__link--primary"
        >
          More Intel →
        </a>
      </footer>
    </article>
  );
}

export function HighPriorityIntelModule({ items, loading, lastUpdated }: Props): React.ReactElement {
  const display = items.slice(0, 6);

  return (
    <ModuleShell
      title="High Priority Intel"
      sub="Structured intel on UF's top targets — probability, heat, and next action."
      testId="rh-cc-high-priority-intel"
      action={
        lastUpdated ? (
          <span className="rh-cc-module__stamp">Updated {formatIntelUpdated(lastUpdated)}</span>
        ) : null
      }
    >
      {loading && display.length === 0 ? (
        <div className="rh-cc-intel-scroll">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rh-cc-skeleton rh-cc-intel-card rh-cc-intel-card--skeleton" aria-hidden />
          ))}
        </div>
      ) : display.length === 0 ? (
        <p className="rh-cc-empty">No high-priority intel loaded yet.</p>
      ) : (
        <div className="rh-cc-intel-scroll" tabIndex={0} role="list" aria-label="High priority intel cards">
          {display.map((item) => (
            <div key={`${item.slug}-${item.id}`} role="listitem">
              <IntelCard item={item} />
            </div>
          ))}
        </div>
      )}
    </ModuleShell>
  );
}
