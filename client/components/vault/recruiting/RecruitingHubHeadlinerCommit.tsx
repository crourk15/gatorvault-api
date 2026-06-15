'use client';

import React from 'react';
import { Button } from '@/components/ui';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';

type Props = {
  player: RecruitingBoardPlayer;
};

export function RecruitingHubHeadlinerCommit({ player }: Props): React.ReactElement {
  const rank = player.natlRank ?? player.natl;
  const stars = Number(player.stars) || 0;

  return (
    <article className="gv-rh-headliner gv-ds-card" data-testid="rh-headliner-commit">
      <div className="gv-rh-headliner__bg" aria-hidden="true" />
      <div className="gv-rh-headliner__content">
        <span className="gv-rh-headliner__eyebrow">Class of 2027 · Headliner</span>
        <h2 className="gv-rh-headliner__name">{player.name}</h2>
        <p className="gv-rh-headliner__meta">
          {player.position ?? '—'}
          {player.state ? ` · ${player.state}` : player.school ? ` · ${player.school}` : ''}
        </p>
        <div className="gv-rh-headliner__badges">
          {rank ? <span className="gv-rh-headliner__badge">#{rank} Nat&apos;l</span> : null}
          {stars > 0 ? <span className="gv-rh-headliner__badge">{stars}★</span> : null}
          {player.inState ? <span className="gv-rh-headliner__badge">In-State</span> : null}
        </div>
        <Button href={`/vault/recruiting/player/${player.slug}`} variant="primary">
          View Profile →
        </Button>
      </div>
    </article>
  );
}

export function pickHeadlinerCommit(commits: RecruitingBoardPlayer[]): RecruitingBoardPlayer | null {
  if (!commits.length) return null;
  const sorted = [...commits].sort((a, b) => {
    const ra = a.natlRank ?? a.natl ?? 9999;
    const rb = b.natlRank ?? b.natl ?? 9999;
    if (ra !== rb) return ra - rb;
    return (Number(b.stars) || 0) - (Number(a.stars) || 0);
  });
  return sorted[0] ?? null;
}
