'use client';

import React from 'react';
import { SITE_ROUTES } from '@/lib/site-routes';
import { GNL_COPY } from '@/lib/gatornation-live-types';
import { Button } from '@/components/ui';

const FILM_ROOM_HIGHLIGHTS = [
  { title: 'OL Pass Pro Breakdown', meta: 'Scheme · 12 min' },
  { title: 'WR Room Route Tree', meta: 'Personnel · 8 min' },
  { title: 'Portal EDGE Fit', meta: 'Recruiting · 6 min' },
] as const;

export function GNLFilmRoomPreview(): React.ReactElement {
  return (
    <article className="gv-gnl-card" aria-label="Film Room preview" data-testid="gnl-film-room-preview">
      <h2 className="gv-gnl-card__title">{GNL_COPY.filmRoomPreview}</h2>
      <p className="gv-gnl-card__subtitle">{GNL_COPY.filmRoomPreviewSubtitle}</p>
      <ul className="gv-gnl-film-preview__list">
        {FILM_ROOM_HIGHLIGHTS.map((item) => (
          <li key={item.title}>
            <a href={SITE_ROUTES.filmRoom} className="gv-gnl-film-preview__link">
              <span className="gv-gnl-film-preview__title">{item.title}</span>
              <span className="gv-gnl-film-preview__meta">{item.meta}</span>
            </a>
          </li>
        ))}
      </ul>
      <Button href={SITE_ROUTES.filmRoom} variant="secondary">
        Open Film Room →
      </Button>
    </article>
  );
}
