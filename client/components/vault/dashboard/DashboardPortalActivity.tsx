'use client';

import React from 'react';
import { Card, Chip, PageSection } from '@/components/brand';
import type { RecruitingSnapshot } from '@/lib/vault-dashboard-api';

const MOCK_PORTAL = [
  { name: 'Marcus Webb', pos: 'EDGE', dir: 'in' as const, from: 'Auburn' },
  { name: 'Tyler Brooks', pos: 'WR', dir: 'target' as const, from: 'Georgia' },
  { name: 'Jordan Hale', pos: 'CB', dir: 'out' as const, from: 'UF' },
];

type Props = {
  snapshot: RecruitingSnapshot | null;
};

export function DashboardPortalActivity({ snapshot }: Props): React.ReactElement {
  const active = snapshot?.portalActive ?? 12;

  return (
    <section className="gv-dash-portal gv-dash__section" aria-label="Portal activity" data-testid="dashboard-portal">
      <div className="gv-dash__frame">
        <PageSection
          title="Portal Activity"
          subtitle={`${active} active targets tracked`}
          action={<Chip variant="orange">{active} Active</Chip>}
        >
          <div className="gv-dash-portal__list">
            {MOCK_PORTAL.map((p) => (
              <Card key={p.name} className="gv-dash-portal__row">
                <div className="gv-dash-portal__row-inner">
                  <div>
                    <strong>{p.name}</strong>
                    <span style={{ marginLeft: '0.5rem', opacity: 0.65 }}>{p.pos}</span>
                  </div>
                  <span
                    className={
                      p.dir === 'in'
                        ? 'gv-portal-tag gv-portal-tag--in'
                        : p.dir === 'out'
                          ? 'gv-portal-tag gv-portal-tag--out'
                          : 'gv-portal-tag gv-portal-tag--target'
                    }
                  >
                    {p.dir === 'in' ? 'Portal In' : p.dir === 'out' ? 'Portal Out' : 'Target'}
                  </span>
                </div>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', opacity: 0.7 }}>
                  {p.dir === 'out' ? 'Entered portal' : `From ${p.from}`}
                </p>
              </Card>
            ))}
          </div>
        </PageSection>
      </div>
    </section>
  );
}
