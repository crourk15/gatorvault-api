'use client';

import React from 'react';
import type { FcLabTarget } from '@/components/futurecast/lab/fc-lab-types';
import { ufPctFromFc } from '@/components/futurecast/lab/fc-lab-types';
import {
  buildChaseWhyBrief,
  chaseHeatLabel,
  type ChaseTargetExtras,
} from '@/components/futurecast/lab/chase-priority';
import { isFlorida, shortSchoolLabel, topThreatVsFlorida } from '@/components/futurecast/lab/competing-schools';
import { playerProfilePath } from '@/lib/player-routes';
import type { PlayerProfileContext } from '@/lib/vault-route-map';
import { VaultNavLink } from '@/components/vault/VaultNavLink';

export type VaultChaseCardPlayer = FcLabTarget & ChaseTargetExtras;

type RaceRow = { label: string; pct: number; tone: 'us' | 'lead' | 'other' };

function positionMark(position: string | null | undefined): string {
  const raw = String(position || '').trim().toUpperCase();
  if (!raw) return '-';
  return raw.length <= 4 ? raw : raw.slice(0, 3);
}

function schoolLooksInState(school: string | null | undefined): boolean {
  return /\bFL\b|\(FL\)|,\s*FL\b|Florida/i.test(String(school || ''));
}

function raceRows(player: VaultChaseCardPlayer): RaceRow[] {
  const peers = (player.competingSchools ?? [])
    .filter((s) => s?.name && Number(s.pct) > 0 && !isFlorida(s.name))
    .sort((a, b) => Number(b.pct) - Number(a.pct))
    .slice(0, 2);

  const ufRpm =
    player.ufRpmPct != null && Number(player.ufRpmPct) > 0
      ? Math.round(Number(player.ufRpmPct))
      : ufPctFromFc(player.ufProbability);

  const rows: RaceRow[] = [];
  if (peers[0]) {
    rows.push({
      label: shortSchoolLabel(peers[0].name),
      pct: Math.round(Number(peers[0].pct)),
      tone: 'lead',
    });
  }
  if (ufRpm > 0) {
    rows.push({ label: 'Florida', pct: ufRpm, tone: 'us' });
  }
  if (peers[1]) {
    rows.push({
      label: shortSchoolLabel(peers[1].name),
      pct: Math.round(Number(peers[1].pct)),
      tone: 'other',
    });
  }
  return rows;
}

function on3LeadLabel(player: VaultChaseCardPlayer): string {
  // Prefer API stamp — prediction swings and stamp bugfixes ship via Render.
  const apiLead = String(player.on3Lead || '').trim();
  if (apiLead && apiLead !== '-' && apiLead !== '—') return apiLead;

  const threat = topThreatVsFlorida(player);
  const ufRpm =
    player.ufRpmPct != null && Number(player.ufRpmPct) > 0
      ? Math.round(Number(player.ufRpmPct))
      : null;
  if (threat && (ufRpm == null || threat.pct >= ufRpm)) {
    return threat.label || shortSchoolLabel(threat.name);
  }
  if (ufRpm != null && ufRpm > 0) return 'UF';
  if (threat) return threat.label || shortSchoolLabel(threat.name);
  return '-';
}

/** Always keep #N visible — Rising is a separate badge, not a stamp replacement. */
function stampFor(
  rank: number,
  delta7d: number | null | undefined,
  showMovement = true
): { label: string; tone: 'hot' | 'chase'; rising: boolean } {
  const d = Number(delta7d);
  const rising = Boolean(showMovement && Number.isFinite(d) && d > 0 && rank !== 1);
  if (rank === 1) return { label: '#1 Chase', tone: 'hot', rising: false };
  return { label: `#${rank} Chase`, tone: 'chase', rising };
}

/**
 * Shared 2028 chase card - Current Class commit chrome + Why we chase brief.
 * Home Targets to watch, Lab Priority chase, and recruiting HP board.
 */
