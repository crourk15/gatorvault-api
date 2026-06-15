'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';

type IntelTag = 'hot' | 'warm' | 'watch' | 'cold';

const TAG_LABEL: Record<IntelTag, string> = {
  hot: 'Hot',
  warm: 'Warm',
  watch: 'Watch',
  cold: 'Cold',
};

function tagForPlayer(p: HighPriorityPlayer): IntelTag {
  const uf = Number(p.ufProbability ?? 0);
  if (uf >= 0.7) return 'hot';
  if (uf >= 0.5) return 'warm';
  if (uf >= 0.3) return 'watch';
  return 'cold';
}

type Props = {
  players: HighPriorityPlayer[];
};

export function RecruitingHubLatestIntel({ players }: Props): React.ReactElement {
  const cards = players.slice(0, 4);

  return (
    <section className="gv-rh-intel gv-rh-hub__frame" data-testid="rh-latest-intel">
      <h2 className="gv-rh-section-heading">Latest Intel</h2>
      <div className="gv-rh-intel__grid">
        {cards.length === 0 ? (
          <p className="gv-rh-module__desc">Insider notes loading…</p>
        ) : (
          cards.map((p) => {
            const tag = tagForPlayer(p);
            return (
              <article key={p.slug} className="gv-ds-card gv-rh-intel-card">
                <span className={`gv-rh-intel-tag gv-rh-intel-tag--${tag}`}>{TAG_LABEL[tag]}</span>
                <h3 className="gv-rh-intel-card__title">{p.name}</h3>
                <p className="gv-rh-intel-card__body">
                  {p.position ?? 'Recruit'} · UF {Math.round(Number(p.ufProbability ?? 0) * 100)}%
                  {p.notePreview || p.insiderNotes ? ` — ${p.notePreview ?? p.insiderNotes}` : ''}
                </p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
