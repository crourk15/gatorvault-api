'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FILM_HUB_ORDER,
  fetchFilmRoomCatalog,
  type FilmRoomCatalogItem,
} from '@/lib/film-room-api';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

const HUB_ICONS: Record<string, string> = {
  'Offensive Scheme': '⚔️',
  'Defensive Scheme': '🛡️',
  'Film Breakdown': '🎬',
  'UF Press Conferences': '🎤',
  Highlights: '⭐',
};

export function VaultFilmRoomPage(): React.ReactElement {
  const [items, setItems] = useState<FilmRoomCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hub, setHub] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const catalog = await fetchFilmRoomCatalog();
      setItems(catalog.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Film Room catalog.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hubCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of FILM_HUB_ORDER) counts[h] = 0;
    for (const item of items) {
      const key = item.filmHub || 'Offensive Scheme';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    if (!hub) return [];
    return items.filter((i) => (i.filmHub || 'Offensive Scheme') === hub);
  }, [items, hub]);

  return (
    <div className="gv-film-room" data-testid="vault-film-room">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Film Room</h1>
        <p className="gv-page-subtitle">
          Scheme breakdowns, press conferences, and verified coaching analysis.
        </p>
      </div>

      {loading && <p className="gv-page-status">Loading Film Room…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load()} backHref="/vault" backLabel="← Vault" />
      )}

      {!loading && !error && (
        <>
          {!hub ? (
            <div className="gv-film-hub-grid">
              {FILM_HUB_ORDER.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="gv-film-hub-card"
                  onClick={() => setHub(name)}
                >
                  <span className="gv-film-hub-card__icon">{HUB_ICONS[name] ?? '📺'}</span>
                  <h2 className="gv-film-hub-card__title">{name}</h2>
                  <p className="gv-film-hub-card__count">{hubCounts[name] ?? 0} lessons</p>
                </button>
              ))}
            </div>
          ) : (
            <>
              <button type="button" className="gv-film-back" onClick={() => setHub(null)}>
                ← All categories
              </button>
              <h2 className="gv-vault-alerts__section-title">{hub}</h2>
              <div className="gv-film-lessons">
                {filtered.map((item) => (
                  <article key={item.id} className="gv-film-lesson">
                    <h3 className="gv-film-lesson__title">{item.title}</h3>
                    {item.dek ? <p className="gv-film-lesson__dek">{item.dek}</p> : null}
                    <p className="gv-film-lesson__meta">
                      {item.source || 'Verified source'}
                      {item.locked ? ' · 🔒 Film tier' : ''}
                    </p>
                    {item.sourceUrl && !item.locked ? (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="gv-film-lesson__link"
                      >
                        Open source →
                      </a>
                    ) : null}
                  </article>
                ))}
                {filtered.length === 0 && <UiEmpty message="No lessons in this category yet." />}
              </div>
            </>
          )}
          {items.length === 0 && !hub && (
            <UiEmpty message="Film Room catalog is empty." hint="Run ensure:film-room on the API." />
          )}
        </>
      )}
    </div>
  );
}
