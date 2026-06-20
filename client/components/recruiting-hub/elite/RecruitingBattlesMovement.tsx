'use client';

import React from 'react';
import type { RhBattleView } from '@/components/recruiting-hub/elite/rh-elite-utils';

type Props = {
  battles: RhBattleView[];
  loading?: boolean;
};

function BattleCard({ battle }: { battle: RhBattleView }): React.ReactElement {
  return (
    <article className="rh-battle-card">
      <div className="rh-battle-header">
        <div className="rh-battle-name">
          {battle.name} · {battle.position}
        </div>
        <span className="rh-badge">{battle.tag}</span>
      </div>
      <div className="rh-battle-body">{battle.note}</div>
      <div className="rh-battle-footer">
        <span>UF % {battle.ufPercent}</span>
        <span>{battle.movement}</span>
      </div>
    </article>
  );
}

export function RecruitingBattlesMovement({ battles, loading }: Props): React.ReactElement {
  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Battles &amp; Movement</div>
        <div className="rh-section-subtitle">Key recruit battles and trend lines.</div>
      </div>
      {loading ? (
        <div className="rh-skeleton" data-testid="rh-elite-battles" aria-hidden="true" />
      ) : battles.length === 0 ? (
        <section className="rh-card" data-testid="rh-elite-battles">
          <p className="rh-empty">Battle intel updating — check back shortly.</p>
        </section>
      ) : (
        <section className="rh-battle-grid" data-testid="rh-elite-battles">
          {battles.map((battle) => (
            <BattleCard key={battle.id} battle={battle} />
          ))}
        </section>
      )}
    </>
  );
}
