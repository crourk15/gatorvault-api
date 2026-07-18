'use client';

import React from 'react';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';

type Props = {
  onRefresh: () => void;
  refreshing?: boolean;
};

export function NilFooterCta({ onRefresh, refreshing }: Props): React.ReactElement {
  return (
    <section className="nil-footer-cta" data-testid="nil-footer-cta">
      <p className="nil-footer-cta__text">Stay ahead of NIL movement — updated daily.</p>
      <div className="nil-footer-cta__actions">
        <button type="button" className="nil-footer-cta__btn nil-footer-cta__btn--primary" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh NIL Data'}
        </button>
        <a href={VAULT_PILLAR_ROUTES.recruiting} className="nil-footer-cta__btn nil-footer-cta__btn--outline">
          View Recruiting Hub
        </a>
      </div>
    </section>
  );
}
