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

export interface OverviewTabProps {
  data: PlayerProfileBundle;
  metrics: PlayerMetrics;
}

export function OverviewTab({ data, metrics }: OverviewTabProps): React.ReactElement {
  const { player, signals, related, highSchoolProfile, collegeProfile, portalProfile, ufSpecificProfile } =
    data;
  const recentSignals = dedupeDiscoverySignals(signals)
    .sort((a, b) => signalTimestamp(b.createdAt) - signalTimestamp(a.createdAt))
    .slice(0, 5);
  const hsNotes = coerceDisplayText(highSchoolProfile?.recruitingNotes);
  const evalNotes = coerceDisplayText(ufSpecificProfile?.evaluationNotes);

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

      <section className="fc-profile-section">
        <h2>FutureCast Picks</h2>
        <PredictionsPanel playerId={player.id} playerSlug={player.slug} classYear={player.classYear} />
      </section>

      {recentSignals.length > 0 && (
        <section className="fc-profile-section">
          <h2>Recent Signals</h2>
          <ul className="fc-signal-feed fc-signal-feed--compact">
            {recentSignals.map((s) => (
              <li key={s.id}>
                <span className="fc-signal-feed__type">{s.signalType.replace(/_/g, ' ')}</span>
                <span className="fc-signal-feed__value">{formatSignalValue(s)}</span>
                <span className="fc-signal-feed__meta">
                  {formatDate(s.createdAt)} · weight {signalWeight(s.signalType)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(hsNotes || evalNotes) && (
        <section className="fc-profile-section">
          <h2>Notes</h2>
          {hsNotes ? <p>{hsNotes}</p> : null}
          {evalNotes ? <p>{evalNotes}</p> : null}
        </section>
      )}

      <section className="fc-profile-section">
        <h2>Related Players</h2>
        <RelatedPlayers players={related} currentSlug={player.slug} />
      </section>
    </div>
  );
}
