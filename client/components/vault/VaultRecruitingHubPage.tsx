'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { fetchRecruitingBoard, type RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { fetchRecruitingHeatCheck, type HeatCheckItem } from '@/lib/recruiting-api';
import { playerProfilePath, recruitingProfileLifecycle } from '@/lib/player-routes';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

type RecruitTab = 'c2026' | 'b2027' | 'heat';

function RecruitCard({ player, inVault }: { player: RecruitingBoardPlayer; inVault: boolean }): React.ReactElement {
  const lifecycle = recruitingProfileLifecycle(player);
  const href = playerProfilePath(player.slug, lifecycle, inVault);
  return (
    <a href={href} className="gv-recruit-card">
      <h3 className="gv-recruit-card__name">{player.name}</h3>
      <p className="gv-recruit-card__meta">
        {player.position || player.pos} · {player.school || '—'} · {player.stars ? `${player.stars}★` : ''}
      </p>
      <p className="gv-recruit-card__status">{player.status || player.tierLabel || '—'}</p>
    </a>
  );
}

function HeatCard({ item }: { item: HeatCheckItem }): React.ReactElement {
  return (
    <article className={`gv-heat-card gv-heat-card--${item.direction}`}>
      <h3 className="gv-heat-card__name">{item.playerName}</h3>
      <p className="gv-heat-card__label">{item.triggerLabel || item.direction}</p>
      {item.predictionSchool ? (
        <p className="gv-heat-card__school">{item.predictionSchool}</p>
      ) : null}
    </article>
  );
}

export function VaultRecruitingHubPage(): React.ReactElement {
  const [tab, setTab] = useState<RecruitTab>('c2026');
  const [class2026, setClass2026] = useState<RecruitingBoardPlayer[]>([]);
  const [class2027, setClass2027] = useState<RecruitingBoardPlayer[]>([]);
  const [rising, setRising] = useState<HeatCheckItem[]>([]);
  const [cooling, setCooling] = useState<HeatCheckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b26, b27, heat] = await Promise.all([
        fetchRecruitingBoard(2026),
        fetchRecruitingBoard(2027),
        fetchRecruitingHeatCheck(),
      ]);
      setClass2026(b26.commits ?? b26.players ?? []);
      setClass2027(b27.targets ?? b27.players ?? []);
      setRising(heat.rising ?? []);
      setCooling(heat.cooling ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load recruiting data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enrolled = class2026.filter((p) => String(p.status).toLowerCase().includes('enroll')).length;

  return (
    <div className="gv-recruiting-hub" data-testid="vault-recruiting">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Recruiting</h1>
        <p className="gv-page-subtitle">
          Class boards, heat check, and FutureCast intel.{' '}
          <a href="/vault/futurecast">FutureCast →</a> ·{' '}
          <a href="/vault/recruiting-board">Full Board →</a>
        </p>
      </div>

      <div className="gv-alert-choices">
        <button type="button" className={`gv-alert-choice${tab === 'c2026' ? ' is-active' : ''}`} onClick={() => setTab('c2026')}>2026 Class</button>
        <button type="button" className={`gv-alert-choice${tab === 'b2027' ? ' is-active' : ''}`} onClick={() => setTab('b2027')}>2027 Board</button>
        <button type="button" className={`gv-alert-choice${tab === 'heat' ? ' is-active' : ''}`} onClick={() => setTab('heat')}>🔥 Heat Check</button>
      </div>

      {loading && <p className="gv-page-status">Loading recruiting…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load()} backHref="/vault/scouting" backLabel="← War Room" />
      )}

      {!loading && !error && tab === 'c2026' && (
        <>
          <div className="gv-recruit-stats">
            <div className="gv-recruit-stat"><span>Rank</span><strong>#16</strong></div>
            <div className="gv-recruit-stat"><span>Total</span><strong>{class2026.length}</strong></div>
            <div className="gv-recruit-stat"><span>Enrolled</span><strong>{enrolled || class2026.length}</strong></div>
          </div>
          <div className="gv-recruit-grid">
            {class2026.map((p) => (
              <RecruitCard key={p.slug} player={p} inVault />
            ))}
          </div>
          {class2026.length === 0 && <UiEmpty message="No 2026 class data yet." />}
        </>
      )}

      {!loading && !error && tab === 'b2027' && (
        <>
          <div className="gv-recruit-grid">
            {class2027.slice(0, 24).map((p) => (
              <RecruitCard key={p.slug} player={p} inVault />
            ))}
          </div>
          {class2027.length === 0 && <UiEmpty message="No 2027 board data yet." />}
          <p className="gv-vault-alerts__fc-link">
            <a href="/vault/recruiting-board">Open full 2027 recruiting board →</a>
          </p>
        </>
      )}

      {!loading && !error && tab === 'heat' && (
        <>
          <div className="gv-heat-columns">
            <div>
              <h2 className="gv-vault-alerts__section-title">🔥 Rising</h2>
              {rising.map((item, i) => (
                <HeatCard key={`${item.playerName}-${i}`} item={item} />
              ))}
              {rising.length === 0 && <UiEmpty message="No rising signals right now." />}
            </div>
            <div>
              <h2 className="gv-vault-alerts__section-title">❄️ Cooling</h2>
              {cooling.map((item, i) => (
                <HeatCard key={`${item.playerName}-${i}`} item={item} />
              ))}
              {cooling.length === 0 && <UiEmpty message="No cooling signals right now." />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
