'use client';

import React from 'react';
import type { RhHubCommit } from '@/lib/recruiting-hub-elite-api';

type Props = {
  commit: RhHubCommit;
  year: number;
};

type MetaChip = { kind: 'stars' | 'pos' | 'home' | 'rank'; text: string };

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
  // Stars belong in the mark / meta chips — stamp stays commitment language.
  return { label: 'Committed', tone: 'committed' };
}

/** Break the flat meta string into readable chips. */
function buildMetaChips(commit: RhHubCommit): MetaChip[] {
  const chips: MetaChip[] = [];
  const seen = new Set<string>();
  const push = (chip: MetaChip) => {
    const key = chip.text.toLowerCase();
    if (!chip.text || seen.has(key)) return;
    seen.add(key);
    chips.push(chip);
  };

  if (commit.stars != null && commit.stars > 0) {
    push({ kind: 'stars', text: `${commit.stars}★` });
  }
  if (commit.position) push({ kind: 'pos', text: commit.position });

  const meta = String(commit.metaLine || commit.rankNote || '').trim();
  if (!meta) return chips;

  for (const seg of meta.split('·').map((s) => s.trim()).filter(Boolean)) {
    // Skip "5★ IOL" style first segment — already covered by stars + pos chips.
    if (/^\d\s*★/.test(seg)) continue;
    if (commit.position && seg.toUpperCase() === commit.position.toUpperCase()) continue;
    if (/^#\d/.test(seg)) {
      push({ kind: 'rank', text: seg.replace(/\bnationally\b/i, 'natl').replace(/\bnatl\.?/i, 'NATL') });
      continue;
    }
    push({ kind: 'home', text: seg });
  }

  return chips;
}

/**
 * Fan-first commit card — same surface for every class year.
 * Identity + meta chips + composite score; Vault Scouting on the profile.
 */
export function EliteCommitCard({ commit, year }: Props): React.ReactElement {
  const skinnyRaw = commit.skinny?.trim() || null;
  const skinny = stripVaultLabel(skinnyRaw, 'Eval');
  const showJersey = year <= 2026 && commit.jerseyNumber != null && String(commit.jerseyNumber).trim() !== '';
  const stamp = commitStamp(commit);
  const metaChips = buildMetaChips(commit);
  const rating =
    commit.rating && commit.rating !== '—' ? commit.rating : null;

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
          {metaChips.length ? (
            <ul className="rh-elite-commit-card__meta-chips" aria-label="Player meta">
              {metaChips.map((chip) => (
                <li
                  key={`${chip.kind}-${chip.text}`}
                  className={`rh-elite-commit-card__chip rh-elite-commit-card__chip--${chip.kind}`}
                >
                  {chip.text}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <span
          className={`rh-elite-commit-card__stamp rh-elite-commit-card__stamp--${stamp.tone}`}
          data-testid="rh-elite-commit-stamp"
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
