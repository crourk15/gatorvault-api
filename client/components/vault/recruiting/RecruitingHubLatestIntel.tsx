'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { formatUfPercent, normalizePercent } from '@/lib/futurecast-elite-metrics';

type IntelTag = 'hot' | 'warm' | 'watch' | 'cold';

const TAG_LABEL: Record<IntelTag, string> = {
  hot: 'Hot',
  warm: 'Warm',
  watch: 'Watch',
  cold: 'Cold',
};

function tagForPlayer(p: HighPriorityPlayer): IntelTag {
  const uf = normalizePercent(p.ufProbability);
  if (uf >= 70) return 'hot';
  if (uf >= 50) return 'warm';
  if (uf >= 30) return 'watch';
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
            const ufPct = normalizePercent(p.ufProbability);
            return (
              <article key={p.slug} className="gv-ds-card gv-rh-intel-card">
                <span className={`gv-rh-intel-tag gv-rh-intel-tag--${tag}`}>{TAG_LABEL[tag]}</span>
                <h3 className="gv-rh-intel-card__title">{p.name}</h3>
                <p className="gv-rh-intel-card__body">
                  {p.position ?? 'Recruit'} · UF {formatUfPercent(p.ufProbability)}
                  {p.notePreview || p.insiderNotes ? ` — ${p.notePreview ?? p.insiderNotes}` : ''}
                </p>
                <div className="gv-rh-intel-meter" aria-label={`UF confidence ${ufPct} percent`}>
                  <div className="gv-rh-intel-meter__fill" style={{ width: `${ufPct}%` }} />
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
