'use client';

import React from 'react';
import type { RecruitingUpdateCardProps } from '@/lib/gatornation-live-types';
import { RecruitingUpdateCard } from './RecruitingUpdateCard';

type Props = {
  items: RecruitingUpdateCardProps[];
};

export function RecruitingFeed({ items }: Props): React.ReactElement {
  if (items.length === 0) {
    return <p className="gv-gnl-thread__empty">No recruiting updates yet.</p>;
  }

  return (
    <div className="gv-gnl-thread__feed" data-testid="gnl-recruiting-feed">
      {items.map((item, idx) => (
        <RecruitingUpdateCard key={`${item.url}_${idx}`} {...item} />
      ))}
    </div>
  );
}
