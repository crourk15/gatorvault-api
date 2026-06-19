'use client';

import React, { useMemo } from 'react';
import type { MasterBoardResponse, MovementIntelResponse, TrendingBoardResponse } from '@/lib/futurecast-board-types';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import {
  buildIntelFeedItem,
  dedupeIntelFeedItems,
  formatIntelTimestamp,
  type IntelFeedItem,
} from '@/lib/recruiting-intel-feed';
import { FutureCastPanelShell } from './primitives';
import { ufPctFromFc } from './fc-lab-types';
import { playerProfileRoute } from '@/lib/vault-route-map';

type Props = {
  masterBoard: MasterBoardResponse;
  trendingBoard: TrendingBoardResponse;
  movementIntel: MovementIntelResponse;
  highPriority: HighPriorityPlayer[];
  underclassmen: RecruitingBoardPlayer[];
};

function isBattle(ufPct: number): boolean {
  return ufPct >= 34 && ufPct < 67;
}

function FitBar({ label, value }: { label: string; value: number }): React.ReactElement {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="fc-lab-fit-row">
      <span className="fc-lab-fit-row__label">{label}</span>
      <div className="fc-lab-fit-row__track">
        <div className="fc-lab-fit-row__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="fc-lab-fit-row__val">{pct}</span>
    </div>
  );
}

