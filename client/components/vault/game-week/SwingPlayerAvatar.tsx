'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { rosterPhotoCandidates, vaultGradeForSlug } from '@/lib/game-week-data';

type Props = {
  slug: string;
  name: string;
  position: string;
  impact: number;
  size?: 'sm' | 'md';
};

export function SwingPlayerAvatar({
  slug,
  name,
  position,
  impact,
  size = 'md',
}: Props): React.ReactElement {
  const photos = useMemo(() => rosterPhotoCandidates(slug), [slug]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const vaultGrade = vaultGradeForSlug(slug) ?? impact;
  const px = size === 'sm' ? 48 : 72;

  const onPhotoError = useCallback(() => {
    setPhotoIndex((i) => (i < photos.length - 1 ? i + 1 : photos.length));
  }, [photos.length]);

  if (photoIndex < photos.length) {
    return (
      <img
        src={photos[photoIndex]}
        alt={name}
        className={`gv-gw-player-photo gv-gw-player-photo--${size}`}
        width={px}
        height={px}
        onError={onPhotoError}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`gv-gw-vault-grade-badge gv-gw-vault-grade-badge--${size}`}
      aria-label={`${name} Vault grade ${vaultGrade}`}
    >
      <span className="gv-gw-vault-grade-badge__value">{vaultGrade}</span>
      <span className="gv-gw-vault-grade-badge__pos">{position}</span>
    </div>
  );
}
