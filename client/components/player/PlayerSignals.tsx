/**
 * Player discovery signals feed — card list with type, description, and impact.
 */
import React from 'react';
import type { DiscoverySignal } from '@/lib/player-api';
import { formatSignalValue, signalWeight } from '@/lib/player-derived';

export interface PlayerSignalItem {
  type: string;
  createdAt: string;
  description: string;
  confidence?: number | null;
}

export interface PlayerSignalsProps {
  signals: PlayerSignalItem[] | DiscoverySignal[];
}

function isDiscoverySignal(
  signal: PlayerSignalItem | DiscoverySignal
): signal is DiscoverySignal {
  return 'signalType' in signal && 'signalValue' in signal;
}

function normalizeSignal(signal: PlayerSignalItem | DiscoverySignal): PlayerSignalItem {
  if (!isDiscoverySignal(signal)) return signal;

  const weight = signalWeight(signal.signalType);
  return {
    type: signal.signalType,
    createdAt: signal.createdAt,
    description: formatSignalValue(signal),
    confidence: weight > 0 ? weight : null,
  };
}

export function discoverySignalsToItems(signals: DiscoverySignal[]): PlayerSignalItem[] {
  return signals.map(normalizeSignal);
}

export function PlayerSignals({ signals }: PlayerSignalsProps): React.ReactElement {
  const items = signals.map(normalizeSignal);

  if (!items.length) {
    return (
      <p className="fc-player-signals__empty" data-testid="player-signals-empty">
        No recent signals for this player.
      </p>
    );
  }

  return (
    <div className="fc-player-signals" data-testid="player-signals">
      {items.map((sig, i) => (
        <div key={`${sig.type}-${sig.createdAt}-${i}`} className="fc-player-signals__card">
          <div className="fc-player-signals__head">
            <span className="fc-player-signals__type">{sig.type.replace(/_/g, ' ')}</span>
            <span className="fc-player-signals__date">
              {new Date(sig.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="fc-player-signals__description">{sig.description}</p>
          {sig.confidence != null && sig.confidence !== 0 && (
            <p className="fc-player-signals__impact">
              Confidence impact: {sig.confidence > 0 ? '+' : ''}
              {sig.confidence}%
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
