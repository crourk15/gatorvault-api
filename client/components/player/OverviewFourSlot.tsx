/**
 * Shared Who / Stand / Context / Pulse overview shell.
 */
import React from 'react';

export type OverviewMetric = { label: string; value: string };

export type OverviewStand = {
  eyebrow: string;
  headline: string;
  metrics: OverviewMetric[];
  note?: string | null;
};

export type OverviewContextRow = {
  label: string;
  value: string;
  emphasize?: boolean;
};

export type OverviewContext = {
  title: string;
  rows: OverviewContextRow[];
  empty?: string | null;
};

export type OverviewWhoRow = { label: string; value: string };

export interface OverviewFourSlotProps {
  mode: string;
  /** Pre-built Who slot content. Prefer over whoRows when markup differs. */
  who?: React.ReactNode;
  whoRows?: OverviewWhoRow[];
  stand: OverviewStand;
  context: OverviewContext | null;
  pulse: React.ReactNode;
  /** Prefix for section heading ids (default: overview). */
  idPrefix?: string;
}

function WhoSlot({
  who,
  whoRows,
  whoId,
}: {
  who?: React.ReactNode;
  whoRows?: OverviewWhoRow[];
  whoId: string;
}): React.ReactElement {
  return (
    <section className="fc-overview-slot fc-profile-section" aria-labelledby={whoId}>
      <h2 id={whoId} className="fc-overview-title">Who</h2>
      {who != null ? (
        who
      ) : (
        <dl className="fc-profile-dl fc-overview-who-dl">
          {(whoRows ?? []).map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

export function OverviewFourSlot({
  mode,
  who,
  whoRows,
  stand,
  context,
  pulse,
  idPrefix = 'overview',
}: OverviewFourSlotProps): React.ReactElement {
  const whoId = `${idPrefix}-who`;
  const standId = `${idPrefix}-stand`;
  const contextId = `${idPrefix}-context`;
  const pulseId = `${idPrefix}-pulse`;

  return (
    <div className="fc-overview" data-overview-mode={mode}>
      <WhoSlot who={who} whoRows={whoRows} whoId={whoId} />

      <section
        className="fc-overview-slot fc-profile-section"
        aria-labelledby={standId}
        data-testid="overview-stand"
      >
        <p className="fc-overview-eyebrow">{stand.eyebrow}</p>
        <h2 id={standId} className="fc-overview-title">Stand</h2>
        <p className="fc-overview-headline">{stand.headline}</p>
        {stand.metrics.length > 0 ? (
          <div className="fc-overview-metrics">
            {stand.metrics.map((m) => (
              <div key={m.label} className="fc-overview-metric">
                <span className="fc-overview-metric__label">{m.label}</span>
                <span className="fc-overview-metric__value">{m.value}</span>
              </div>
            ))}
          </div>
        ) : null}
        {stand.note ? <p className="fc-profile-muted fc-overview-stand-note">{stand.note}</p> : null}
      </section>

      {context ? (
        <section
          className="fc-overview-slot fc-profile-section"
          aria-labelledby={contextId}
          data-testid="overview-context"
        >
          <h2 id={contextId} className="fc-overview-title">{context.title}</h2>
          {context.rows.length > 0 ? (
            <ul className="fc-overview-context-list">
              {context.rows.map((row) => (
                <li
                  key={`${row.label}-${row.value}`}
                  className={`fc-overview-context-row${row.emphasize ? ' fc-overview-context-row--emphasis' : ''}`}
                >
                  <span className="fc-overview-context-row__label">{row.label}</span>
                  <span className="fc-overview-context-row__value">{row.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fc-profile-muted">{context.empty}</p>
          )}
        </section>
      ) : null}

      <section
        className="fc-overview-slot fc-profile-section"
        aria-labelledby={pulseId}
        data-testid="overview-pulse"
      >
        <h2 id={pulseId} className="fc-overview-title">Pulse</h2>
        {pulse}
      </section>
    </div>
  );
}
