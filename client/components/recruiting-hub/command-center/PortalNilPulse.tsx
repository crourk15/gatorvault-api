'use client';

import React, { useEffect, useState } from 'react';
import type { PortalBuckets } from '@/components/recruiting-hub/utils/portalData';
import { fetchNilDashboard, type NilDashboard } from '@/lib/nil-api';
import { playerProfileRoute } from '@/lib/site-routes';
import { ModuleShell, MovementBadge, UfProbBar, ufPctFromRaw } from './primitives';

type Props = {
  portal: PortalBuckets;
};

type Tab = 'portal' | 'nil';

export function PortalNilPulse({ portal }: Props): React.ReactElement {
  const [tab, setTab] = useState<Tab>('portal');
  const [nil, setNil] = useState<NilDashboard | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchNilDashboard()
      .then((data) => {
        if (!cancelled) setNil(data);
      })
      .catch(() => {
        if (!cancelled) setNil(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const nilScore = nil?.ufStanding?.score ?? 78;
  const portalTargets = portal.targets.slice(0, 6);

  return (
    <ModuleShell title="Portal & NIL Pulse" testId="rh-cc-portal-nil">
      <div className="rh-cc-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'portal'}
          className={`rh-cc-tabs__btn${tab === 'portal' ? ' is-active' : ''}`}
          onClick={() => setTab('portal')}
        >
          Portal
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'nil'}
          className={`rh-cc-tabs__btn${tab === 'nil' ? ' is-active' : ''}`}
          onClick={() => setTab('nil')}
        >
          NIL
        </button>
      </div>

      {tab === 'portal' ? (
        <ul className="rh-cc-portal-list">
          {portalTargets.length === 0 ? (
            <li className="rh-cc-empty">No portal targets loaded.</li>
          ) : (
            portalTargets.map((p) => {
              const pct = ufPctFromRaw(p.ufProbability as number | undefined);
              const delta = (p as { delta7d?: number }).delta7d ?? 0;
              return (
                <li key={p.slug} className="rh-cc-portal-row">
                  <div>
                    <a
                      href={playerProfileRoute(p.slug, 'recruiting')}
                      className="rh-cc-portal-row__name"
                    >
                      {p.name}
                    </a>
                    <span className="rh-cc-portal-row__meta">
                      {p.position} · {p.school ?? 'Portal'}
                    </span>
                  </div>
                  <UfProbBar value={pct} />
                  <MovementBadge delta={delta} tone={delta >= 0 ? 'rise' : 'fall'} />
                </li>
              );
            })
          )}
        </ul>
      ) : (
        <div className="rh-cc-nil-pulse">
          <div className="rh-cc-nil-score">
            <span className="rh-cc-nil-score__value">{nilScore}</span>
            <span className="rh-cc-nil-score__label">UF NIL competitiveness / 100</span>
          </div>
          <div className="rh-cc-nil-bar">
            <div className="rh-cc-nil-bar__fill" style={{ width: `${Math.min(100, nilScore)}%` }} />
          </div>
          <p className="rh-cc-nil-copy">
            UF is competitive for top 2027 targets
            {nil?.ufStanding?.secRank != null ? ` · SEC #${nil.ufStanding.secRank}` : ''}.
          </p>
        </div>
      )}
    </ModuleShell>
  );
}
