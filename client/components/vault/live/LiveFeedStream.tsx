'use client';

import React, { useMemo } from 'react';
import { UiEmpty } from '@/components/site/UiMessage';
import type { LiveFeedItem } from '@/lib/live-api';
import { LiveFeedCard } from './LiveFeedCard';
import { RecruitingUpdateCard } from './PodcastsRecruitingSection';
import { CATEGORY_CHIPS, type FeedCategory, matchesCategory } from './live-feed-utils';

export function LiveFeedStream({
  feed,
  category,
  onCategoryChange,
}: {
  feed: LiveFeedItem[];
  category: FeedCategory;
  onCategoryChange: (category: FeedCategory) => void;
}): React.ReactElement {
  const filteredFeed = useMemo(
    () => feed.filter((item) => matchesCategory(item, category)),
    [feed, category]
  );

  const useRecruitingCards = category === 'recruiting';

  return (
    <>
      <div className="gv-live-feed__chips gv-live-category-chips">
        {CATEGORY_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`gv-live-feed__chip${category === chip.id ? ' is-active' : ''}`}
            onClick={() => onCategoryChange(chip.id)}
          >
            <span aria-hidden="true">{chip.icon}</span> {chip.label}
          </button>
        ))}
      </div>
      {useRecruitingCards ? (
        <div className="gv-vault-media-section__grid" data-testid="live-feed-stream">
          {filteredFeed.map((item, i) => (
            <RecruitingUpdateCard key={item.id ?? i} item={item} />
          ))}
          {filteredFeed.length === 0 && <UiEmpty message="No headlines in this category." />}
        </div>
      ) : (
        <ul className="gv-live-feed__list" data-testid="live-feed-stream">
          {filteredFeed.map((item, i) => (
            <LiveFeedCard key={item.id ?? i} item={item} />
          ))}
          {filteredFeed.length === 0 && <UiEmpty message="No headlines in this category." />}
        </ul>
      )}
    </>
  );
}
