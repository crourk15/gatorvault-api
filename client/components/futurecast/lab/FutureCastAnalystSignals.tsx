'use client';

import React, { useMemo } from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { HighPriorityIntelItem } from '@/components/recruiting-hub/HighPriorityIntel/types';
import { formatIntelUpdated } from '@/components/recruiting-hub/utils/formatDate';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { AnalystConfidenceMeter, ModuleShell } from './primitives';

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
  outlet: string;
  pick: 'UF' | 'Other';
  confidencePct: number;
  rpmPct: number;
  summary: string;
  timestamp: string;
};

function buildSignals(players: HighPriorityPlayer[], intelItems: HighPriorityIntelItem[]): SignalCard[] {
  const cards: SignalCard[] = [];

  for (const item of intelItems) {
    for (const signal of item.analystSignals.slice(0, 2)) {
      cards.push({
        id: signal.id,
        slug: item.slug,
        name: item.name,
        position: item.position,
        analyst: signal.analyst,
        outlet: signal.outlet,
        pick: item.ufProb >= 50 ? 'UF' : 'Other',
        confidencePct: signal.confidencePct,
        rpmPct: signal.rpmPct,
        summary: item.intelSummary,
        timestamp: signal.timestamp,
      });
    }
  }

  if (cards.length < 8) {
    for (const p of players) {
      if (cards.length >= 8) break;
      for (const pred of p.predictors ?? []) {
        if (cards.length >= 8) break;
        const rpm = pred.score <= 1 ? Math.round(pred.score * 100) : Math.round(pred.score);
        cards.push({
          id: `${p.slug}-${pred.name}`,
          slug: p.slug,
          name: p.name,
          position: p.position,
          analyst: pred.name,
          outlet: 'RPM',
          pick: rpm >= 50 ? 'UF' : 'Other',
          confidencePct: rpm,
          rpmPct: rpm,
          summary: p.notePreview ?? p.skinny ?? 'Analyst FutureCast activity.',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  return cards.slice(0, 8);
}

function SignalCardView({ card }: { card: SignalCard }): React.ReactElement {
  return (
    <article className="fc-lab-signal-card" data-testid="fc-lab-signal-card">
      <header className="fc-lab-signal-card__head">
        <span className="fc-lab-signal-card__analyst">
          <span aria-hidden>🎯</span> {card.analyst}
          {card.outlet !== 'RPM' ? ` · ${card.outlet}` : ''}
        </span>
        <time className="fc-lab-signal-card__time">{formatIntelUpdated(card.timestamp)}</time>
      </header>
      <a href={playerProfileRoute(card.slug, 'futurecast')} className="fc-lab-signal-card__name">
        {card.name}
      </a>
      <p className="fc-lab-signal-card__meta">
        {card.position} · Pick: <strong>{card.pick}</strong>
      </p>
      <div className="fc-lab-signal-card__metrics">
        <span className="fc-lab-signal-card__metric">Confidence {card.confidencePct}%</span>
        <span className="fc-lab-signal-card__metric">UF RPM {card.rpmPct}%</span>
      </div>
      <AnalystConfidenceMeter value={card.confidencePct} label="Signal strength" />
      <p className="fc-lab-signal-card__summary">{card.summary}</p>
    </article>
  );
}

export function FutureCastAnalystSignals({ players, intelItems, loading, lastUpdated }: Props): React.ReactElement {
  const signals = useMemo(() => buildSignals(players, intelItems), [players, intelItems]);

  return (
    <ModuleShell
      title="Analyst Signals — FutureCast Activity"
      sub="RPM predictors and insider picks — replaces Staff Notes + Signals pages."
      testId="fc-lab-analyst-signals"
      action={
        lastUpdated ? (
          <span className="rh-cc-module__stamp">Updated {formatIntelUpdated(lastUpdated)}</span>
        ) : null
      }
    >
      {loading && signals.length === 0 ? (
        <div className="fc-lab-signal-grid">
          {Array.from({ length: 4 }).map((_, i) => (
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
