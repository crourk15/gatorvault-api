'use client';

import React, { useEffect, useState } from 'react';
import type { RhHubBattle } from '@/lib/recruiting-hub-elite-api';
import { fetchBattlesAndMovement } from '@/lib/recruiting-ui-api';
import { ACTIVE_RECRUITING_CLASS_YEAR } from '@/lib/recruiting-cycle';

export function RecruitingBattlesMovement(): React.ReactElement {
  const [data, setData] = useState<RhHubBattle[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchBattlesAndMovement(ACTIVE_RECRUITING_CLASS_YEAR)
      .then((res) => {
        if (!cancelled) setData(res.battles ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Battles &amp; Movement</div>
        <div className="rh-section-subtitle">Key recruit battles and trend lines.</div>
      </div>
      {loading ? (
        <div className="rh-skeleton" data-testid="rh-elite-battles" aria-hidden="true" />
      ) : !data ? (
        <section className="rh-card" data-testid="rh-elite-battles">
          <p className="rh-empty">{error ? 'Could not load battle intel.' : 'Battle intel unavailable.'}</p>
        </section>
      ) : !data.length ? (
        <section className="rh-card" data-testid="rh-elite-battles">
          <p className="rh-empty">No battle intel available yet.</p>
        </section>
      ) : (
        <section className="rh-battle-grid" data-testid="rh-elite-battles">
          {data.map((b) => (
            <article key={b.id} className="rh-battle-card">
              <div className="rh-battle-header">
                <div className="rh-battle-name">
                  {b.name} · {b.position}
                </div>
                <span className="rh-badge">{b.tag}</span>
              </div>
              <div className="rh-battle-body">{b.note}</div>
              <div className="rh-battle-footer">
                <span>UF % {b.ufPercent}</span>
                <span>{b.movement}</span>
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
