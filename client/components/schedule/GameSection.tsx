'use client';

import React from 'react';
import { BodyM, HeadingL } from '@/components/ui';
import type { PremiumScheduleGame } from '@/lib/schedule-premium';
import { GameCard } from './GameCard';

type Props = {
  title: string;
  description: string;
  games: PremiumScheduleGame[];
};

export function GameSection({ title, description, games }: Props): React.ReactElement | null {
  if (games.length === 0) return null;

  return (
    <section className="gv-sched-section" data-testid={`schedule-section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <header className="gv-sched-section__header">
        <HeadingL>{title}</HeadingL>
        <BodyM>{description}</BodyM>
      </header>
      <div className="gv-sched-section__games">
        {games.map((game) => (
          <GameCard key={game.id} {...game} />
        ))}
      </div>
    </section>
  );
}
