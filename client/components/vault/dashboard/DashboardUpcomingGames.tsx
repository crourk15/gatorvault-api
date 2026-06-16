'use client';

import React from 'react';
import { Button, Card, GridLayout, PageSection } from '@/components/brand';
import { SCHEDULE_GAMES } from '@/lib/schedule-data';

export function DashboardUpcomingGames(): React.ReactElement {
  const upcoming = SCHEDULE_GAMES.slice(0, 3);

  return (
    <section className="gv-dash-games gv-dash__section" aria-label="Upcoming games" data-testid="dashboard-upcoming-games">
      <div className="gv-dash__frame">
        <PageSection
          title="Upcoming Games"
          action={<Button href="/vault/schedule" variant="secondary">Full Schedule</Button>}
        >
          <GridLayout cols={3}>
            {upcoming.map((game) => (
              <Card key={game.id} href={`/vault/game-week?game=${game.id}`}>
                <p className="gv-type-label">{game.date}</p>
                <h3 className="gv-type-h3" style={{ margin: '0.35rem 0' }}>
                  vs {game.opp}
                </h3>
                <p className="gv-type-body" style={{ opacity: 0.75, margin: 0 }}>
                  {game.venue}
                </p>
                <div className="gv-prob-bar" style={{ marginTop: '0.75rem' }}>
                  <div className="gv-prob-bar__fill" style={{ width: `${game.ufPct}%` }} />
                </div>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--gv-blue)' }}>
                  UF {game.ufPct}% win prob
                </p>
              </Card>
            ))}
          </GridLayout>
        </PageSection>
      </div>
    </section>
  );
}
