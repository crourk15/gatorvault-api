'use client';

import React, { useCallback } from 'react';
import type { RhHubBattleBoardItem } from '@/lib/recruiting-hub-elite-api';
import { fetchRecruitingHubBattleBoard } from '@/lib/recruiting-hub-elite-api';
import { getBattleColor } from '@/lib/recruiting-hub-scoring';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';
import { useHubBundleSection } from '@/components/recruiting-hub/elite/useHubBundleSection';

const DIFFICULTY_LABELS: Record<RhHubBattleBoardItem['battleDifficulty'], string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
  flip: 'Flip Watch',
  longshot: 'Longshot',
  unknown: 'Unknown',
};

function trendSymbol(trend: RhHubBattleBoardItem['trend']): string {
  if (trend === 'up') return '▲';
  if (trend === 'down') return '▼';
  return '—';
}

function BattleCard({ battle }: { battle: RhHubBattleBoardItem }): React.ReactElement {
  const ufColor =
    battle.battleColor ?? (battle.ufScore != null ? getBattleColor(battle.ufScore) : null);
  const rivals = [...(battle.competitors || [])].sort(
    (a, b) => Number(b.score ?? -1) - Number(a.score ?? -1)
  );
  const topRival = rivals.find((c) => c.score != null) || rivals[0] || null;

  return (
    <article className="rh-card rh-battle-board-card" data-testid={`rh-battle-board-${battle.id}`}>
      <div className="rh-battle-board-card__head">
        <div>
          <a
            href={`/vault/recruiting/player/${encodeURIComponent(String(battle.id || battle.name || '').toLowerCase())}`}
            className="rh-player-name"
          >
            {battle.name}
          </a>
          <div className="rh-player-pos">
            {battle.position} · {battle.class} class
            {topRival?.school ? ` · vs ${topRival.school}` : ''}
          </div>
        </div>
        <div className="rh-battle-board-card__badges">
          <span className={`rh-badge rh-badge--battle-${battle.battleDifficulty}`}>
            {DIFFICULTY_LABELS[battle.battleDifficulty]}
          </span>
          <span className={`rh-movement rh-movement--${battle.trend}`}>{trendSymbol(battle.trend)}</span>
        </div>
      </div>

      <div
        className={`rh-battle-board-card__uf${ufColor ? ` rh-battle-board-card__uf--${ufColor}` : ' rh-battle-board-card__uf--unknown'}`}
      >
        <span>UF RPM</span>
        <strong>{battle.ufScore != null ? `${battle.ufScore}%` : '—'}</strong>
      </div>

      {rivals.length > 0 ? (
        <div className="rh-battle-board-card__competitors" aria-label="Confirmed competitor RPM">
          {rivals.map((c) => (
            <div key={`${battle.id}-${c.school}`} className="rh-battle-board-competitor">
              <span className="rh-battle-board-competitor__logo">{c.logo}</span>
              <div className="rh-battle-board-competitor__meta">
                <span className="rh-battle-board-competitor__school">{c.school}</span>
                <span className="rh-battle-board-competitor__score">
                  {c.score != null ? `${c.score}%` : '—'}{' '}
                  <span className={`rh-movement rh-movement--${c.trend}`}>{trendSymbol(c.trend)}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rh-battle-board-card__no-competitors">No confirmed competitor RPM yet</div>
      )}

      {battle.nextVisit ? <div className="rh-battle-board-card__visit">Next visit: {battle.nextVisit}</div> : null}
      {battle.intel ? <div className="rh-battle-board-card__intel">{battle.intel}</div> : null}
    </article>
  );
}

export function BattleBoard(): React.ReactElement {
  const { activeYear } = useRecruitingClassYear();
  const selectBattles = useCallback((b: { battleBoard: RhHubBattleBoardItem[] }) => b.battleBoard, []);
  const fetchBattles = useCallback(
    (year: number) => fetchRecruitingHubBattleBoard(year),
    []
  );
  const { data, loading, error } = useHubBundleSection({
    select: selectBattles,
    fetchFallback: fetchBattles,
  });

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Battle Board</div>
        <div className="rh-section-subtitle">
          {activeYear} class — UF RPM vs confirmed On3 competitor boards.
        </div>
      </div>
      {loading ? (
        <div className="rh-skeleton" data-testid="rh-elite-battle-board" aria-hidden="true" />
      ) : !data ? (
        <section className="rh-card" data-testid="rh-elite-battle-board">
          <p className="rh-empty">{error ? 'Could not load battle board.' : 'Battle board unavailable.'}</p>
        </section>
      ) : !data.length ? (
        <section className="rh-card" data-testid="rh-elite-battle-board">
          <p className="rh-empty">No battle board targets yet.</p>
        </section>
      ) : (
        <div className="rh-battle-board-grid" data-testid="rh-elite-battle-board">
          {data.map((battle) => (
            <BattleCard key={battle.id} battle={battle} />
          ))}
        </div>
      )}
    </>
  );
}
