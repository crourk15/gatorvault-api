'use client';

import React, { useMemo, useState } from 'react';
import { PlayerNavLink } from '@/components/vault/PlayerNavLink';
import { playerProfileRoute } from '@/lib/site-routes';
import type { NilEliteRosterEarner } from '@/lib/nil-elite-api';

type Props = {
  earners: NilEliteRosterEarner[];
};

const POS_FILTERS = ['All', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'ST'] as const;

function bucketPos(pos: string): string {
  const p = (pos || '').toUpperCase();
  if (p === 'QB') return 'QB';
  if (p === 'RB' || p === 'FB') return 'RB';
  if (p === 'WR') return 'WR';
  if (p === 'TE') return 'TE';
  if (['OL', 'OT', 'OG', 'OC', 'IOL', 'C'].includes(p)) return 'OL';
  if (['DL', 'DT', 'NT', 'DE', 'EDGE', 'OLB'].includes(p)) return 'DL';
  if (['LB', 'ILB', 'MLB'].includes(p)) return 'LB';
  if (['DB', 'CB', 'S', 'SAF', 'FS', 'SS'].includes(p)) return 'DB';
  if (['K', 'P', 'PK', 'LS', 'ST'].includes(p)) return 'ST';
  return 'All';
}

function EarnerRow({
  player,
  rank,
}: {
  player: NilEliteRosterEarner;
  rank: number;
}): React.ReactElement {
  const href = player.slug ? playerProfileRoute(player.slug, 'team') : undefined;
  const meta = [
    player.position,
    player.classLabel,
    player.jersey != null && player.jersey !== '' ? `#${player.jersey}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const body = (
    <>
      <span className="nil-earner-list__rank">#{rank}</span>
      <span className="nil-earner-list__identity">
        <strong className="nil-earner-list__name">{player.name}</strong>
        <span className="nil-earner-list__meta">
          {player.stars != null ? `${'★'.repeat(Math.min(5, player.stars))} · ` : ''}
          {meta || 'Florida'}
        </span>
      </span>
      <span className="nil-earner-list__val">
        <span className="nil-earner-list__val-label">
          {player.nilSourceLabel ||
            (player.nilSource === 'on3'
              ? 'On3 value'
              : player.nilSource === 'sideline'
                ? 'Sideline model'
                : 'Vault est.')}
        </span>
        <strong>{player.nilValuation}</strong>
      </span>
    </>
  );
  return (
    <li className="nil-earner-list__item">
      {href ? (
        <PlayerNavLink href={href} className="nil-earner-list__link">
          {body}
        </PlayerNavLink>
      ) : (
        <div className="nil-earner-list__link">{body}</div>
      )}
    </li>
  );
}

export function NilRosterEarners({ earners }: Props): React.ReactElement {
  const [filter, setFilter] = useState<(typeof POS_FILTERS)[number]>('All');
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const featured = earners.slice(0, 8);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return earners.filter((p) => {
      if (filter !== 'All' && bucketPos(p.position) !== filter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [earners, filter, query]);

  const list = showAll || query || filter !== 'All' ? rows : featured;
  const showToggle = !query && filter === 'All' && earners.length > featured.length;

  return (
    <section className="nil-elite-section" data-testid="nil-roster-earners">
      <header className="nil-elite-section__head">
        <div>
          <h2 className="nil-elite-section__title">Florida valuations</h2>
          <p className="nil-elite-section__sub">
            Sideline desk — On3 when public, Sideline model otherwise. Why the number matters is in
            the market read above.
          </p>
        </div>
      </header>

      <div className="nil-featured-grid" data-testid="nil-featured-earners">
        {featured.slice(0, 4).map((player, idx) => (
          <article key={player.id} className="nil-featured-card">
            <span className="nil-featured-card__rank">#{idx + 1}</span>
            <strong className="nil-featured-card__name">{player.name}</strong>
            <span className="nil-featured-card__meta">{player.position}</span>
            <span className="nil-featured-card__source">
              {player.nilSourceLabel || player.nilSource}
            </span>
            <span className="nil-featured-card__val">{player.nilValuation}</span>
          </article>
        ))}
      </div>

      <label className="nil-search">
        <span className="sr-only">Search Florida players</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Florida players..."
          className="nil-search__input"
        />
      </label>

      <div className="rh-cc-tabs nil-pos-tabs" role="tablist" aria-label="Position filter">
        {POS_FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={`rh-cc-tabs__btn${filter === id ? ' is-active' : ''}`}
            onClick={() => setFilter(id)}
          >
            {id}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="rh-cc-empty">No matching Florida valuations.</p>
      ) : (
        <ol className="nil-earner-list">
          {list.map((player, idx) => (
            <EarnerRow key={player.id} player={player} rank={idx + 1} />
          ))}
        </ol>
      )}

      {showToggle ? (
        <button
          type="button"
          className="nil-editorial-toggle"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
        >
          {showAll ? 'Show top valuations' : `Show all ${earners.length} players`}
        </button>
      ) : null}
    </section>
  );
}
