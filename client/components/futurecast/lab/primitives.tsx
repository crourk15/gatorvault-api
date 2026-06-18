'use client';

import React, { useEffect, useState } from 'react';
import {
  MovementSparkline,
  ufPctFromRaw,
} from '@/components/recruiting-hub/command-center/primitives';
import { ufPctFromFc } from './fc-lab-types';

export {
  ModuleShell,
  MovementSparkline,
  MovementBadge,
  UfProbBar,
  ufPctFromRaw,
} from '@/components/recruiting-hub/command-center/primitives';

/** Segmented UF vs UGA vs Bama bar derived from UF probability. */
export function CompetingSchoolsBar({ player }: { player: { ufProbability: number } }): React.ReactElement {
  const uf = ufPctFromFc(player.ufProbability);
  const remaining = Math.max(0, 100 - uf);
  const uga = Math.round(remaining * 0.45);
  const bama = remaining - uga;

  return (
    <div className="fc-lab-segment-bar" aria-label="Competing schools UF vs UGA vs Bama">
      <div className="fc-lab-segment-bar__track">
        <div className="fc-lab-segment-bar__uf" style={{ width: `${uf}%` }} title={`UF ${uf}%`} />
        <div className="fc-lab-segment-bar__uga" style={{ width: `${uga}%` }} title={`UGA ${uga}%`} />
        <div className="fc-lab-segment-bar__bama" style={{ width: `${bama}%` }} title={`Bama ${bama}%`} />
      </div>
      <span className="fc-lab-segment-bar__label">UF vs UGA vs Bama</span>
    </div>
  );
}

function fitBand(score: number): 'elite' | 'strong' | 'moderate' | 'low' {
  if (score > 80) return 'elite';
  if (score >= 60) return 'strong';
  return 'low';
}

export function FitScoreBadge({
  score,
}: {
  score: number | null | undefined;
}): React.ReactElement {
  if (score == null) {
    return <span className="fc-lab-fit fc-lab-fit--na">Fit: —</span>;
  }
  const pct = score <= 1 ? Math.round(score * 100) : Math.round(score);
  return (
    <span className={`fc-lab-fit fc-lab-fit--${fitBand(pct)}`} data-testid="fc-lab-fit-badge">
      Fit: {pct}/100
    </span>
  );
}

export function AnalystConfidenceMeter({
  value,
  label = 'Analyst confidence',
  subline,
}: {
  value: number | null | undefined;
  label?: string;
  subline?: string;
}): React.ReactElement {
  const pct = value == null ? 0 : value <= 1 ? Math.round(value * 100) : Math.round(value);
  const tone = pct >= 67 ? 'high' : pct >= 34 ? 'mid' : 'low';

  return (
    <div className="fc-lab-analyst" aria-label={`${label} ${pct}%`}>
      <span className="fc-lab-analyst__label">{label}</span>
      <div className="fc-lab-analyst__track">
        <div className={`fc-lab-analyst__fill fc-lab-analyst__fill--${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="fc-lab-analyst__value">{value == null ? '—' : `${pct}%`}</span>
      {subline ? <span className="fc-lab-analyst__sub">{subline}</span> : null}
    </div>
  );
}

export function UfProbabilityBarHero({
  value,
  delta7d,
  label = 'Commit Likelihood — Top Targets',
}: {
  value: number;
  delta7d: number;
  label?: string;
}): React.ReactElement {
  const [animated, setAnimated] = useState(0);
  const pct = Math.max(0, Math.min(100, value));
  const tone = pct >= 67 ? 'high' : pct >= 34 ? 'mid' : 'low';
  const trend = delta7d > 0 ? 'up' : delta7d < 0 ? 'down' : 'flat';

  useEffect(() => {
    const t = window.setTimeout(() => setAnimated(pct), 80);
    return () => window.clearTimeout(t);
  }, [pct]);

  return (
    <div className="fc-lab-meter" data-testid="fc-lab-uf-meter">
      <p className="fc-lab-meter__label">{label}</p>
      <div className={`fc-lab-meter__ring fc-lab-meter__ring--${tone}`}>
        <svg viewBox="0 0 120 120" className="fc-lab-meter__svg" aria-hidden>
          <circle cx="60" cy="60" r="52" className="fc-lab-meter__track" />
          <circle
            cx="60"
            cy="60"
            r="52"
            className={`fc-lab-meter__arc fc-lab-meter__arc--${tone}`}
            strokeDasharray={`${(animated / 100) * 327} 327`}
          />
        </svg>
        <div className="fc-lab-meter__center">
          <span className="fc-lab-meter__value">{pct}%</span>
          <span className="fc-lab-meter__hint">Top targets</span>
        </div>
      </div>
      <p className={`fc-lab-meter__trend fc-lab-meter__trend--${trend}`}>
        Trending {delta7d > 0 ? '↑' : delta7d < 0 ? '↓' : '→'} {delta7d > 0 ? '+' : ''}
        {delta7d}% (7d)
      </p>
      <div className="fc-lab-meter__spark">
        <MovementSparkline end={pct} delta={delta7d} />
        <span className="fc-lab-meter__spark-label">7-day UF probability</span>
      </div>
    </div>
  );
}

export function BattleHeatMeter({ count, max = 12 }: { count: number; max?: number }): React.ReactElement {
  const pct = Math.min(100, Math.round((count / Math.max(1, max)) * 100));
  return (
    <div className="fc-lab-battle-heat" data-testid="fc-lab-battle-heat">
      <div className="fc-lab-battle-heat__head">
        <span className="fc-lab-battle-heat__label">
          <span aria-hidden>⚠️</span> Active Battles
        </span>
        <strong className="fc-lab-battle-heat__value">{count}</strong>
      </div>
      <div className="fc-lab-battle-heat__bar" aria-hidden>
        <div className="fc-lab-battle-heat__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function VolatilityIndex({
  score,
  hotPositions,
}: {
  score: number;
  hotPositions: string;
}): React.ReactElement {
  const pct = Math.min(100, score);
  return (
    <div className="fc-lab-vol-index" data-testid="fc-lab-volatility">
      <div className="fc-lab-vol-index__head">
        <span className="fc-lab-vol-index__label">
          Volatility: {score} <span aria-hidden>⚡</span>
        </span>
      </div>
      <div className="fc-lab-vol-index__bar" aria-hidden>
        <div className="fc-lab-vol-index__fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="fc-lab-vol-index__text">High volatility at {hotPositions}</p>
    </div>
  );
}

export function PositionVolatilityHeatmap({
  cells,
}: {
  cells: Array<{ position: string; count: number; intensity: number }>;
}): React.ReactElement {
  const max = Math.max(1, ...cells.map((c) => c.intensity));

  return (
    <div className="fc-lab-pos-heat" aria-label="Position volatility heatmap">
      <p className="fc-lab-pos-heat__label">Position volatility</p>
      <div className="fc-lab-pos-heat__grid">
        {cells.length === 0 ? (
          <span className="fc-lab-pos-heat__empty">—</span>
        ) : (
          cells.map((cell) => (
            <div
              key={cell.position}
              className="fc-lab-pos-heat__cell"
              style={{ opacity: 0.35 + (cell.intensity / max) * 0.65 }}
              title={`${cell.position}: ${cell.count} targets, volatility ${cell.intensity.toFixed(1)}`}
            >
              <span className="fc-lab-pos-heat__pos">{cell.position}</span>
              <span className="fc-lab-pos-heat__count">{cell.count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
