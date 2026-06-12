/**
 * Overview tab — unified player summary.
 */
import React from 'react';
import type { PlayerProfileBundle } from '../../../lib/player-api';
import type { PlayerMetrics } from '../../../lib/player-derived';
import { signalSummaryText, formatSignalValue, formatDate, signalWeight } from '../../../lib/player-derived';
import { RelatedPlayers } from './RelatedPlayers';
import { PredictionsPanel } from './PredictionsPanel';

export interface OverviewTabProps {
  data: PlayerProfileBundle;
  metrics: PlayerMetrics;
}

export function OverviewTab({ data, metrics }: OverviewTabProps): React.ReactElement {
  const { player, signals, related, highSchoolProfile, collegeProfile, portalProfile, ufSpecificProfile } =
    data;
  const recentSignals = [...signals]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

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
          <div><strong>UF Fit Score™</strong><br />{metrics.ufFitScore}</div>
          <div><strong>Portal Likelihood</strong><br />{metrics.portalLikelihoodPct}%</div>
          <div><strong>Signals</strong><br />{metrics.signalCount}</div>
        </div>
        <p className="fc-profile-muted">{signalSummaryText(signals)}</p>
      </section>

      <section className="fc-profile-section">
        <h2>FutureCast Picks</h2>
        <PredictionsPanel playerId={player.id} />
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

      {(highSchoolProfile?.recruitingNotes || ufSpecificProfile?.evaluationNotes) && (
        <section className="fc-profile-section">
          <h2>Notes</h2>
          {highSchoolProfile?.recruitingNotes && <p>{highSchoolProfile.recruitingNotes}</p>}
          {ufSpecificProfile?.evaluationNotes && <p>{ufSpecificProfile.evaluationNotes}</p>}
        </section>
      )}

      <section className="fc-profile-section">
        <h2>Related Players</h2>
        <RelatedPlayers players={related} currentSlug={player.slug} />
      </section>
    </div>
  );
}
