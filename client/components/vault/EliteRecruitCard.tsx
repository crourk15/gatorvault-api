'use client';

import React from 'react';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { ensurePlayerSlug } from '@/lib/slug';
import { playerProfilePath, recruitingProfileLifecycle } from '@/lib/player-routes';

export type EliteCardVariant = 'commit' | 'target' | 'ranking' | 'heat' | 'priority';

export interface EliteRecruitCardPlayer extends RecruitingBoardPlayer {
  posRank?: number | null;
  stateRank?: number | null;
  htWt?: string | null;
  committedTo?: string | null;
  ufOvStatus?: string | null;
  visitStart?: string | null;
  visitEnd?: string | null;
  nextVisitSchool?: string | null;
  headliner?: boolean;
  movementDirection?: 'up' | 'down' | 'flat';
  heatLabel?: string | null;
  insiderNote?: string | null;
  predictionSchools?: { school: string; pct: number }[];
  staffConfidence?: number | null;
  isUFVisitToday?: boolean;
}

function starsDisplay(stars?: number | null): string {
  const n = Math.min(5, Math.max(0, Number(stars) || 0));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function formatRating(rating?: number | null): string | null {
  if (rating == null || !Number.isFinite(Number(rating))) return null;
  const n = Number(rating);
  return n <= 1 ? (n * 100).toFixed(2) : n.toFixed(2);
}

function schoolLine(player: EliteRecruitCardPlayer): string {
  const school = player.school?.trim();
  const state = player.state?.trim();
  if (school && state) return `${school} · ${state}`;
  return school || state || '—';
}

function visitBadge(player: EliteRecruitCardPlayer): string | null {
  if (player.isUFVisitToday) return '🔥 UF Visit Today';
  const ov = String(player.ufOvStatus || '').toLowerCase();
  if (ov.includes('scheduled') || ov === 'scheduled') return '🔥 UF Visit Scheduled';
  if (player.visitStart) return '🔥 UF Visit Scheduled';
  if (ov.includes('cancelled')) return '🟥 Visit Cancelled';
  return null;
}

function movementArrow(dir?: 'up' | 'down' | 'flat'): React.ReactNode {
  if (dir === 'up') return <span className="gv-elite-card__move gv-elite-card__move--up" aria-label="Trending up">▲</span>;
  if (dir === 'down') return <span className="gv-elite-card__move gv-elite-card__move--down" aria-label="Trending down">▼</span>;
  if (dir === 'flat') return <span className="gv-elite-card__move gv-elite-card__move--flat" aria-label="Stable">◆</span>;
  return null;
}

function heatMeter(pct: number): React.ReactElement {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="gv-elite-card__heat-meter" aria-label={`Heat ${clamped}%`}>
      <div className="gv-elite-card__heat-track">
        <div className="gv-elite-card__heat-fill" style={{ width: `${clamped}%` }} />
      </div>
      <span className="gv-elite-card__heat-pct">{clamped}%</span>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export interface EliteRecruitCardProps {
  player: EliteRecruitCardPlayer;
  rank?: number;
  variant?: EliteCardVariant;
}

export function EliteRecruitCard({
  player,
  rank,
  variant = 'target',
}: EliteRecruitCardProps): React.ReactElement {
  const slug = ensurePlayerSlug(player.slug, player.name);
  const lifecycle = recruitingProfileLifecycle(player);
  const href = playerProfilePath(slug, lifecycle, true, player.name, 'recruiting');
  const pos = player.position || player.pos || '—';
  const classYear = player.classYear ?? '—';
  const ratingStr = formatRating(player.rating ?? player.displayRating);
  const ufPct = player.ufProbability != null ? Math.round(Number(player.ufProbability) * 100) : null;
  const visit = visitBadge(player);
  const isCommit = variant === 'commit' || player.isCommittedToUF;
  const predictions = player.predictionSchools?.slice(0, 2) ?? [];
  const heatPct = ufPct ?? (player.staffConfidence != null ? Math.round(player.staffConfidence) : null);

  return (
    <a
      href={href}
      className={`gv-elite-card gv-elite-card--${variant}${player.headliner ? ' gv-elite-card--headliner' : ''}${isCommit ? ' gv-elite-card--committed' : ''}`}
      data-testid="elite-recruit-card"
      data-slug={slug}
    >
      {rank != null && <div className="gv-elite-card__rank-badge">#{rank}</div>}

      <div className="gv-elite-card__photo-wrap">
        <div className="gv-elite-card__photo" aria-hidden="true">
          <span className="gv-elite-card__initials">{initials(player.name)}</span>
        </div>
        {player.stars ? (
          <div className="gv-elite-card__stars" aria-label={`${player.stars} stars`}>
            {starsDisplay(player.stars)}
          </div>
        ) : null}
      </div>

      <div className="gv-elite-card__body">
        <div className="gv-elite-card__name-row">
          <h3 className="gv-elite-card__name">{player.name}</h3>
          {movementArrow(player.movementDirection)}
        </div>

        <p className="gv-elite-card__pos-class">
          {pos} · Class of {classYear}
        </p>

        {player.htWt ? <p className="gv-elite-card__htwt">{player.htWt}</p> : null}

        <p className="gv-elite-card__school">{schoolLine(player)}</p>

        <div className="gv-elite-card__ratings-row">
          {ratingStr && (
            <span className="gv-elite-card__industry-rating">
              <span className="gv-elite-card__rating-label">Industry</span>
              <strong>{ratingStr}</strong>
            </span>
          )}
          {(player.natlRank ?? player.natl) != null && (
            <span className="gv-elite-card__rank-chip">
              NATL <strong>#{player.natlRank ?? player.natl}</strong>
            </span>
          )}
          {player.posRank != null && (
            <span className="gv-elite-card__rank-chip">
              POS <strong>#{player.posRank}</strong>
            </span>
          )}
          {player.stateRank != null && (
            <span className="gv-elite-card__rank-chip">
              ST <strong>#{player.stateRank}</strong>
            </span>
          )}
        </div>

        {predictions.length > 0 && (
          <div className="gv-elite-card__predictions">
            {predictions.map((p) => (
              <span key={p.school} className="gv-elite-card__pred">
                <span className="gv-elite-card__pred-logo">{p.school.slice(0, 2).toUpperCase()}</span>
                <span className="gv-elite-card__pred-school">{p.school}</span>
                <span className="gv-elite-card__pred-pct">{p.pct}%</span>
              </span>
            ))}
          </div>
        )}

        {heatPct != null && variant !== 'commit' && heatMeter(heatPct)}

        <div className="gv-elite-card__badges">
          {visit && <span className="gv-elite-card__badge gv-elite-card__badge--visit">{visit}</span>}
          {player.heatLabel && (
            <span className="gv-elite-card__badge gv-elite-card__badge--heat">{player.heatLabel}</span>
          )}
          {isCommit && (
            <span className="gv-elite-card__badge gv-elite-card__badge--commit">✓ Committed to UF</span>
          )}
          {!isCommit && player.committedTo && !/^florida$/i.test(player.committedTo) && (
            <span className="gv-elite-card__badge gv-elite-card__badge--elsewhere">
              {player.committedTo}
            </span>
          )}
          {player.staffGrade && (
            <span className="gv-elite-card__badge gv-elite-card__badge--grade">
              Staff {player.staffGrade}
            </span>
          )}
          {player.fitScore != null && (
            <span className="gv-elite-card__badge gv-elite-card__badge--fit">
              Fit {Number(player.fitScore).toFixed(1)}
            </span>
          )}
        </div>

        {(player.insiderNote || player.notePreview || player.notes) && (
          <p className="gv-elite-card__note">
            {player.insiderNote || player.notePreview || player.notes}
          </p>
        )}
      </div>
    </a>
  );
}
