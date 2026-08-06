/**
 * Overview tab — universal Who / Stand / Context / Pulse.
 */
import React from 'react';
import type { PlayerProfileBundle } from '../../../lib/player-api';
import type { PlayerMetrics } from '../../../lib/player-derived';
import { signalSummaryText, formatSignalValue, formatDate } from '../../../lib/player-derived';
import { dedupeDiscoverySignals, isFeedSignal, signalTimestamp } from '../../../lib/player-profile-normalize';
import { coerceDisplayText } from '../../../lib/coerce-text';
import { RelatedPlayers } from './RelatedPlayers';
import { PredictionsPanel } from './PredictionsPanel';
import type { FullProfileCompetingSchool, FullProfileFuturecastSummary } from '@/lib/player-full-profile-api';
import type { PlayerPrediction } from '@/lib/predictions-api';
import {
  resolveProfileOverviewMode,
  buildRecruitingStand,
  buildRecruitingContext,
  shouldShowFutureCastPicks,
} from '@/lib/player-overview-mode';
import { resolveCommittedTo } from '@/lib/recruiting-target-filters';
import { OverviewFourSlot } from '@/components/player/OverviewFourSlot';
import { VaultScoutingSection } from './VaultScoutingSection';
import type { FullProfileVaultScouting } from '@/lib/player-full-profile-api';

function profileNotesDeduped(
  recruitingNotes: unknown,
  evaluationNotes: unknown
): { recruitingNotes: string | null; evaluationNotes: string | null } {
  const hs = coerceDisplayText(recruitingNotes);
  const evalN = coerceDisplayText(evaluationNotes);
  if (!hs || !evalN) return { recruitingNotes: hs, evaluationNotes: evalN };
  const na = hs.toLowerCase().replace(/\s+/g, ' ').trim();
  const nb = evalN.toLowerCase().replace(/\s+/g, ' ').trim();
  if (na === nb || (na.length >= 24 && (na.includes(nb) || nb.includes(na)))) {
    return { recruitingNotes: hs, evaluationNotes: null };
  }
  return { recruitingNotes: hs, evaluationNotes: evalN };
}

function signalMeta(signal: { signalType: string; createdAt?: string | null }): string {
  const type = String(signal.signalType || '').toUpperCase();
  const date = formatDate(signal.createdAt);
  if (type === 'OFFER') {
    return date !== '—' ? date : 'Offer';
  }
  if (date !== '—') return date;
  return '';
}

export interface OverviewTabProps {
  data: PlayerProfileBundle;
  metrics: PlayerMetrics;
  competingSchools?: FullProfileCompetingSchool[];
  futurecastSummary?: FullProfileFuturecastSummary | null;
  initialPredictions?: PlayerPrediction[];
  vaultScouting?: FullProfileVaultScouting | null;
}

export function OverviewTab({
  data,
  metrics,
  competingSchools = [],
  futurecastSummary = null,
  initialPredictions,
  vaultScouting = null,
}: OverviewTabProps): React.ReactElement {
  const { player, signals, related, highSchoolProfile, collegeProfile, portalProfile, ufSpecificProfile } =
    data;
  const offerCount = highSchoolProfile?.offers?.length ?? 0;
  const eventSignals = dedupeDiscoverySignals(signals).filter(isFeedSignal);
  const recentSignals = [...eventSignals]
    .sort((a, b) => signalTimestamp(b.createdAt) - signalTimestamp(a.createdAt))
    .slice(0, 5);
  const notes = profileNotesDeduped(
    highSchoolProfile?.recruitingNotes,
    ufSpecificProfile?.evaluationNotes
  );
  const mode = resolveProfileOverviewMode(player);
  const stand = buildRecruitingStand({
    player,
    metrics,
    competingSchools,
    futurecastSummary,
    staffNote: notes.recruitingNotes,
    evaluationNote: notes.evaluationNotes,
  });
  const context = buildRecruitingContext({
    mode,
    player,
    collegeProfile,
    portalProfile,
    competingSchools,
    futurecastSummary,
  });
  const committedTo = resolveCommittedTo(player);
  const on3Uf = futurecastSummary?.on3UfProbability ?? null;
  const gvUf = futurecastSummary?.gvProbability ?? null;
  const showPicks = shouldShowFutureCastPicks(mode);

  const who = (
    <dl className="fc-profile-dl fc-overview-who-dl">
      <div><dt>Position</dt><dd>{player.position}</dd></div>
      <div><dt>Class</dt><dd>{player.classYear}</dd></div>
      <div><dt>Lifecycle</dt><dd>{player.status}</dd></div>
      {player.highSchool ? (
        <div><dt>High School</dt><dd>{player.highSchool}</dd></div>
      ) : null}
      {collegeProfile?.college ? (
        <div><dt>College</dt><dd>{collegeProfile.college}</dd></div>
      ) : null}
      {portalProfile?.portalStatus ? (
        <div><dt>Portal</dt><dd>{portalProfile.portalStatus.replace(/_/g, ' ')}</dd></div>
      ) : null}
      {committedTo ? (
        <div><dt>Committed</dt><dd>{committedTo}</dd></div>
      ) : null}
    </dl>
  );

  const pulse =
    recentSignals.length > 0 ? (
      <ul className="fc-signal-feed fc-signal-feed--compact">
        {recentSignals.map((s) => (
          <li key={s.id}>
            <span className="fc-signal-feed__type">{s.signalType.replace(/_/g, ' ')}</span>
            <span className="fc-signal-feed__value">{formatSignalValue(s)}</span>
            {signalMeta(s) ? (
              <span className="fc-signal-feed__meta">{signalMeta(s)}</span>
            ) : null}
          </li>
        ))}
      </ul>
    ) : offerCount > 0 ? (
      <p className="fc-profile-muted">
        {offerCount} offers on file — open the High School tab for the full list. Dated offer events
        appear here when On3 provides a real offer date.
      </p>
    ) : (
      <p className="fc-profile-muted">{signalSummaryText(eventSignals)}</p>
    );

  const moveDelta = futurecastSummary?.movementDelta;

  return (
    <div className="fc-profile-panel" data-testid="tab-overview">
      <OverviewFourSlot mode={mode} who={who} stand={stand} context={context} pulse={pulse} />

      <VaultScoutingSection scouting={vaultScouting} />

      {showPicks ? (
        <section className="fc-profile-section fc-profile-section--picks">
          <h2>FutureCast Picks</h2>
          <p className="fc-profile-muted fc-profile-section__lede">
            {on3Uf != null && gvUf != null
              ? `On3 market has Florida at ${on3Uf}% · GatorVault model at ${gvUf}%`
              : 'GatorVault model for Florida · On3 RPM for competitor schools'}
            {moveDelta != null && Number(moveDelta) !== 0
              ? ` · GV movement ${Number(moveDelta) > 0 ? '+' : ''}${Math.round(Number(moveDelta))} over 7 days`
              : ''}
          </p>
          <PredictionsPanel
            playerId={player.id}
            playerSlug={player.slug}
            classYear={player.classYear}
            initialPredictions={initialPredictions}
          />
        </section>
      ) : null}

      <section className="fc-profile-section">
        <h2>Related Players</h2>
        <RelatedPlayers players={related} currentSlug={player.slug} />
      </section>
    </div>
  );
}