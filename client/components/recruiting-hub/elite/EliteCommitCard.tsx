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
 * Status on the card before NSD: verbally committed (not signed).
 * Never show "Signed" until National Signing Day / real LOI.
 */
function commitStamp(commit: RhHubCommit): { label: string; tone: 'enrolled' | 'committed' | 'accent' } {
  if (commit.enrolled) return { label: 'Enrolled', tone: 'enrolled' };
  const raw = String(commit.statusBadge || '').trim();
  if (!raw) return { label: 'Committed', tone: 'committed' };
  // Badges that are still accurate pre-NSD (headliner / star callouts).
  if (/^(headliner|5★|5\*|enrolled)$/i.test(raw)) {
    return { label: raw === '5*' ? '5★' : raw, tone: /enrolled/i.test(raw) ? 'enrolled' : 'accent' };
  }
  // Anything that implies paperwork (Signed / LOI) → verbal commit language.
  if (/sign|loi|inked/i.test(raw)) return { label: 'Committed', tone: 'committed' };
  return { label: raw, tone: 'accent' };
}

/**
 * Fan-first commit card — same surface for every class year.
 * Compact identity mark + commit stamp; Vault Scouting lives on the player profile.
 */
export function EliteCommitCard({ commit, year }: Props): React.ReactElement {
  const meta = commit.metaLine || commit.rankNote;
  const skinnyRaw = commit.skinny?.trim() || null;
  // Brief stays untitled — strip any legacy "Vault Eval —" prefix from API/iOS payloads.
  const skinny = stripVaultLabel(skinnyRaw, 'Eval');
  const showJersey = year <= 2026 && commit.jerseyNumber != null && String(commit.jerseyNumber).trim() !== '';
  const stamp = commitStamp(commit);

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
          {meta ? <p className="rh-commit-meta">{meta}</p> : null}
        </div>

        <span
          className={`rh-elite-commit-card__stamp rh-elite-commit-card__stamp--${stamp.tone}`}
        >
          {stamp.label}
        </span>
      </div>

      {commit.inState ? (
        <div className="rh-commit-badges rh-elite-commit-card__badges">
          <span className="rh-badge rh-badge--instate">In-state</span>
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