function ModuleList({
  items,
  empty,
}: {
  items: Array<{ key: string; primary: string; meta: string; href?: string }>;
  empty: string;
}): React.ReactElement {
  if (!items.length) return <p className="rh-cc-empty">{empty}</p>;
  return (
    <ul className="fc-lab-ext-list">
      {items.map((item) => (
        <li key={item.key} className="fc-lab-ext-list__row">
          {item.href ? (
            <a href={item.href} className="fc-lab-ext-list__link">
              <strong>{item.primary}</strong>
              <span>{item.meta}</span>
            </a>
          ) : (
            <>
              <strong>{item.primary}</strong>
              <span>{item.meta}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function SmartAlertsPanel({ alerts }: { alerts: IntelFeedItem[] }): React.ReactElement {
  return (
    <FutureCastPanelShell title="Smart Alerts" sub="Deduped movement, visits, and staff intel." testId="fc-lab-smart-alerts">
      {alerts.length === 0 ? (
        <p className="rh-cc-empty">No alerts — monitoring allowlist targets.</p>
      ) : (
        <ul className="fc-lab-alert-list">
          {alerts.map((a) => (
            <li key={a.id} className="fc-lab-alert-list__row">
              <span className="fc-lab-alert-list__icon" aria-hidden>
                {a.icon}
              </span>
              <div className="fc-lab-alert-list__body">
                <p className="fc-lab-alert-list__headline">{a.headline}</p>
                <p className="fc-lab-alert-list__meta">
                  <span className="fc-lab-alert-list__cat">{a.category}</span>
                  {' · '}
                  {formatIntelTimestamp(a.timestamp)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </FutureCastPanelShell>
  );
}

export function FutureCastExtendedModules({
  masterBoard,
  trendingBoard,
  movementIntel,
  highPriority,
  underclassmen,
}: Props): React.ReactElement {
  const activeTargets = useMemo(
    () =>
      masterBoard.players.filter(
        (p) => !p.committedTo || !/\bflorida\b|\bgators\b/i.test(String(p.committedTo))
      ),
    [masterBoard.players]
  );

  const earlyBattles = useMemo(
    () =>
      activeTargets
        .filter((p) => isBattle(ufPctFromFc(p.ufConfidence)))
        .sort((a, b) => b.volatility7d - a.volatility7d)
        .slice(0, 8),
    [activeTargets]
  );

  const youngerProspects = useMemo(
    () =>
      underclassmen
        .filter((p) => (Number(p.classYear) || 0) >= 2028)
        .sort((a, b) => (Number(b.stars) || 0) - (Number(a.stars) || 0))
        .slice(0, 10),
    [underclassmen]
  );

  const trend30 = useMemo(() => {
    const up = trendingBoard.trendingUp.slice(0, 5);
    const down = trendingBoard.trendingDown.slice(0, 5);
    return { up, down };
  }, [trendingBoard]);

  const smartAlerts = useMemo(() => {
    const raw: IntelFeedItem[] = [];
    for (const p of movementIntel.risers.slice(0, 4)) {
      raw.push(
        buildIntelFeedItem({
          id: `rise-${p.slug}`,
          playerName: p.name,
          headline: `${p.name} trending up (+${Math.round(p.trendDelta7d)}% UF)`,
          timestamp: movementIntel.updatedAt,
          category: 'Movement',
        })
      );
    }
    for (const p of movementIntel.highVolatility.slice(0, 3)) {
      raw.push(
        buildIntelFeedItem({
          id: `vol-${p.slug}`,
          playerName: p.name,
          headline: `Volatility spike on ${p.name} (${p.position})`,
          timestamp: movementIntel.updatedAt,
          category: 'Movement',
          volatile: true,
        })
      );
    }
    for (const alert of movementIntel.alerts.slice(0, 4)) {
      raw.push(
        buildIntelFeedItem({
          id: alert.id,
          headline: alert.message,
          timestamp: alert.createdAt,
        })
      );
    }
    return dedupeIntelFeedItems(raw, 8);
  }, [movementIntel]);

  const fitLeaders = highPriority.slice(0, 3);

  return (
    <>
      <FutureCastPanelShell
        title="Younger Prospects — Underclassmen Watchboard"
        sub="2028–2030 early intel from FutureCast discovery pipeline."
        testId="fc-lab-underclassmen"
      >
        <ModuleList
          empty="No underclassmen watchlist loaded."
          items={youngerProspects.map((p) => ({
            key: p.slug,
            primary: `${p.name} · ${p.pos || '—'} · '${String(p.classYear || '2028').slice(2)}`,
            meta: `${Number(p.stars) || '—'}★ · ${p.school || '—'}`,
            href: playerProfileRoute(p.slug, 'futurecast'),
          }))}
        />
      </FutureCastPanelShell>

      <FutureCastPanelShell
        title="Early Battles to Monitor"
        sub="Allowlist targets in the 34–67% UF battle zone."
        testId="fc-lab-early-battles"
      >
        <ModuleList
          empty="No active battles on the board."
          items={earlyBattles.map((p) => ({
            key: p.slug,
            primary: p.name,
            meta: `${p.position} · UF ${ufPctFromFc(p.ufConfidence)}% · vol ${p.volatility7d.toFixed(1)}`,
            href: playerProfileRoute(p.slug, 'futurecast'),
          }))}
        />
      </FutureCastPanelShell>

      <FutureCastPanelShell title="Fit Score Breakdown" sub="Scheme, staff, and roster-fit leaders." testId="fc-lab-fit-breakdown">
        {fitLeaders.length === 0 ? (
          <p className="rh-cc-empty">Fit breakdown unavailable.</p>
        ) : (
          fitLeaders.map((p) => (
            <div key={p.slug} className="fc-lab-fit-card">
              <p className="fc-lab-fit-card__name">
                {p.name} · {p.position}
              </p>
              <FitBar label="Scheme / Fit" value={p.fitScore ?? 0} />
              <FitBar label="Staff confidence" value={p.staffConfidence ?? 0} />
              <FitBar label="UF likelihood" value={p.ufProbability ?? 0} />
              <FitBar label="Momentum" value={Math.max(0, Math.min(100, (p.movementDelta ?? 0) + 50))} />
            </div>
          ))
        )}
      </FutureCastPanelShell>

      <FutureCastPanelShell title="Staff Confidence Index (SCI)" sub="Analyst conviction on top targets." testId="fc-lab-sci">
        <ModuleList
          empty="SCI data unavailable."
          items={highPriority
            .slice()
            .sort((a, b) => (b.staffConfidence ?? 0) - (a.staffConfidence ?? 0))
            .slice(0, 6)
            .map((p) => ({
              key: p.slug,
              primary: p.name,
              meta: `SCI ${Math.round(p.staffConfidence ?? 0)} · UF ${Math.round(p.ufProbability ?? 0)}%`,
              href: playerProfileRoute(p.slug, 'futurecast'),
            }))}
        />
      </FutureCastPanelShell>

      <FutureCastPanelShell
        title="Commitment Timeline Predictor"
        sub="Visit windows and projected decision windows."
        testId="fc-lab-timeline"
      >
        <ModuleList
          empty="No visit windows scheduled."
          items={highPriority
            .filter((p) => p.visitStart || p.ufOvStatus)
            .slice(0, 6)
            .map((p) => ({
              key: p.slug,
              primary: p.name,
              meta: p.visitStart
                ? `OV ${p.visitStart}${p.visitEnd ? `–${p.visitEnd}` : ''} · UF ${Math.round(p.ufProbability ?? 0)}%`
                : `${p.ufOvStatus ?? 'Visit intel'} · UF ${Math.round(p.ufProbability ?? 0)}%`,
              href: playerProfileRoute(p.slug, 'futurecast'),
            }))}
        />
      </FutureCastPanelShell>

      <FutureCastPanelShell title="30-Day Trend Engine" sub="Rolling UF probability movers (30d window)." testId="fc-lab-trend-30">
        <div className="fc-lab-trend-grid">
          <div>
            <h3 className="fc-lab-trend-grid__label">Trending up</h3>
            <ModuleList
              empty="No risers."
              items={trend30.up.map((p) => ({
                key: `up-${p.slug}`,
                primary: p.name,
                meta: `+${Math.round(p.trendDelta7d)}% · UF ${ufPctFromFc(p.ufConfidence)}%`,
              }))}
            />
          </div>
          <div>
            <h3 className="fc-lab-trend-grid__label">Trending down</h3>
            <ModuleList
              empty="No fallers."
              items={trend30.down.map((p) => ({
                key: `dn-${p.slug}`,
                primary: p.name,
                meta: `${Math.round(p.trendDelta7d)}% · UF ${ufPctFromFc(p.ufConfidence)}%`,
              }))}
            />
          </div>
        </div>
      </FutureCastPanelShell>

      <SmartAlertsPanel alerts={smartAlerts} />
    </>
  );
}
