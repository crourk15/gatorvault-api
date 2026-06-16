'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { SITE_ROUTES } from '@/lib/site-routes';

type Props = {
  title: string;
  id: string;
  idLabel: string;
  backHref?: string;
  backLabel?: string;
  children?: React.ReactNode;
};

export function DetailPageStub({
  title,
  id,
  idLabel,
  backHref,
  backLabel,
  children,
}: Props): React.ReactElement {
  return (
    <div className="gv-detail-stub" data-testid="detail-stub">
      <h1 className="gv-detail-stub__title">{title}</h1>
      <p className="gv-detail-stub__meta">
        {idLabel}: <strong>{id}</strong>
      </p>
      {children}
      <Button href={backHref ?? SITE_ROUTES.dashboard} variant="secondary">
        {backLabel ?? '← Back'}
      </Button>
    </div>
  );
}
