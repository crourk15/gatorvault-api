'use client';

import React from 'react';

const SWAMP_STATS = [
  { label: 'Home Win %', value: '78%', detail: 'Last 10 seasons in The Swamp' },
  { label: 'Opponent False Starts', value: '4.2/game', detail: 'Noise-driven disruption' },
  { label: 'Noise Metrics', value: '115 dB', detail: 'Peak crowd intensity' },
  { label: 'National Reputation', value: 'Top 5', detail: 'Most intimidating venues' },
];

export function SwampAdvantageHighlight(): React.ReactElement {
  return (
    <article className="team-swamp-advantage">
      <div className="team-swamp-advantage__head">
        <h3 className="team-swamp-advantage__title">The Swamp Advantage</h3>
        <p className="team-swamp-advantage__tagline">&ldquo;Only Gators Get Out Alive&rdquo;</p>
      </div>
      <div className="team-swamp-advantage__stats">
        {SWAMP_STATS.map((s) => (
          <div key={s.label} className="team-swamp-advantage__stat">
            <span className="team-swamp-advantage__stat-value">{s.value}</span>
            <span className="team-swamp-advantage__stat-label">{s.label}</span>
            <span className="team-swamp-advantage__stat-detail">{s.detail}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
