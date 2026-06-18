'use client';

import React from 'react';
import { formatRelativeUpdated } from '@/components/recruiting-hub/utils/formatDate';
import { playerProfilePath } from '@/lib/player-routes';
import { playerProfileRoute } from '@/lib/site-routes';
import type { HighPriorityIntelItem, HighPriorityIntelType } from './types';
import './high-priority-intel-card.css';

type Props = {
  item: HighPriorityIntelItem;
};

function getIntelIcon(type: HighPriorityIntelType): string {
  switch (type) {
    case 'BATTLE':
      return '⚠️';
    case 'VISIT':
      return '📍';
    case 'RPM':
      return '🎯';
    case 'NIL':
      return '💰';
    case 'HEAT':
      return '🔥';
    default:
      return 'ℹ️';
  }
}

function getIntelTintClass(type: HighPriorityIntelType): string {
  switch (type) {
    case 'BATTLE':
      return 'hp-intel-card--battle';
    case 'VISIT':
      return 'hp-intel-card--visit';
    case 'RPM':
      return 'hp-intel-card--rpm';
    case 'NIL':
      return 'hp-intel-card--nil';
    case 'HEAT':
      return 'hp-intel-card--heat';
    default:
      return '';
  }
}

function formatShortTime(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function HighPriorityIntelCard({ item }: Props): React.ReactElement {
  const icon = getIntelIcon(item.intelType);
  const tintClass = getIntelTintClass(item.intelType);
  const ufProb = Math.max(0, Math.min(100, Math.round(item.ufProb)));

  return (
    <article className={`hp-intel-card ${tintClass}`} data-testid="hp-intel-card">
      <header className="hp-intel-header">
        <div className="hp-intel-title">
          <span className="hp-intel-name">{item.name}</span>
          <span className="hp-intel-meta">
            {item.position}
            {item.school ? ` · ${item.school}` : ''} · {item.classYear}
          </span>
        </div>
        <div className="hp-intel-label">
          <span className="hp-intel-icon" aria-hidden="true">
            {icon}
          </span>
          <span className="hp-intel-label-text">{item.intelLabel}</span>
        </div>
      </header>

      <section className="hp-intel-prob">
        <div className="hp-intel-prob-main">
          <span className="hp-intel-prob-value">{ufProb}%</span>
          <span className="hp-intel-prob-caption">UF Probability</span>
        </div>
        <div className="hp-intel-prob-bar" role="img" aria-label={`UF probability ${ufProb} percent`}>
          <div className="hp-intel-prob-fill" style={{ width: `${ufProb}%` }} />
        </div>
        <div className="hp-intel-prob-delta">
          {item.delta7d > 0 ? (
            <span className="hp-intel-badge hp-intel-badge--up">↑ +{item.delta7d}% (7d)</span>
          ) : item.delta7d < 0 ? (
            <span className="hp-intel-badge hp-intel-badge--down">↓ {item.delta7d}% (7d)</span>
          ) : (
            <span className="hp-intel-badge hp-intel-badge--flat">±0% (7d)</span>
          )}
        </div>
      </section>

      <section className="hp-intel-summary">
        <p className="hp-intel-summary-text">{item.intelSummary}</p>
      </section>

      {item.analystSignals.length > 0 ? (
        <section className="hp-intel-analyst">
          <h4 className="hp-intel-section-title">🎯 Analyst Signals</h4>
          <ul className="hp-intel-analyst-list">
            {item.analystSignals.map((signal) => (
              <li key={signal.id} className="hp-intel-analyst-item">
                <div className="hp-intel-analyst-header">
                  <span className="hp-intel-analyst-name">
                    {signal.analyst}
                    <span className="hp-intel-analyst-outlet"> · {signal.outlet}</span>
                  </span>
                  <span className="hp-intel-analyst-time">{formatShortTime(signal.timestamp)}</span>
                </div>
                <div className="hp-intel-analyst-metrics">
                  <div className="hp-intel-analyst-metric">
                    <span className="hp-intel-analyst-label">Confidence</span>
                    <span className="hp-intel-analyst-value">{signal.confidencePct}%</span>
                  </div>
                  <div className="hp-intel-analyst-metric">
                    <span className="hp-intel-analyst-label">UF RPM</span>
                    <span className="hp-intel-analyst-value">{signal.rpmPct}%</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="hp-intel-footer">
        <time className="hp-intel-updated" dateTime={item.lastUpdated}>
          Updated {formatRelativeUpdated(item.lastUpdated)}
        </time>
        <div className="hp-intel-actions">
          <a
            href={playerProfileRoute(item.slug, 'futurecast')}
            className="hp-intel-btn hp-intel-btn--primary"
          >
            FutureCast
          </a>
          <a
            href={playerProfilePath(item.slug, 'target', true, item.name, 'recruiting')}
            className="hp-intel-btn hp-intel-btn--ghost"
          >
            More Intel
          </a>
        </div>
      </footer>
    </article>
  );
}
