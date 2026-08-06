'use client';

import React from 'react';
import type { RhHubCommit } from '@/lib/recruiting-hub-elite-api';

type Props = {
  commit: RhHubCommit;
  year: number;
};

type RankCell = { rank: string; label: string };

/** Strip API "Vault X —" prefix when present on legacy payloads. */
function stripVaultLabel(text: string | null | undefined, label: string): string | null {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const re = new RegExp(`^vault\\s+${label}\\s*[—\\-:]\\s*`, 'i');
  return raw.replace(re, '').trim() || raw;
}

function positionMark(position: string | null | undefined): string {
  const raw = String(position || '').trim().toUpperCase();
  if (!raw) return '—';
  if (raw.length <= 4) return raw;
  return raw.slice(0, 3);
}

/**
 * Pre-NSD language only. Never "Signed" for verbal commits.
 */
function commitStamp(commit: RhHubCommit): { label: string; tone: 'enrolled' | 'committed' | 'accent' } {
  if (commit.enrolled) return { label: 'Enrolled', tone: 'enrolled' };
  const raw = String(commit.statusBadge || '').trim();
  if (/sign|loi|inked/i.test(raw)) return { label: 'Committed', tone: 'committed' };
  if (/^headliner$/i.test(raw)) return { label: 'Headliner', tone: 'accent' };
  if (/^enrolled$/i.test(raw)) return { label: 'Enrolled', tone: 'enrolled' };
  return { label: 'Committed', tone: 'committed' };
}

function parseMeta(commit: RhHubCommit): { hometown: string | null; ranks: RankCell[] } {
  const meta = String(commit.metaLine || commit.rankNote || '').trim();
  let hometown: string | null = null;
  const ranks: RankCell[] = [];
  if (!meta) return { hometown, ranks };

  for (const seg of meta.split('·').map((s) => s.trim()).filter(Boolean)) {
    if (/^\d\s*★/.test(seg)) continue;
    if (commit.position && seg.toUpperCase() === commit.position.toUpperCase()) continue;

    const rankMatch = seg.match(/^#(\d+)\s*(.+)$/i);
    if (rankMatch) {
      let label = rankMatch[2]
        .replace(/\bnationally\b/i, 'NATL')
        .replace(/\bnatl\.?/i, 'NATL')
        .trim()
        .toUpperCase();
      ranks.push({ rank: `#${rankMatch[1]}`, label });
      continue;
    }
    if (!hometown) hometown = seg;
  }

  return { hometown, ranks };
}

/**
 * Fan-first commit card — same surface for every class year.
 * Editorial meta strip + composite score; Vault Scouting on the profile.
 */
export function EliteCommitCard({ commit, year }: Props): React.ReactElement {
  const skinnyRaw = commit.skinny?.trim() || null;
  const skinny = stripVaultLabel(skinnyRaw, 'Eval');
  const showJersey = year <= 2026 && commit.jerseyNumber != null && String(commit.jerseyNumber).trim() !== '';
  const stamp = commitStamp(commit);
  const { hometown, ranks } = parseMeta(commit);
  const rating = commit.rating && commit.rating !== '—' ? commit.rating : null;

  return (
    <article
      className="rh-commit-card rh-elite-commit-card rh-elite-commit-card--heat"
      data-testid="rh-elite-commit-card"
    >
      <span className="rh-elite-commit-card__watermark" aria-hidden>
        UF
      </span>

      <div className="rh-elite-commit-card__top">
        <div className="rh-elite-commit-card__mark" aria-hidden>
          <span className="rh-elite-commit-card__pos">{positionMark(commit.position)}</span>
          {commit.stars != null && commit.stars > 0 ? (
            <span className="rh-elite-commit-card__stars">{commit.stars}★</span>
          ) : null}
        </div>

        <div className="rh-elite-commit-card__identity">
          <a href={commit.profileUrl} className="rh-commit-name">
            {commit.name}
          </a>
          <p className="rh-elite-commit-card__identity-line">
            {commit.stars != null && commit.stars > 0 ? (
              <span className="rh-elite-commit-card__id-stars">{commit.stars}★</span>
            ) : null}
            {commit.position ? (
              <span className="rh-elite-commit-card__id-pos">{commit.position}</span>
            ) : null}
            {hometown ? <span className="rh-elite-commit-card__id-home">{hometown}</span> : null}
          </p>
        </div>

        <span
          className={`rh-elite-commit-card__stamp rh-elite-commit-card__stamp--${stamp.tone}`}
          data-testid="rh-elite-commit-stamp"
        >
          {stamp.label}
        </span>
      </div>

      {ranks.length ? (
        <ul className="rh-elite-commit-card__rank-strip" aria-label="Rankings">
          {ranks.map((cell) => (
            <li key={`${cell.rank}-${cell.label}`} className="rh-elite-commit-card__rank-cell">
              <span className="rh-elite-commit-card__rank-num">{cell.rank}</span>
              <span className="rh-elite-commit-card__rank-label">{cell.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {commit.inState ? (
        <div className="rh-commit-badges rh-elite-commit-card__badges">
          <span className="rh-badge rh-badge--instate">In-state</span>
        </div>
      ) : null}

      {skinny ? (
        <p className="rh-commit-strengths rh-commit-skinny rh-commit-skinny--elite">{skinny}</p>
      ) : null}

      <div className="rh-commit-footer rh-elite-commit-card__footer-row">
        <div className="rh-elite-commit-card__footer-main">
          <span>Committed {commit.commitDate}</span>
          {showJersey ? <span>#{commit.jerseyNumber}</span> : null}
          {commit.nilEstimate ? <span>NIL {commit.nilEstimate}</span> : null}
        </div>
        {rating ? (
          <div className="rh-elite-commit-card__rating" aria-label={`Composite ${rating}`}>
            <span className="rh-elite-commit-card__rating-label">Composite</span>
            <span className="rh-elite-commit-card__rating-value">{rating}</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}
