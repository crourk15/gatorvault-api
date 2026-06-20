'use client';

import React, { useEffect, useState } from 'react';
import type { GnlGameDay } from '@/lib/gatornation-live-types';
import { GNLModuleHead } from '@/components/gatornation-live/GNLModuleHead';
import { GNLDashBadge } from '@/components/gatornation-live/GNLDashBadge';

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Kickoff';

  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(plural(days, 'day'));
  if (hours > 0) parts.push(plural(hours, 'hour'));
  if (minutes > 0) parts.push(plural(minutes, 'minute'));
  if (days === 0 && hours === 0) parts.push(plural(seconds, 'second'));

  return `Kickoff in: ${parts.join(' ')}`;
}

type Props = {
  game: GnlGameDay | null;
};

export function GNLGameDayCountdown({ game }: Props): React.ReactElement | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!game?.kickoffIso) {
      setRemaining(null);
      return;
    }
    const tick = () => {
      const ms = new Date(game.kickoffIso!).getTime() - Date.now();
      setRemaining(ms);
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [game?.kickoffIso]);

  if (!game) return null;

  return (
    <article className="gv-gnl-elite-card gv-gnl-elite-gameday" data-testid="gnl-gameday-countdown">
      <GNLModuleHead
        title="Game Day"
        subtitle={game.venue}
        badge={<GNLDashBadge label="GAMEDAY" tone="team" />}
      />
      <div className="gv-gnl-elite-gameday__matchup">
        <div className="gv-gnl-elite-gameday__team">
          <span className="gv-gnl-elite-gameday__badge gv-gnl-elite-gameday__badge--uf">UF</span>
          <span className="gv-gnl-elite-gameday__label">Florida</span>
        </div>
        <span className="gv-gnl-elite-gameday__vs">vs</span>
        <div className="gv-gnl-elite-gameday__team">
          <span className="gv-gnl-elite-gameday__badge">{game.opponentAbbr}</span>
          <span className="gv-gnl-elite-gameday__label">{game.opponent}</span>
        </div>
      </div>
      <p className="gv-gnl-elite-gameday__kickoff">{game.kickoffLabel}</p>
      {remaining != null && game.kickoffIso ? (
        <p className="gv-gnl-elite-gameday__countdown gv-gnl-elite-gameday__countdown--live">
          {formatCountdown(remaining)}
        </p>
      ) : null}
    </article>
  );
}
