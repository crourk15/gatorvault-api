/**
 * Discovery signals feed — newest first.
 * Offer inventory lives on High School; this tab is for dated events only.
 */
import React from 'react';
import type { DiscoverySignal } from '../../../lib/player-api';
import { formatDate, formatSignalValue, fanSignalTypeLabel } from '../../../lib/player-derived';
import { dedupeDiscoverySignals, isFeedSignal, signalTimestamp } from '../../../lib/player-profile-normalize';

export interface SignalsTabProps {
  signals: DiscoverySignal[];
  offerCount?: number;
}

export function SignalsTab({ signals, offerCount = 0 }: SignalsTabProps): React.ReactElement {
  const sorted = dedupeDiscoverySignals(signals)
    .filter(isFeedSignal)
    .sort((a, b) => signalTimestamp(b.createdAt) - signalTimestamp(a.createdAt));

  if (!sorted.length) {
    return (
      <div className="fc-profile-panel" data-testid="tab-signals">
        <p className="fc-profile-empty">
          {offerCount > 0
            ? `${offerCount} offers on file — see the High School tab for the full list. Dated events appear here when available.`
            : 'No discovery signals recorded.'}
        </p>
      </div>
    );
  }

  return (
    <div className="fc-profile-panel" data-testid="tab-signals">
      {offerCount > 0 ? (
        <p className="fc-profile-muted fc-profile-section__lede">
          {offerCount} offers on file · High School tab has the full board
        </p>
      ) : null}
      <ul className="fc-signal-feed">
        {sorted.map((s) => (
          <li key={s.id} className="fc-signal-feed__item">
            <div className="fc-signal-feed__head">
              <span className="fc-signal-feed__type">{fanSignalTypeLabel(s.signalType)}</span>
              {formatDate(s.createdAt) !== '—' ? (
                <span className="fc-signal-feed__weight">{formatDate(s.createdAt)}</span>
              ) : null}
            </div>
            <p className="fc-signal-feed__value">{formatSignalValue(s)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
