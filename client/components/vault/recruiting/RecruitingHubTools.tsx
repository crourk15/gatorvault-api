'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';

export function RecruitingHubTools(): React.ReactElement {
  return (
    <section className="gv-rh-tools gv-rh-hub__frame" data-testid="rh-tools">
      <h2 className="gv-rh-section-heading">Tools</h2>
      <div className="gv-rh-tools__grid">
        <article className="gv-ds-card gv-rh-tool">
          <h3 className="gv-rh-tool__title">Interactive Depth Chart</h3>
          <p className="gv-rh-tool__desc">
            Clickable position cards with battle status and weekly unit updates.
          </p>
          <Button href="/vault/depth-chart" variant="secondary">
            Open Depth Chart
          </Button>
        </article>
        <article className="gv-ds-card gv-rh-tool">
          <h3 className="gv-rh-tool__title">Evaluation Notes</h3>
          <p className="gv-rh-tool__desc">
            Staff-style breakdowns, fit scores, and scouting reports for every target.
          </p>
          <Link href="/vault/scouting" className="gv-ds-btn gv-ds-btn--secondary">
            View Scouting
          </Link>
        </article>
      </div>
    </section>
  );
}
