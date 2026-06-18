'use client';

import React from 'react';

export function ufPctFromRaw(raw: number | null | undefined): number {
  if (raw == null) return 0;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}

export function MovementSparkline({
  end,
  delta,
  className = '',
}: {
  end: number;
  delta: number;
  className?: string;
}): React.ReactElement {
  const start = Math.max(0, Math.min(100, end - delta));
  const pts = [start, start + delta * 0.25, start + delta * 0.5, start + delta * 0.75, end];
  const coords = pts.map((v, i) => `${(i / 4) * 40},${22 - (v / 100) * 18}`).join(' ');
  const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return (
    <svg
      className={`rh-cc-sparkline rh-cc-sparkline--${trend} ${className}`.trim()}
      viewBox="0 0 40 24"
      aria-hidden
    >
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function MovementBadge({
  delta,
  tone,
}: {
  delta: number;
  tone: 'rise' | 'fall' | 'volatile' | 'flat';
}): React.ReactElement {
  if (tone === 'volatile') {
    return (
      <span className="rh-cc-badge rh-cc-badge--volatile">
        <span aria-hidden>⚡</span> ±{Math.abs(delta)}%
      </span>
    );
  }
  if (tone === 'rise') {
    return (
      <span className="rh-cc-badge rh-cc-badge--rise">
        <span aria-hidden>↑</span> +{Math.abs(delta)}%
      </span>
    );
  }
  if (tone === 'fall') {
    return (
      <span className="rh-cc-badge rh-cc-badge--fall">
        <span aria-hidden>↓</span> {delta}%
      </span>
    );
  }
  return (
    <span className="rh-cc-badge rh-cc-badge--flat">
      <span aria-hidden>→</span> —
    </span>
  );
}

export function UfProbBar({ value }: { value: number }): React.ReactElement {
  const pct = Math.max(0, Math.min(100, value));
  const tone = pct >= 67 ? 'high' : pct >= 34 ? 'mid' : 'low';
  return (
    <div className="rh-cc-prob-bar" aria-label={`UF probability ${pct}%`}>
      <div className="rh-cc-prob-bar__track">
        <div className={`rh-cc-prob-bar__fill rh-cc-prob-bar__fill--${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="rh-cc-prob-bar__label">{pct}%</span>
    </div>
  );
}

export function ModuleShell({
  title,
  sub,
  action,
  children,
  className = '',
  testId,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}): React.ReactElement {
  return (
    <section className={`rh-cc-module ${className}`.trim()} data-testid={testId}>
      <header className="rh-cc-module__head">
        <div>
          <h2 className="rh-cc-module__title">{title}</h2>
          {sub ? <p className="rh-cc-module__sub">{sub}</p> : null}
        </div>
        {action ? <div className="rh-cc-module__action">{action}</div> : null}
      </header>
      <div className="rh-cc-module__body">{children}</div>
    </section>
  );
}
