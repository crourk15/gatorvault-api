'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, GridLayout, PageLayout, PageSection, TabBar } from '@/components/brand';
import {
  FILM_HUB_ORDER,
  fetchFilmRoomCatalog,
  type FilmRoomCatalogItem,
} from '@/lib/film-room-api';
import {
  filmRoomHubFromSegment,
  parseFilmRoomSegmentFromPath,
} from '@/lib/vault-route-map';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

const HUB_TABS = FILM_HUB_ORDER.map((name) => ({
  id: name,
  label: name.replace('UF ', '').replace(' Scheme', ''),
}));

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
  const [hub, setHub] = useState<string>(() => {
    const seg = parseFilmRoomSegmentFromPath();
    return seg ? filmRoomHubFromSegment(seg) : FILM_HUB_ORDER[0];
  });

  useEffect(() => {
    const seg = parseFilmRoomSegmentFromPath();
    if (seg) setHub(filmRoomHubFromSegment(seg));
  }, []);

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
    return items.filter((i) => (i.filmHub || 'Offensive Scheme') === hub);
  }, [items, hub]);

  return (
    <PageLayout
      theme="chalkboard"
      title="Film Room"
      subtitle="Scheme breakdowns, press conferences, and verified coaching analysis."
      testId="vault-film-room"
    >
      <TabBar
        options={HUB_TABS}
        active={hub}
        onChange={setHub}
        aria-label="Film room categories"
      />

      {loading && <p className="gv-page-status">Loading Film Room…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load()} backHref="/vault" backLabel="← Vault" />
      )}

      {!loading && !error && (
        <>
          <PageSection
            title={hub}
            subtitle={`${hubCounts[hub] ?? 0} lessons · ${HUB_ICONS[hub] ?? '📺'}`}
          >
            <div className="gv-film-diagram" aria-hidden="true">
              <svg viewBox="0 0 400 200" className="gv-film-diagram__svg">
                <line x1="40" y1="100" x2="360" y2="100" stroke="var(--gv-orange)" strokeWidth="2" strokeDasharray="6 4" />
                <circle cx="120" cy="100" r="24" fill="none" stroke="var(--gv-orange)" strokeWidth="2" />
                <circle cx="200" cy="60" r="20" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
                <circle cx="280" cy="100" r="24" fill="none" stroke="var(--gv-orange)" strokeWidth="2" />
                <text x="200" y="180" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="12">
                  Chalkboard schematic preview
                </text>
              </svg>
            </div>

            <div className="gv-film-lessons">
              {filtered.map((item) => (
                <Card key={item.id} className="gv-film-lesson">
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
                </Card>
              ))}
              {filtered.length === 0 && <UiEmpty message="No lessons in this category yet." />}
            </div>
          </PageSection>

          {items.length === 0 && (
            <UiEmpty message="Film Room catalog is empty." hint="Run ensure:film-room on the API." />
          )}

          <PageSection title="Hub Overview">
            <GridLayout cols={3}>
              {FILM_HUB_ORDER.map((name) => (
                <Card key={name} onClick={() => setHub(name)}>
                  <span style={{ fontSize: '1.5rem' }}>{HUB_ICONS[name] ?? '📺'}</span>
                  <h3 className="gv-type-h3" style={{ margin: '0.35rem 0' }}>{name}</h3>
                  <p style={{ margin: 0, opacity: 0.75 }}>{hubCounts[name] ?? 0} lessons</p>
                </Card>
              ))}
            </GridLayout>
          </PageSection>
        </>
      )}
    </PageLayout>
  );
}
