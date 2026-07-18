'use client';

import React from 'react';
import { SITE_ROUTES } from '@/lib/site-routes';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';
import { usePathname } from '@/lib/use-pathname';
import { vaultAwareHref } from '@/lib/vault-aware-href';
import { GNL_COPY } from '@/lib/gatornation-live-types';
import { Button } from '@/components/ui';

const FILM_ROOM_HIGHLIGHTS = [
  { title: 'OL Pass Pro Breakdown', meta: 'Scheme · 12 min' },
  { title: 'WR Room Route Tree', meta: 'Personnel · 8 min' },
  { title: 'Portal EDGE Fit', meta: 'Recruiting · 6 min' },
] as const;

export function GNLFilmRoomPreview(): React.ReactElement {
  const pathname = usePathname();
  const filmHref = vaultAwareHref(pathname, SITE_ROUTES.filmRoom, VAULT_PILLAR_ROUTES.filmRoom);

  return (
    <article className="gv-gnl-card" aria-label="Film Room preview" data-testid="gnl-film-room-preview">
      <h2 className="gv-gnl-card__title">{GNL_COPY.filmRoomPreview}</h2>
      <p className="gv-gnl-card__subtitle">{GNL_COPY.filmRoomPreviewSubtitle}</p>
      <ul className="gv-gnl-film-preview__list">
        {FILM_ROOM_HIGHLIGHTS.map((item) => (
          <li key={item.title}>
            <a href={filmHref} className="gv-gnl-film-preview__link">
              <span className="gv-gnl-film-preview__title">{item.title}</span>
              <span className="gv-gnl-film-preview__meta">{item.meta}</span>
            </a>
          </li>
        ))}
      </ul>
      <Button href={filmHref} variant="secondary">
        Open Film Room →
      </Button>
    </article>
  );
}