export function VaultChaseCard({
  player,
  rank,
  showRace = rank === 1,
  showMovement = true,
  profileContext = 'futurecast',
  href: hrefOverride,
}: {
  player: VaultChaseCardPlayer;
  rank: number;
  showRace?: boolean;
  /** When false, hide Rising badge (Lab movement gate). */
  showMovement?: boolean;
  profileContext?: PlayerProfileContext;
  href?: string;
}): React.ReactElement {
  const href =
    hrefOverride ??
    playerProfilePath(player.slug, 'HIGH_SCHOOL', true, player.name, profileContext);

  const ufShot = ufPctFromFc(player.ufProbability);
  const fit =
    player.fitScore != null && Number(player.fitScore) > 0
      ? Math.round(Number(player.fitScore))
      : null;
  const priority = chaseHeatLabel(player.priorityScore);
  const visitLine = (player.visitLabels ?? []).filter(Boolean)[0] || null;
  // Dedicated visit plate on the card — keep Why we chase free of the same line.
  const why = buildChaseWhyBrief(
    visitLine ? { ...player, visitLabels: [] } : player
  );
  const stamp = stampFor(rank, player.delta7d, showMovement);
  const inState = Boolean(player.hotBadges?.inState) || schoolLooksInState(player.school);
  const race = showRace ? raceRows(player) : [];
  const raceMax = Math.max(...race.map((r) => r.pct), 1);
  const lead = on3LeadLabel(player);
  const school = String(player.school || '').trim() || 'High school TBD';

  return (
    <article
      className={`gv-chase-card${rank === 1 ? ' gv-chase-card--lead' : ''}`}
      data-testid="vault-chase-card"
      data-rank={rank}
    >
      <VaultNavLink href={href} className="gv-chase-card__link">
        <span className="gv-chase-card__watermark" aria-hidden>
          UF
        </span>

        <div className="gv-chase-card__top">
          <div className="gv-chase-card__mark" aria-hidden>
            <span className="gv-chase-card__pos">{positionMark(player.position)}</span>
            {player.stars != null && player.stars > 0 ? (
              <span className="gv-chase-card__stars">{player.stars}★</span>
            ) : null}
          </div>

          <div className="gv-chase-card__identity">
            <h3 className="gv-chase-card__name">{player.name}</h3>
            <p className="gv-chase-card__id-line">
              {player.stars != null && player.stars > 0 ? (
                <span className="gv-chase-card__id-stars">{player.stars}★</span>
              ) : null}
              {player.position ? (
                <span className="gv-chase-card__id-pos">{player.position}</span>
              ) : null}
              {school ? <span className="gv-chase-card__id-home">{school}</span> : null}
            </p>
          </div>

          <span className={`gv-chase-card__stamp gv-chase-card__stamp--${stamp.tone}`}>
            {stamp.label}
          </span>
        </div>

        <ul className="gv-chase-card__rank-strip" aria-label="Chase scores">
          <li className="gv-chase-card__rank-cell">
            <span className="gv-chase-card__rank-num">{ufShot > 0 ? `${ufShot}%` : '-'}</span>
            <span className="gv-chase-card__rank-label">UF Shot</span>
          </li>
          <li className="gv-chase-card__rank-cell">
            <span className="gv-chase-card__rank-num">{fit != null ? fit : '-'}</span>
            <span className="gv-chase-card__rank-label">Fit</span>
          </li>
          <li className="gv-chase-card__rank-cell">
            <span className="gv-chase-card__rank-num">{priority}</span>
            <span className="gv-chase-card__rank-label">Priority</span>
          </li>
        </ul>

        {(inState || rank === 1 || stamp.rising) && (
          <div className="gv-chase-card__badges">
            {inState ? <span className="gv-chase-badge gv-chase-badge--instate">In-state</span> : null}
            {rank === 1 ? <span className="gv-chase-badge gv-chase-badge--lead">Hot chase</span> : null}
            {stamp.rising ? <span className="gv-chase-badge gv-chase-badge--rising">Rising</span> : null}
          </div>
        )}

        {visitLine ? (
          <p className="gv-chase-card__visit" data-testid="chase-expected-visit">
            {visitLine}
          </p>
        ) : null}

        <p className="gv-chase-card__why-label">Why we chase</p>
        <p className="gv-chase-card__skinny">{why}</p>

        {race.length > 0 ? (
          <div className="gv-chase-card__race">
            <p className="gv-chase-card__race-title">Who's ahead · On3</p>
            {race.map((row) => (
              <div key={`${row.label}-${row.pct}`} className="gv-chase-card__race-row">
                <span>{row.label}</span>
                <div className="gv-chase-card__race-bar">
                  <i
                    className={row.tone === 'us' ? 'us' : row.tone === 'lead' ? 'lead' : undefined}
                    style={{ width: `${Math.round((row.pct / raceMax) * 100)}%` }}
                  />
                </div>
                <span>{row.pct}%</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="gv-chase-card__footer">
          <div className="gv-chase-card__footer-main">
            <span>{school}</span>
            <span className="gv-chase-card__cta">Open breakdown →</span>
          </div>
          <div className="gv-chase-card__rating" aria-label={`On3 lead ${lead}`}>
            <span className="gv-chase-card__rating-label">On3 lead</span>
            <span className="gv-chase-card__rating-value">{lead}</span>
          </div>
        </div>
      </VaultNavLink>
    </article>
  );
}
