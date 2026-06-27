'use client';

import React, { useMemo } from 'react';
import type { FutureCastPlayer, MasterBoardResponse, StaffNotesResponse } from '@/lib/futurecast-board-types';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { formatIntelUpdated } from '@/components/recruiting-hub/utils/formatDate';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { primaryRecruitingClassYear } from '@/lib/recruiting-cycle';
import { AnalystConfidenceMeter, FutureCastPanelShell } from './primitives';
import { highPriorityToBoardPlayer, ufPctFromFc } from './fc-lab-types';
import { useFutureCastLabCycle } from './FutureCastLabCycleContext';

type Props = {
  staffNotes: StaffNotesResponse;
  masterBoard: MasterBoardResponse;
  highPriority?: HighPriorityPlayer[];
  bare?: boolean;
};

type SignalCard = {
  id: string;
  slug: string;
  name: string;
  position: string;
  analyst: string;
  pick: 'UF' | 'Open' | 'Suppressed';
  confidencePct: number | null;
  rpmPct: number | null;
  summary: string;
  timestamp: string;
  suppressed?: boolean;
};

function buildSignals(
  staffNotes: StaffNotesResponse,
  masterBoard: MasterBoardResponse,
  highPriority: HighPriorityPlayer[],
  discoveryFocus: boolean
): SignalCard[] {
  const boardPlayers: FutureCastPlayer[] = discoveryFocus && highPriority.length
    ? highPriority.map(highPriorityToBoardPlayer)
    : masterBoard.players;
  const bySlug = new Map(boardPlayers.map((p) => [p.slug, p]));
  const modelPool: FutureCastPlayer[] = discoveryFocus && highPriority.length
    ? highPriority.map(highPriorityToBoardPlayer)
    : masterBoard.highPriority.players;
  const modelTimestamp = discoveryFocus && highPriority.length
    ? staffNotes.updatedAt || new Date().toISOString()
    : masterBoard.updatedAt;
  const discoverySlugs = discoveryFocus
    ? new Set(highPriority.map((p) => p.slug.toLowerCase()))
    : null;
  const cards: SignalCard[] = [];

  for (const note of staffNotes.notes.slice(0, 12)) {
    if (discoverySlugs && !discoverySlugs.has(note.playerSlug.toLowerCase())) continue;
    const player = bySlug.get(note.playerSlug);
    const suppressed = Boolean(note.ufPredictionSuppressed || player?.ufPredictionSuppressed);
    const status =
      note.commitmentStatus ||
      player?.commitmentStatus ||
      'Committed elsewhere — UF prediction suppressed';
    if (suppressed) {
      cards.push({
        id: note.id ?? `${note.playerSlug}-${note.updatedAt}`,
        slug: note.playerSlug,
        name: note.playerName,
        position: note.position ?? player?.position ?? '—',
        analyst: 'Staff Notes',
        pick: 'Suppressed',
        confidencePct: null,
        rpmPct: null,
        summary: status,
        timestamp: note.updatedAt ?? note.createdAt ?? staffNotes.updatedAt,
        suppressed: true,
      });
      continue;
    }
    const ufPct = player ? ufPctFromFc(player.ufConfidence) : 50;
    cards.push({
      id: note.id ?? `${note.playerSlug}-${note.updatedAt}`,
      slug: note.playerSlug,
      name: note.playerName,
      position: note.position ?? player?.position ?? '—',
      analyst: 'Staff Notes',
      pick: ufPct >= 50 ? 'UF' : 'Open',
      confidencePct: ufPct,
      rpmPct: ufPct,
      summary: note.notePreview ?? note.note ?? note.staffNotes ?? 'FutureCast staff activity.',
      timestamp: note.updatedAt ?? note.createdAt ?? staffNotes.updatedAt,
    });
  }

  for (const p of modelPool.slice(0, 6)) {
    if (cards.length >= 8) break;
    if (p.ufPredictionSuppressed) continue;
    const pct = ufPctFromFc(p.ufConfidence);
    cards.push({
      id: `model-${p.slug}`,
      slug: p.slug,
      name: p.name,
      position: p.position,
      analyst: 'FutureCast Model',
      pick: pct >= 50 ? 'UF' : 'Open',
      confidencePct: pct,
      rpmPct: pct,
      summary: `Model projection ${pct}% for ${p.name}.`,
      timestamp: modelTimestamp,
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
        {card.position} ·{' '}
        {card.suppressed ? (
          <strong>{card.summary}</strong>
        ) : (
          <>
            Pick: <strong>{card.pick}</strong>
          </>
        )}
      </p>
      {!card.suppressed ? (
        <>
          <div className="fc-lab-signal-card__metrics">
            <span className="fc-lab-signal-card__metric">Confidence {card.confidencePct}%</span>
            <span className="fc-lab-signal-card__metric">UF RPM {card.rpmPct}%</span>
          </div>
          <AnalystConfidenceMeter value={card.confidencePct ?? 0} label="Signal strength" />
        </>
      ) : null}
      <p className="fc-lab-signal-card__summary">{card.summary}</p>
    </article>
  );
}

export function FutureCastAnalystSignals({
  staffNotes,
  masterBoard,
  highPriority = [],
  bare,
}: Props): React.ReactElement {
  const { discoveryView: discoveryFocus } = useFutureCastLabCycle();
  const focusYear = discoveryFocus ? 2028 : 2027;
  const signals = useMemo(
    () => buildSignals(staffNotes, masterBoard, highPriority, discoveryFocus),
    [staffNotes, masterBoard, highPriority, discoveryFocus]
  );

  const title = discoveryFocus
    ? `Analyst Signals — ${focusYear} Discovery`
    : 'Analyst Signals — FutureCast Activity';
  const sub = discoveryFocus
    ? 'Model signals for locked 2028 allowlist targets during early discovery.'
    : 'Staff notes and FutureCast model signals — prediction engine only.';

  return (
    <FutureCastPanelShell
      bare={bare}
      title={title}
      sub={sub}
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
