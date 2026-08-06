'use client';

import React from 'react';
import type { RhHubCommit } from '@/lib/recruiting-hub-elite-api';

type Props = {
  commit: RhHubCommit;
  year: number;
};

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
 * Fan-first commit card — same surface for every class year.
 * Compact identity mark + signed stamp; Vault Scouting lives on the player profile.
 */
export function EliteCommitCard({ commit, year }: Props): React.ReactElement {
  const meta = commit.metaLine || commit.rankNote;
  const skinnyRaw = commit.skinny?.trim() || null;
  // Brief stays untitled — strip any legacy "Vault Eval —" prefix from API/iOS payloads.
  const skinny = stripVaultLabel(skinnyRaw, 'Eval');
  const showJersey = year <= 2026 && commit.jerseyNumber != null && String(commit.jerseyNumber).trim() !== '';
  const stamp = commit.statusBadge || (commit.enrolled ? 'Enrolled' : 'Signed');

  return (
    <article
      className="rh-commit-card rh-elite-commit-card rh-elite-commit-card--heat"
      data-testid="rh-elite-commit-card"
    >
      <div className="rh-elite-commit-card__top">
        <div className="rh-elite-commit-card__mark" aria-hidden>
          <span className="rh-elite-commit-card__pos">{positionMark(commit.position)}</span>
        </div>

        <div className="rh-elite-commit-card__identity">
          <a href={commit.profileUrl} className="rh-commit-name">
            {commit.name}
          </a>
          {meta ? <p className="rh-commit-meta">{meta}</p> : null}
        </div>

        <span className="rh-elite-commit-card__stamp">{stamp}</span>
      </div>

      {commit.inState || (commit.stars != null && commit.stars > 0) ? (
        <div className="rh-commit-badges rh-elite-commit-card__badges">
          {commit.inState ? <span className="rh-badge rh-badge--instate">In-state</span> : null}
          {commit.stars != null && commit.stars > 0 ? (
            <span className="rh-badge">{commit.stars}★</span>
          ) : null}
        </div>
      ) : null}

      {skinny ? (
        <p className="rh-commit-strengths rh-commit-skinny rh-commit-skinny--elite">{skinny}</p>
      ) : null}

      <div className="rh-commit-footer rh-elite-commit-card__footer-row">
        <span>Committed {commit.commitDate}</span>
        {commit.rating && commit.rating !== '—' ? <span>{commit.rating}</span> : null}
        {showJersey ? <span>#{commit.jerseyNumber}</span> : null}
        {commit.nilEstimate ? <span>NIL {commit.nilEstimate}</span> : null}
      </div>
    </article>
  );
}
