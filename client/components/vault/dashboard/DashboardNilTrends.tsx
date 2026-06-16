'use client';

import React from 'react';
import { Button, Card, GridLayout, PageSection } from '@/components/brand';
import type { RecruitingSnapshot } from '@/lib/vault-dashboard-api';

type Props = {
  snapshot: RecruitingSnapshot | null;
};

export function DashboardNilTrends({ snapshot }: Props): React.ReactElement {
  const secRank = snapshot?.nilSecRank ?? 4;

  return (
    <section className="gv-dash-nil gv-dash__section" aria-label="NIL trends" data-testid="dashboard-nil-trends">
      <div className="gv-dash__frame">
        <PageSection
          title="NIL Trends"
          action={<Button href="/vault/nil" variant="secondary">NIL Tracker</Button>}
        >
          <GridLayout cols={3}>
            <Card variant="stat">
              <p className="gv-stat-card__value">#{secRank}</p>
              <p className="gv-stat-card__label">SEC NIL Rank</p>
            </Card>
            <Card>
              <p className="gv-type-label">Est. Pool</p>
              <p className="gv-type-number" style={{ fontSize: '1.75rem', color: 'var(--gv-orange)' }}>
                $18.2M
              </p>
              <span className="gv-trend gv-trend--up">↑ +6% YoY</span>
            </Card>
            <Card>
              <p className="gv-type-label">Top Earner</p>
              <p style={{ margin: '0.35rem 0', fontWeight: 700 }}>Gators Collective</p>
              <p style={{ margin: 0, fontSize: '0.8125rem', opacity: 0.75 }}>
                3 new deals this week
              </p>
            </Card>
          </GridLayout>
        </PageSection>
      </div>
    </section>
  );
}
