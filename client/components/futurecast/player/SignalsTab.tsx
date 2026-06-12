/**
 * Discovery signals feed — newest first.
 */
import React from 'react';
import type { DiscoverySignal } from '../../../lib/player-api';
import { formatDate, formatSignalValue, signalWeight } from '../../../lib/player-derived';

export interface SignalsTabProps {
  signals: DiscoverySignal[];
}

export function SignalsTab({ signals }: SignalsTabProps): React.ReactElement {
  const sorted = [...signals].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (!sorted.length) {
    return <p className="fc-profile-empty">No discovery signals recorded.</p>;
  }

  return (
    <div className="fc-profile-panel" data-testid="tab-signals">
      <ul className="fc-signal-feed">
        {sorted.map((s) => (
          <li key={s.id} className="fc-signal-feed__item">
            <div className="fc-signal-feed__head">
              <span className="fc-signal-feed__type">{s.signalType.replace(/_/g, ' ')}</span>
              <span className="fc-signal-feed__weight">Weight {signalWeight(s.signalType)}</span>
            </div>
            <p className="fc-signal-feed__value">{formatSignalValue(s)}</p>
            <time className="fc-signal-feed__meta">{formatDate(s.createdAt)}</time>
          </li>
        ))}
      </ul>
    </div>
  );
}
