'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { rosterHeadshotCandidates } from '@/lib/game-week-data';

type Props = {
  slug: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZE_PX = { sm: 28, md: 48, lg: 64 } as const;

export function PlayerHeadshot({ slug, name, size = 'md', className = '' }: Props): React.ReactElement {
  const candidates = useMemo(() => rosterHeadshotCandidates(slug), [slug]);
  const [index, setIndex] = useState(0);

  const onError = useCallback(() => {
    setIndex((i) => (i < candidates.length - 1 ? i + 1 : i));
  }, [candidates.length]);

  const px = SIZE_PX[size];
  const cls = 'gv-gw-player-photo gv-gw-player-photo--' + size + (className ? ' ' + className : '');

  return (
    <span className={cls} style={{ width: px, height: px }}>
      <img
        src={candidates[index]}
        alt={name}
        width={px}
        height={px}
        onError={onError}
        loading="lazy"
      />
    </span>
  );
}
