'use strict';

/**
 * Class headliner among UF commits = highest rank (lowest national number),
 * then rating. First-commit flags must not pin a lower-ranked pledge.
 */

function nationalRankOf(row) {
  const n = Number(row?.nationalRank ?? row?.natlRank ?? row?.natl);
  if (Number.isFinite(n) && n > 0) return n;
  const m = String(row?.metaLine || row?.rankNote || '').match(/#(\d+)\s*natl/i);
  return m ? Number(m[1]) : 9999;
}

function ratingOf(row) {
  const n = Number(String(row?.rating ?? row?.displayRating ?? row?.compositeScore ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function commitId(row) {
  return String(row?.slug || row?.id || '').trim().toLowerCase();
}

function pickClassHeadlinerId(commits) {
  const list = (Array.isArray(commits) ? commits : []).filter((row) => commitId(row));
  if (!list.length) return null;
  const ranked = [...list].sort((a, b) => {
    const ra = nationalRankOf(a);
    const rb = nationalRankOf(b);
    if (ra !== rb) return ra - rb;
    return ratingOf(b) - ratingOf(a);
  });
  return commitId(ranked[0]);
}

function isClassHeadlinerCommit(row, commits) {
  const id = commitId(row);
  const head = pickClassHeadlinerId(commits);
  return Boolean(id && head && id === head);
}

function healCommitHeadlinerBadges(items, year) {
  if (year != null && Number(year) < 2028) return items;
  if (!Array.isArray(items) || items.length < 2) return items;
  const head = pickClassHeadlinerId(items);
  if (!head) return items;
  let changed = false;
  const next = items.map((row) => {
    if (!row || typeof row !== 'object') return row;
    if (row.enrolled) return row;
    const mine = commitId(row) === head;
    const badge = String(row.statusBadge || '');
    const skinny = String(row.skinny || '');
    let statusBadge = badge;
    let nextSkinny = skinny;
    if (mine) {
      if (!/^headliner$/i.test(badge)) {
        statusBadge = 'Headliner';
        changed = true;
      }
      if (skinny && !/class headliner/i.test(skinny)) {
        nextSkinny = skinny.replace(/\.\s*$/, ' · Class headliner.');
        if (nextSkinny === skinny) nextSkinny = `${skinny.trim()} Class headliner.`;
        changed = true;
      }
    } else if (/^headliner$/i.test(badge)) {
      statusBadge = 'Committed';
      changed = true;
    }
    if (!mine && /class headliner/i.test(skinny)) {
      nextSkinny = skinny
        .replace(/\s*·\s*Class headliner/gi, '')
        .replace(/Class headliner\s*·\s*/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (nextSkinny !== skinny) changed = true;
    }
    if (statusBadge === badge && nextSkinny === skinny) return row;
    return { ...row, statusBadge, skinny: nextSkinny || row.skinny };
  });
  return changed ? next : items;
}

module.exports = {
  nationalRankOf,
  ratingOf,
  pickClassHeadlinerId,
  isClassHeadlinerCommit,
  healCommitHeadlinerBadges,
};
