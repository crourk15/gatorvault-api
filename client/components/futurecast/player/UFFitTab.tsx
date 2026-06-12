/**
 * UF Fit profile tab — Phase 7 full breakdown + delta + volatility + history.
 */
import React from 'react';
import type { UFSpecificProfile } from '../../../lib/player-api';
import type { UfFitIntelResponse } from '../../../lib/uf-fit-api';
import { fitTierLabel, formatFitDelta } from '../../../lib/uf-fit-api';

export interface UFFitTabProps {
  profile: UFSpecificProfile | null;
  intel?: UfFitIntelResponse | null;
  intelLoading?: boolean;
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }): React.ReactElement {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="fc-uf-bar">
      <div className="fc-uf-bar__header">
        <span>{label}</span>
        <span>{value.toFixed(1)} / {max}</span>
      </div>
      <div className="fc-uf-bar__track">
        <div className="fc-uf-bar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function FitHistoryChart({ history }: { history: Array<{ date: string; score: number }> }): React.ReactElement {
  if (!history.length) return <></>;
  const max = Math.max(...history.map((h) => h.score), 1);
  return (
    <div className="fc-uf-history" data-testid="uf-fit-history">
      {history.map((point) => {
        const h = Math.max(4, Math.round((point.score / max) * 56));
        return (
          <div
            key={point.date}
            className="fc-uf-history__bar"
            style={{ height: `${h}px` }}
            title={`${point.date}: ${point.score}`}
          />
        );
      })}
    </div>
  );
}

export function UFFitTab({ profile, intel, intelLoading }: UFFitTabProps): React.ReactElement {
  if (!profile && !intel) {
    return <p className="fc-profile-empty">No UF-specific profile on file.</p>;
  }

  if (intelLoading && !intel) {
    return <p className="fc-profile-muted">Loading UF Fit intelligence…</p>;
  }

  const total = intel?.ufFitScore ?? profile?.ufFitScore ?? 0;
  const tier = intel?.fitTier ?? 'low';
  const scheme = intel?.schemeFit ?? 0;
  const culture = intel?.cultureFit ?? 0;
  const need = intel?.positionalNeed ?? 0;
  const staff = intel?.staffInterest ?? 0;
  const delta = intel?.fitDelta ?? 0;
  const volatility = intel?.fitVolatility ?? 0;

  return (
    <div className="fc-profile-panel" data-testid="tab-uf-fit">
      <section className="fc-profile-section">
        <h2>UF Fit Score™</h2>
        <div className={`fc-uf-total fc-uf-total--${tier}`}>
          <span className="fc-uf-total__score">{total}</span>
          <span className="fc-uf-total__tier">{fitTierLabel(tier)}</span>
        </div>
        <div className="fc-uf-fit-meta">
          <span className={`fc-uf-fit-delta${delta >= 0 ? ' fc-uf-fit-delta--up' : ' fc-uf-fit-delta--down'}`}>
            Δ {formatFitDelta(delta)} <span className="fc-profile-muted">(30d)</span>
          </span>
          <span className="fc-portal-metric">Volatility {volatility}</span>
        </div>
        {profile?.ufStatus && (
          <p className="fc-profile-muted">UF Status: {profile.ufStatus.replace(/_/g, ' ')}</p>
        )}
      </section>

      <section className="fc-profile-section">
        <h2>Component Breakdown</h2>
        <ScoreBar label="Scheme Fit" value={scheme} max={40} />
        <ScoreBar label="Culture Fit" value={culture} max={30} />
        <ScoreBar label="Positional Need" value={need} max={20} />
        <ScoreBar label="Staff Interest" value={staff} max={10} />
      </section>

      {intel?.history && intel.history.length > 0 && (
        <section className="fc-profile-section">
          <h2>Fit History</h2>
          <FitHistoryChart history={intel.history} />
          <ul className="fc-uf-history-labels">
            {intel.history.slice(-5).map((p) => (
              <li key={p.date}>{p.date}: {p.score}</li>
            ))}
          </ul>
        </section>
      )}

      {profile?.evaluationNotes && (
        <section className="fc-profile-section">
          <h2>Evaluation Notes</h2>
          <p>{profile.evaluationNotes}</p>
        </section>
      )}

      {profile && profile.tags.length > 0 && (
        <section className="fc-profile-section">
          <h2>Tags</h2>
          <div className="fc-tag-list">
            {profile.tags.map((tag) => (
              <span key={tag} className="fc-tag">{tag.replace(/_/g, ' ')}</span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
