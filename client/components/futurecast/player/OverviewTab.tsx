/**
 * Overview tab — unified player summary.
 */
import React from 'react';
import type { PlayerProfileBundle } from '../../../lib/player-api';
import type { PlayerMetrics } from '../../../lib/player-derived';
import { signalSummaryText, formatSignalValue, formatDate, signalWeight } from '../../../lib/player-derived';
import { dedupeDiscoverySignals, signalTimestamp } from '../../../lib/player-profile-normalize';
import { coerceDisplayText } from '../../../lib/coerce-text';
import { RelatedPlayers } from './RelatedPlayers';
import { PredictionsPanel } from './PredictionsPanel';
import { BoardIntelPanel } from './BoardIntelPanel';
import type { FullProfileCompetingSchool, FullProfileFuturecastSummary } from '@/lib/player-full-profile-api';
import type { PlayerPrediction } from '@/lib/predictions-api';

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
  // Competing interest is a market snapshot — don't pretend weight/date are offer intel.
  if (type === 'COMPETING_INTEREST') {
    return date !== '—' ? `market · ${date}` : 'On3 market';
  }
  if (type === 'OFFER') {
    return date !== '—' ? date : 'offer';
  }
  const weight = signalWeight(signal.signalType);
  return date !== '—' ? `${date} · weight ${weight}` : `weight ${weight}`;
}

export interface OverviewTabProps {
  data: PlayerProfileBundle;
  metrics: PlayerMetrics;
  competingSchools?: FullProfileCompetingSchool[];
  futurecastSummary?: FullProfileFuturecastSummary | null;
  initialPredictions?: PlayerPrediction[];
}

export function OverviewTab({
  data,
  metrics,
  competingSchools = [],
  futurecastSummary = null,
  initialPredictions,
}: OverviewTabProps): React.ReactElement {
  const { player, signals, related, highSchoolProfile, collegeProfile, portalProfile, ufSpecificProfile } =
    data;
  const recentSignals = dedupeDiscoverySignals(signals)
    .sort((a, b) => signalTimestamp(b.createdAt) - signalTimestamp(a.createdAt))
    .slice(0, 5);
  const notes = profileNotesDeduped(
    highSchoolProfile?.recruitingNotes,
    ufSpecificProfile?.evaluationNotes
  );
  const staffNoteInBoard =
    !!notes.recruitingNotes &&
    (!!(futurecastSummary?.ufProbability) || competingSchools.some((c) => !!c.pct));

  return (
    <div className="fc-profile-panel" data-testid="tab-overview">
      <section className="fc-profile-section">
        <h2>Identity</h2>
        <dl className="fc-profile-dl">
          <div><dt>Position</dt><dd>{player.position}</dd></div>
          <div><dt>Class</dt><dd>{player.classYear}</dd></div>
          <div><dt>Lifecycle</dt><dd>{player.status}</dd></div>
          {player.highSchool && <div><dt>High School</dt><dd>{player.highSchool}</dd></div>}
          {collegeProfile?.college && <div><dt>College</dt><dd>{collegeProfile.college}</dd></div>}
          {portalProfile?.portalStatus && (
            <div><dt>Portal</dt><dd>{portalProfile.portalStatus.replace(/_/g, ' ')}</dd></div>
          )}
        </dl>
      </section>

      <BoardIntelPanel
        ufProbability={
          futurecastSummary?.on3UfProbability ?? futurecastSummary?.ufProbability ?? null
        }
        competingSchools={competingSchools}
        futurecastSummary={futurecastSummary}
        staffNote={notes.recruitingNotes}
      />

      <section className="fc-profile-section fc-profile-section--picks">
        <h2>FutureCast Picks</h2>
        <p className="fc-profile-muted fc-profile-section__lede">
          GatorVault likelihood for Florida · On3 RPM for competitor schools
        </p>
        <PredictionsPanel
          playerId={player.id}
          playerSlug={player.slug}
          classYear={player.classYear}
          initialPredictions={initialPredictions}
        />
      </section>

      <section className="fc-profile-section">
        <h2>Intelligence</h2>
        <div className="fc-profile-metrics-row">
          <div><strong>UF Fit Score™</strong><br />{metrics.ufFitScore}{metrics.ufFitLabel ? ` · ${metrics.ufFitLabel}` : ''}</div>
          {!metrics.portalHidden ? (
            <div><strong>Portal Likelihood</strong><br />{metrics.portalLikelihoodPct ?? 0}%</div>
          ) : null}
          <div><strong>Signals</strong><br />{metrics.signalCount}</div>
        </div>
        <p className="fc-profile-muted">{signalSummaryText(signals)}</p>
      </section>

      {recentSignals.length > 0 && (
        <section className="fc-profile-section">
          <h2>Recent Signals</h2>
          <ul className="fc-signal-feed fc-signal-feed--compact">
            {recentSignals.map((s) => (
              <li key={s.id}>
                <span className="fc-signal-feed__type">{s.signalType.replace(/_/g, ' ')}</span>
                <span className="fc-signal-feed__value">{formatSignalValue(s)}</span>
                <span className="fc-signal-feed__meta">{signalMeta(s)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(notes.recruitingNotes && !staffNoteInBoard) || notes.evaluationNotes ? (
        <section className="fc-profile-section">
          <h2>Notes</h2>
          {notes.recruitingNotes && !staffNoteInBoard ? <p>{notes.recruitingNotes}</p> : null}
          {notes.evaluationNotes ? (
            <p className={notes.recruitingNotes ? 'fc-profile-muted' : undefined}>
              {notes.evaluationNotes}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="fc-profile-section">
        <h2>Related Players</h2>
        <RelatedPlayers players={related} currentSlug={player.slug} />
      </section>
    </div>
  );
}
