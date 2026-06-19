'use client';

import React, { useMemo } from 'react';
import type { MasterBoardResponse, StaffNotesResponse } from '@/lib/futurecast-board-types';
import { formatIntelUpdated } from '@/components/recruiting-hub/utils/formatDate';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { AnalystConfidenceMeter, FutureCastPanelShell } from './primitives';
import { ufPctFromFc } from './fc-lab-types';

type Props = {
  staffNotes: StaffNotesResponse;
  masterBoard: MasterBoardResponse;
  bare?: boolean;
};

type SignalCard = {
  id: string;
  slug: string;
  name: string;
  position: string;
  analyst: string;
  pick: 'UF' | 'Other';
  confidencePct: number;
  rpmPct: number;
  summary: string;
  timestamp: string;
};

function buildSignals(staffNotes: StaffNotesResponse, masterBoard: MasterBoardResponse): SignalCard[] {
  const bySlug = new Map(masterBoard.players.map((p) => [p.slug, p]));
  const cards: SignalCard[] = [];

  for (const note of staffNotes.notes.slice(0, 12)) {
    const player = bySlug.get(note.playerSlug);
    const ufPct = player ? ufPctFromFc(player.ufConfidence) : 50;
    cards.push({
      id: note.id ?? `${note.playerSlug}-${note.updatedAt}`,
      slug: note.playerSlug,
      name: note.playerName,
      position: note.position ?? player?.position ?? '—',
      analyst: 'Staff Notes',
      pick: ufPct >= 50 ? 'UF' : 'Other',
      confidencePct: ufPct,
      rpmPct: ufPct,
      summary: note.notePreview ?? note.note ?? note.staffNotes ?? 'FutureCast staff activity.',
      timestamp: note.updatedAt ?? note.createdAt ?? staffNotes.updatedAt,
    });
  }

  for (const p of masterBoard.highPriority.players.slice(0, 6)) {
    if (cards.length >= 8) break;
    const pct = ufPctFromFc(p.ufConfidence);
    cards.push({
      id: `model-${p.slug}`,
      slug: p.slug,
      name: p.name,
      position: p.position,
      analyst: 'FutureCast Model',
      pick: pct >= 50 ? 'UF' : 'Other',
      confidencePct: pct,
      rpmPct: pct,
      summary: `Model projection ${pct}% for ${p.name}.`,
      timestamp: masterBoard.updatedAt,
    });
  }

  return cards.slice(0, 8);
}

function SignalCardView({ card }: { card: SignalCard }): React.ReactElement {
  return (
    <article className="fc-lab-signal-card" data-testid="fc-lab-signal-card">
      <header className="fc-lab-signal-card__head">
        <span className="fc-lab-signal-card__analyst">
          <span aria-hidden>🎯</span> {card.analyst}
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

export function FutureCastAnalystSignals({ staffNotes, masterBoard, bare }: Props): React.ReactElement {
  const signals = useMemo(
    () => buildSignals(staffNotes, masterBoard),
    [staffNotes, masterBoard]
  );

  return (
    <FutureCastPanelShell
      bare={bare}
      title="Analyst Signals — FutureCast Activity"
      sub="Staff notes and FutureCast model signals — prediction engine only."
      testId="fc-lab-analyst-signals"
      action={
        staffNotes.updatedAt ? (
          <span className="rh-cc-module__stamp">Updated {formatIntelUpdated(staffNotes.updatedAt)}</span>
        ) : null
      }
    >
      {signals.length === 0 ? (
        <p className="rh-cc-empty">No analyst signals loaded yet.</p>
      ) : (
        <div className="fc-lab-signal-grid">
          {signals.map((card) => (
            <SignalCardView key={card.id} card={card} />
          ))}
        </div>
      )}
    </FutureCastPanelShell>
  );
}
