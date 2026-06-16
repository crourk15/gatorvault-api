'use client';

import React from 'react';
import { Card, GridLayout, PageSection } from '@/components/brand';
import { GV_COPY } from '@/lib/gatorvault-copy';

const HEAT_ITEMS = [
  { label: 'QB Room Buzz', score: 88, trend: 'up' as const },
  { label: 'Portal Watch', score: 72, trend: 'flat' as const },
  { label: 'SEC Recruiting', score: 91, trend: 'up' as const },
];

export function DashboardHeatCheck(): React.ReactElement {
  return (
    <section className="gv-dash-heat gv-dash__section" aria-label="Heat check" data-testid="dashboard-heat-check">
      <div className="gv-dash__frame">
        <PageSection title={GV_COPY.headlines.heatCheck ?? 'Heat Check'}>
          <GridLayout cols={3}>
            {HEAT_ITEMS.map((item) => (
              <Card key={item.label}>
                <p className="gv-type-label">{item.label}</p>
                <p className="gv-type-number" style={{ fontSize: '2rem', color: 'var(--gv-orange)' }}>
                  {item.score}
                </p>
                <span className={`gv-trend gv-trend--${item.trend === 'up' ? 'up' : 'flat'}`}>
                  {item.trend === 'up' ? '↑ Rising' : '→ Steady'}
                </span>
                <div className="gv-prob-bar" style={{ marginTop: '0.75rem' }}>
                  <div className="gv-prob-bar__fill" style={{ width: `${item.score}%` }} />
                </div>
              </Card>
            ))}
          </GridLayout>
        </PageSection>
      </div>
    </section>
  );
}
