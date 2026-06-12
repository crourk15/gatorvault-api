/**
 * Portal profile tab — Phase 6 Portal Intelligence integration.
 */
import React from 'react';
import type { CollegeProfile, DiscoverySignal, PlayerCore, PortalProfile } from '../../../lib/player-api';
import type { PortalIntelPayload, TransferPrediction } from '../../../lib/portal-api';
import { portalLikelihoodPct } from '../../../lib/portal-api';
import { daysInPortal, formatDate } from '../../../lib/player-derived';
import { ReasonTags } from '../ReasonTags';

export interface PortalTabProps {
  player: PlayerCore;
  profile: PortalProfile | null;
  collegeProfile: CollegeProfile | null;
  signals: DiscoverySignal[];
  intel?: PortalIntelPayload | null;
  predictions?: TransferPrediction[];
  intelLoading?: boolean;
}

function LikelihoodTrend({ trend }: { trend: Array<{ date: string; likelihood: number }> }): React.ReactElement {
  if (!trend.length) return <></>;
  const max = Math.max(...trend.map((t) => t.likelihood), 0.01);
  return (
    <div className="fc-portal-trend" data-testid="portal-likelihood-trend">
      {trend.map((point) => {
        const h = Math.max(4, Math.round((point.likelihood / max) * 48));
        return (
          <div
            key={point.date}
            className="fc-portal-trend__bar"
            style={{ height: `${h}px` }}
            title={`${point.date}: ${portalLikelihoodPct(point.likelihood)}%`}
          />
        );
      })}
    </div>
  );
}

export function PortalTab({
  player,
  profile,
  collegeProfile,
  signals,
  intel,
  predictions = [],
  intelLoading,
}: PortalTabProps): React.ReactElement {
  const hasPortalData = profile || player.status === 'COLLEGE' || player.status === 'PORTAL';

  if (!hasPortalData) {
    return <p className="fc-profile-empty">No portal intelligence on file.</p>;
  }

  const portalDays = profile ? daysInPortal(profile) : null;
  const likelihood = intel
    ? portalLikelihoodPct(intel.portalLikelihood)
    : profile?.portalLikelihood != null
      ? portalLikelihoodPct(profile.portalLikelihood)
      : player.status === 'PORTAL'
        ? 100
        : 0;

  const portalSignals = signals.filter(
    (s) =>
      s.signalType === 'PORTAL_ACTIVITY' ||
      s.signalType === 'SOCIAL_MOMENTUM' ||
      s.signalType === 'STAFF_FLAG'
  );

  return (
    <div className="fc-profile-panel" data-testid="tab-portal">
      {intelLoading && <p className="fc-profile-muted">Loading portal intelligence…</p>}

      {intel && (
        <section className="fc-profile-section">
          <h2>Portal Intelligence</h2>
          <dl className="fc-profile-dl">
            <div><dt>Portal Likelihood</dt><dd>{portalLikelihoodPct(intel.portalLikelihood)}%</dd></div>
            <div><dt>Depth Chart Risk</dt><dd>{intel.depthChartRisk}</dd></div>
            <div><dt>Snap Share Score</dt><dd>{intel.snapShareScore}</dd></div>
            <div><dt>Volatility Index</dt><dd>{intel.volatility}</dd></div>
            {intel.snapShare != null && (
              <div><dt>Snap Share</dt><dd>{Math.round(intel.snapShare * 100)}%</dd></div>
            )}
          </dl>
          {intel.likelihoodTrend.length > 0 && (
            <>
              <p className="fc-profile-muted">Likelihood trend (30 days)</p>
              <LikelihoodTrend trend={intel.likelihoodTrend} />
            </>
          )}
        </section>
      )}

      {profile && (
        <section className="fc-profile-section">
          <h2>Portal Status</h2>
          <dl className="fc-profile-dl">
            <div><dt>Status</dt><dd>{profile.portalStatus.replace(/_/g, ' ')}</dd></div>
            <div><dt>Previous School</dt><dd>{profile.previousSchool || collegeProfile?.college || '—'}</dd></div>
            <div><dt>Destination</dt><dd>{profile.destinationSchool || '—'}</dd></div>
            <div><dt>Entered</dt><dd>{formatDate(profile.enteredPortalAt)}</dd></div>
            <div><dt>Exited</dt><dd>{formatDate(profile.exitedPortalAt)}</dd></div>
            {portalDays != null && <div><dt>Days in Portal</dt><dd>{portalDays}</dd></div>}
          </dl>
        </section>
      )}

      <section className="fc-profile-section">
        <h2>Portal Likelihood</h2>
        <p className="fc-portal-likelihood-big">{likelihood}%</p>
        {profile?.likelihoodReason && <p className="fc-profile-muted">{profile.likelihoodReason}</p>}
      </section>

      {predictions.length > 0 && (
        <section className="fc-profile-section">
          <h2>Transfer Predictions</h2>
          <ul className="fc-prediction-list">
            {predictions.map((pred) => (
              <li key={pred.school} className="fc-prediction-item">
                <span className="fc-prediction-item__school">{pred.school}</span>
                <div className="fc-prediction-item__bar-wrap">
                  <div
                    className="fc-prediction-item__bar"
                    style={{ width: `${Math.round(pred.score * 100)}%` }}
                  />
                </div>
                <span className="fc-prediction-item__score">{Math.round(pred.score * 100)}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile && profile.reasonTags.length > 0 && (
        <section className="fc-profile-section">
          <h2>Reason Tags</h2>
          <ReasonTags tags={profile.reasonTags} />
        </section>
      )}

      {portalSignals.length > 0 && (
        <section className="fc-profile-section">
          <h2>Portal Activity Signals</h2>
          <ul className="fc-signal-feed fc-signal-feed--compact">
            {portalSignals.map((s) => (
              <li key={s.id}>
                <span className="fc-signal-feed__type">{s.signalType.replace(/_/g, ' ')}</span>
                <span className="fc-signal-feed__meta">{formatDate(s.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
