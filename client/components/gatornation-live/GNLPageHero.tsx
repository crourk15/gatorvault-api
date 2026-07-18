'use client';

import React, { useEffect, useState } from 'react';
import { GNL_COPY } from '@/lib/gatornation-live-types';
import { SITE_ROUTES } from '@/lib/site-routes';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';
import { usePathname } from '@/lib/use-pathname';
import { vaultAwareHref } from '@/lib/vault-aware-href';

type Props = {
  updatedAt?: string | null;
  hasLiveSignal?: boolean;
  /** Override hero title (e.g. Podcasts deep-link). */
  title?: string;
  subtitle?: string;
};

function formatUpdated(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Honest Live hero — brand + true status, no “continuously updating” cosplay. */
export function GNLPageHero({
  updatedAt,
  hasLiveSignal = false,
  title,
  subtitle,
}: Props): React.ReactElement {
  const pathname = usePathname();
  const homeHref = vaultAwareHref(pathname, SITE_ROUTES.gatorNationLive, VAULT_PILLAR_ROUTES.liveFeed);
  const [stamp, setStamp] = useState<string | null>(null);

  // Format after mount — avoids SSR/client locale hydration drift.
  useEffect(() => {
    setStamp(formatUpdated(updatedAt));
  }, [updatedAt]);

  const meta = hasLiveSignal
    ? stamp
      ? `Updated ${stamp}`
      : GNL_COPY.hero.meta
    : GNL_COPY.hero.quietMeta;

  return (
    <section
      className="gv-gnl-hero gv-gnl-hero--wireframe gv-gnl-hero--redesign"
      aria-label="GatorNation Live hero"
      data-testid="gnl-page-hero"
    >
      <div className="gv-gnl-hero__bg" aria-hidden="true" />

      <div className="gv-gnl__frame gv-gnl-hero__inner gv-gnl-hero__inner--centered gv-gnl-hero__inner--fade-in">
        <span className="gv-gnl-hero__title-accent gv-gnl-hero__title-accent--top" aria-hidden="true" />
        <h1 className="gv-gnl-hero__title gv-gnl-hero__title--wireframe">
          <a href={homeHref} className="gv-gnl-hero__title-link">
            {title ?? GNL_COPY.hero.title}
          </a>
        </h1>
        <p className="gv-gnl-hero__subtitle gv-gnl-hero__subtitle--wireframe">
          {subtitle ?? GNL_COPY.hero.subtitle}
        </p>
        <p className="gv-gnl-hero__meta">{meta}</p>
      </div>
    </section>
  );
}
