/**
 * Reject beat intel when prose names a different prospect than the tagged slug.
 */
function normalizeToken(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/\./g, '')
    .trim();
}

function nameParts(name = '') {
  return normalizeToken(name)
    .split(/\s+/)
    .filter((part) => part.length > 1);
}

function slugifyName(name = '') {
  try {
    return require('../slug').slugify(String(name || ''));
  } catch {
    return normalizeToken(name).replace(/\s+/g, '-');
  }
}

const COACH_NEWS_RE =
  /\b(?:former|ex-)\b[^.]{0,80}\b(?:head coach|assistant coach|lead assistant coach|coach)\b/i;
const PRO_SPORTS_CONTEXT_RE =
  /\b(?:spurs|thunder|bulls|lakers|celtics|warriors|nba|nfl|mlb|coaching staff|under mitch johnson)\b/i;

function detectNonRecruitingBeat(slug, beatText) {
  const beat = String(beatText || '');
  if (!beat) return { mismatch: false };

  if (COACH_NEWS_RE.test(beat) && PRO_SPORTS_CONTEXT_RE.test(beat)) {
    return { mismatch: true, reason: 'coach_news_mislink' };
  }
  if (
    /\b(?:head coach of the|assistant coach for the)\b/i.test(beat) &&
    !/\b(?:quarterback|safety|cornerback|linebacker|recruit|prospect|offer|visit|commit|unofficial)\b/i.test(beat)
  ) {
    return { mismatch: true, reason: 'coach_news_mislink' };
  }

  void slug;
  return { mismatch: false };
}

function detectBeatIdentityMismatch(slug, playerName, beatText, meta = {}) {
  const key = normalizeToken(slug);
  const beat = String(beatText || '');
  const parts = nameParts(playerName);
  const lastName = parts[parts.length - 1] || null;
  if (!key || !beat) return { mismatch: false };

  const nonRecruiting = detectNonRecruitingBeat(key, beat);
  if (nonRecruiting.mismatch) return nonRecruiting;

  const fingerprint = normalizeToken(meta.fingerprint || '');
  if (fingerprint) {
    const fpSlugMatch = fingerprint.match(/beat_[a-z0-9-]+_20\d{2}/i);
    const embedded = fingerprint.match(/([a-z]+(?:-[a-z]+){1,4})_\d{4}-\d{2}-\d{2}/i);
    const namedInFp = fingerprint.match(/beat_[a-z0-9-]+_([a-z0-9-]+)_20\d{2}/i);
    if (namedInFp && namedInFp[1] && !key.includes(namedInFp[1]) && namedInFp[1].length > 4) {
      if (!key.includes(namedInFp[1].split('-').pop())) {
        return {
          mismatch: true,
          reason: 'fingerprint_names_other_player',
          mentionedSlug: namedInFp[1]
        };
      }
    }
    if (/isaac-kalubi|lukuni/i.test(fingerprint) && key === 'dk-kalu') {
      return {
        mismatch: true,
        reason: 'fingerprint_names_other_player',
        mentionedSlug: 'isaac-kalubi-lukuni'
      };
    }
    void fpSlugMatch;
    void embedded;
  }

  const possessiveRe = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s*'s\b/g;
  let match;
  while ((match = possessiveRe.exec(beat)) !== null) {
    const mentioned = match[1];
    const mentionedParts = nameParts(mentioned);
    const mentionedLast = mentionedParts[mentionedParts.length - 1];
    if (!mentionedLast) continue;
    if (/^(florida|gators|sec|program|staff|coaching)$/i.test(mentionedLast)) continue;
    if (lastName && mentionedLast === lastName) continue;
    if (parts.length && mentionedParts.some((part) => parts.includes(part))) continue;
    if (key.includes(mentionedLast)) continue;
    const mentionSlug = slugifyName(mentioned);
    if (mentionSlug && mentionSlug !== key && mentionedParts.length >= 2) {
      return {
        mismatch: true,
        reason: 'beat_names_other_player',
        mentionedName: mentioned,
        mentionedSlug: mentionSlug
      };
    }
  }

  return { mismatch: false };
}

function filterBeatIntelRows(slug, rows = [], playerName = null) {
  return (rows || []).filter((row) => {
    const text = String(row.detail || row.skinny || row.text || '').trim();
    if (!text) return false;
    const check = detectBeatIdentityMismatch(slug, row.playerName || playerName, text, {
      fingerprint: row.fingerprint || null
    });
    return !check.mismatch;
  });
}

function pickBeatIntelRow(slug, rows = [], playerName = null) {
  const valid = filterBeatIntelRows(slug, rows, playerName);
  return (
    valid.find((row) => /on3-team-news/i.test(String(row.source || ''))) ||
    valid.find((row) => /beat|on3/i.test(String(row.source || ''))) ||
    valid[0] ||
    null
  );
}

module.exports = {
  detectBeatIdentityMismatch,
  detectNonRecruitingBeat,
  filterBeatIntelRows,
  pickBeatIntelRow
};
