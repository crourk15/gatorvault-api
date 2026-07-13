'use client';

import React, { useEffect, useMemo } from 'react';
import { UiEmpty } from '@/components/site/UiMessage';
import type { LiveFeedItem } from '@/lib/live-api';
import { LiveFeedCard } from './LiveFeedCard';
import { RecruitingUpdateCard } from './PodcastsRecruitingSection';
import {
  CATEGORY_CHIPS,
  type FeedCategory,
  matchesCategory,
  visibleFeedCategories,
} from './live-feed-utils';

export function LiveFeedStream({
  feed,
  category,
  onCategoryChange,
}: {
  feed: LiveFeedItem[];
  category: FeedCategory;
  onCategoryChange: (category: FeedCategory) => void;
}): React.ReactElement {
  const visibleCats = useMemo(() => visibleFeedCategories(feed), [feed]);
  const showChips = visibleCats.length > 0;

  // If active category vanished (empty / thin feed), snap back to All.
  useEffect(() => {
    if (!showChips && category !== 'all') {
      onCategoryChange('all');
      return;
    }
    if (showChips && !visibleCats.includes(category)) {
      onCategoryChange('all');
    }
  }, [showChips, visibleCats, category, onCategoryChange]);

  const filteredFeed = useMemo(
    () => feed.filter((item) => matchesCategory(item, category)),
    [feed, category]
  );

  const useRecruitingCards = category === 'recruiting';
  const chips = CATEGORY_CHIPS.filter((chip) => visibleCats.includes(chip.id));

  return (
    <>
      {showChips ? (
        <div className="gv-live-feed__chips gv-live-category-chips" role="tablist" aria-label="Filter live stream">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              role="tab"
              aria-selected={category === chip.id}
              className={`gv-live-feed__chip${category === chip.id ? ' is-active' : ''}`}
              onClick={() => onCategoryChange(chip.id)}
            >
              <span aria-hidden="true">{chip.icon}</span> {chip.label}
            </button>
          ))}
        </div>
      ) : null}
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
          {filteredFeed.length === 0 && showChips ? (
            <UiEmpty message="No headlines in this category." />
          ) : null}
        </ul>
      )}
    </>
  );
}
