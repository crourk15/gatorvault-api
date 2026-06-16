'use client';

import React from 'react';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import {
  formatCompositeRating,
  formatRank,
  playerPos,
  playerRating,
  starsDisplay,
} from '@/components/recruiting-hub/utils/formatRank';
import { playerProfilePath, recruitingProfileLifecycle } from '@/lib/player-routes';
import { isElitePlayer } from '@/lib/recruiting-hub-utils';
import { PositionIcon } from '@/components/recruiting-hub/Icons/PositionIcon';
import { Button } from '@/components/ui';
import { ensurePlayerSlug } from '@/lib/slug';

type Props = {
  player: RecruitingBoardPlayer;
};

function statusTags(player: RecruitingBoardPlayer): string[] {
  const tags: string[] = [];
  if (player.isCommittedToUF || player.status === 'commit') tags.push('Commit');
  if (isElitePlayer(player) || (player.stars != null && player.stars >= 4)) tags.push('Elite');
  if (player.inState) tags.push('In-State');
  return tags;
}

export function CommitCard({ player }: Props): React.ReactElement {
  const pos = playerPos(player);
  const slug = ensurePlayerSlug(player.slug, player.name);
  const href = playerProfilePath(slug, recruitingProfileLifecycle(player), true, player.name, 'recruiting');
  const rating =
    player.displayRating ?? player.rating ?? (playerRating(player) ? playerRating(player) / 100 : null);
  const tags = statusTags(player);

  return (
    <article className="rh-commit-card">
      <div className="rh-commit-card__top">
        <PositionIcon position={pos} size="sm" />
        <div>
          <h3 className="rh-commit-card__name">{player.name}</h3>
          <p className="rh-commit-card__rating">
            {rating != null ? formatCompositeRating(rating) : '—'}
            {player.stars ? ` · ${starsDisplay(player.stars)}` : ''}
          </p>
        </div>
      </div>
      <p className="rh-commit-card__ranks">
        NATL {formatRank(player.natlRank ?? player.natl)} · ST {formatRank(player.stateRank)} · POS{' '}
        {formatRank(player.posRank)} ({pos})
      </p>
      {tags.length > 0 ? (
        <div className="rh-commit-card__tags">
          {tags.map((tag) => (
            <span key={tag} className="rh-commit-card__tag">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <Button href={href} variant="secondary" className="rh-commit-card__btn">
        View Profile
      </Button>
    </article>
  );
}
