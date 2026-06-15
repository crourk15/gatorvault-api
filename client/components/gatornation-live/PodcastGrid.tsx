'use client';

import React from 'react';
import type { PodcastCardProps } from '@/lib/gatornation-live-types';
import { PodcastCard } from './PodcastCard';

type Props = {
  podcasts: PodcastCardProps[];
};

export function PodcastGrid({ podcasts }: Props): React.ReactElement {
  return (
    <div className="gv-gnl-podcast-grid" data-testid="gnl-podcast-grid">
      {podcasts.map((pod, idx) => (
        <PodcastCard key={`${pod.title}_${idx}`} {...pod} />
      ))}
    </div>
  );
}
