'use client';

import React, { useMemo } from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { HighPriorityIntelItem } from '@/components/recruiting-hub/HighPriorityIntel/types';
import { formatIntelUpdated } from '@/components/recruiting-hub/utils/formatDate';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { AnalystConfidenceMeter, FitScoreBadge, ModuleShell, MovementBadge, UfProbBar } from './primitives';

type Props = {
  players: HighPriorityPlayer[];
  intelItems: HighPriorityIntelItem[];
  loading?: boolean;
  lastUpdated?: string | null;
};

type SignalCard = {
  id: string;
  slug: string;
  name: string;
  position: string;
  analyst: string;
  score: number;
  ufProb: number;
  delta7d: number;
  summary: string;
};

function buildSignals(players: HighPriorityPlayer[], intelItems: HighPriorityIntelItem[]): SignalCard[] {
  const cards: SignalCard[] = [];

  for (const item of intelItems.slice(0, 4)) {
    for (const signal of item.analystSignals.slice(0, 1)) {
      cards.push({
        id: signal.id,
        slug: item.slug,
        name: item.name,
        position: item.position,
        analyst: signal.analyst,
        score: signal.rpmPct,
        ufProb: item.ufProb,
        delta7d: item.delta7d,
        summary: item.intelSummary,
      });
    }
  }

  if (cards.length < 6) {
    for (const p of players) {
      if (cards.length >= 6) break;
      for (const pred of p.predictors ?? []) {
        if (cards.length >= 6) break;
        cards.push({
          id: `${p.slug}-${pred.name}`,
          slug: p.slug,
          name: p.name,
          position: p.position,
          analyst: pred.name,
          score: pred.score <= 1 ? Math.round(pred.score * 100) : Math.round(pred.score),
          ufProb: p.ufProbability <= 1 ? Math.round(p.ufProbability * 100) : Math.round(p.ufProbability),
          delta7d: Math.round(p.delta7d ?? p.movementDelta ?? 0),
          summary: p.notePreview ?? p.skinny ?? p.insiderNotes ?? 'Analyst tracking active.',
        });
      }
    }
  }

  return cards.slice(0, 6);
}

function SignalCardView({ card }: { card: SignalCard }): React.ReactElement {
  const delta = card.delta7d;
  const tone = delta > 0 ? 'rise' : delta < 0 ? 'fall' : 'flat';

  return (
    <article className="fc-lab-signal-card" data-testid="fc-lab-signal-card">
      <header className="fc-lab-signal-card__head">
        <div>
          <a href={playerProfileRoute(card.slug, 'futurecast')} className="fc-lab-signal-card__name">
            {card.name}
          </a>
          <p className="fc-lab-signal-card__meta">{card.position} · {card.analyst}</p>
        </div>
        <span className="fc-lab-signal-card__analyst">{card.analyst}</span>
      </header>
      <div className="fc-lab-signal-card__prob">
        <UfProbBar value={card.ufProb} />
        <MovementBadge delta={delta} tone={tone} />
      </div>
      <AnalystConfidenceMeter value={card.score} label="RPM signal" />
      <FitScoreBadge score={card.score} label="Signal" />
      <p className="fc-lab-signal-card__summary">{card.summary}</p>
    </article>
  );
}

export function FutureCastAnalystSignals({ players, intelItems, loading, lastUpdated }: Props): React.ReactElement {
  const signals = useMemo(() => buildSignals(players, intelItems), [players, intelItems]);

  return (
    <ModuleShell
      title="Analyst Signals"
      sub="RPM predictors and insider signals on UF's highest-priority targets."
      testId="fc-lab-analyst-signals"
      action={
        lastUpdated ? (
          <span className="rh-cc-module__stamp">Updated {formatIntelUpdated(lastUpdated)}</span>
        ) : null
      }
    >
      {loading && signals.length === 0 ? (
        <div className="fc-lab-signal-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rh-cc-skeleton fc-lab-signal-card" aria-hidden />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <p className="rh-cc-empty">No analyst signals loaded yet.</p>
      ) : (
        <div className="fc-lab-signal-grid">
          {signals.map((card) => (
            <SignalCardView key={card.id} card={card} />
          ))}
        </div>
      )}
    </ModuleShell>
  );
}
