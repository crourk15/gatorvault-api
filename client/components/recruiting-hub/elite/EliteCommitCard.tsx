'use client';

import React from 'react';
import type { RhHubCommit } from '@/lib/recruiting-hub-elite-api';

type Props = {
  commit: RhHubCommit;
  year: number;
};

/** Strip API "Vault X —" prefix when the card already has a CSS label. */
function stripVaultLabel(text: string | null | undefined, label: string): string | null {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const re = new RegExp(`^vault\\s+${label}\\s*[—\\-:]\\s*`, 'i');
  return raw.replace(re, '').trim() || raw;
}

/**
 * Fan-first commit card — untitled brief + Vault Comp / Vault Projection.
 * Deep eval lives on the player profile (Vault Scouting). Meta line carries ranks under the name.
 * Comp/Projection API text may carry Vault labels for older iOS; web strips + uses CSS labels.
 */
export function EliteCommitCard({ commit, year }: Props): React.ReactElement {
  const meta = commit.metaLine || commit.rankNote;
  const skinnyRaw = commit.skinny?.trim() || null;
  // Brief stays untitled — strip any legacy "Vault Eval —" prefix from API/iOS payloads.
  const skinny = stripVaultLabel(skinnyRaw, 'Eval');
  const showJersey = year <= 2026 && commit.jerseyNumber != null && String(commit.jerseyNumber).trim() !== '';
  const comp = stripVaultLabel(commit.playerComp, 'Comp');
  const showComp = Boolean(comp && !/^tbd$/i.test(comp) && !(skinny && skinny.includes(comp)));
  const projection = stripVaultLabel(commit.projection, 'Projection');

  return (
    <article className="rh-commit-card rh-elite-commit-card" data-testid="rh-elite-commit-card">
      <div className="rh-commit-header">
        <div>
          <a href={commit.profileUrl} className="rh-commit-name">
            {commit.name}
          </a>
          {meta ? <p className="rh-commit-meta">{meta}</p> : null}
        </div>
        <div className="rh-commit-badges">
          {commit.inState ? <span className="rh-badge rh-badge--instate">In-state</span> : null}
          {commit.statusBadge ? <span className="rh-badge">{commit.statusBadge}</span> : null}
        </div>
      </div>

      {skinny ? <p className="rh-commit-strengths rh-commit-skinny">{skinny}</p> : null}

      {showComp ? (
        <p className="rh-commit-strengths">
          <span className="rh-commit-strengths__label">Vault Comp</span>
          {comp}
        </p>
      ) : null}

      {projection ? (
        <p className="rh-commit-strengths rh-commit-projection">
          <span className="rh-commit-strengths__label">Vault Projection</span>
          {projection}
        </p>
      ) : null}

      <div className="rh-commit-footer">
        <span>Committed {commit.commitDate}</span>
        {commit.rating && commit.rating !== '—' ? <span>Rating {commit.rating}</span> : null}
        {showJersey ? <span>#{commit.jerseyNumber}</span> : null}
        {commit.nilEstimate ? <span>NIL {commit.nilEstimate}</span> : null}
      </div>
    </article>
  );
}
