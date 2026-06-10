/**
 * Clean skinny alerts + profile notes for recruits — no tweet text, links, or attribution.
 */
const STAR = '⭐';

function sanitizeSourceText(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\b(?:vip|premium|subscriber)\b[^\s.]*/gi, ' ')
    .replace(/@\w+/g, ' ')
    .replace(/(?:^|\s)(?:he|she|they)\s+tells\s+\w+[^\s.]*/gi, ' ')
    .replace(/["“”''].+?["“”'']/g, ' ')
    .replace(/\b(?:per|via|source:|per\s+\w+\s+writer)\s+[^\s.]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function starPrefix(stars) {
  const n = parseInt(stars, 10);
  return n >= 1 && n <= 5 ? `${n}${STAR}` : '';
}

function posLabel(pos) {
  const p = String(pos || '').trim();
  return p || 'Prospect';
}

function playerName(name) {
  return String(name || '').trim() || 'Prospect';
}

function priorityLabel(player) {
  const stars = parseInt(player?.stars, 10) || 0;
  const natl = parseInt(player?.natlRank, 10);
  if (stars >= 4 || (natl && natl <= 150)) return 'priority';
  return 'secondary';
}

function schoolCommitPrefix(player) {
  const committed = String(player?.committedTo || '').trim();
  if (committed && !/florida|gators|\buf\b/i.test(committed)) {
    return `${committed} commit ${playerName(player.name)}`;
  }
  return playerName(player.name);
}

function visitTimingLabel(row = {}) {
  if (row.visitStart) {
    try {
      const d = new Date(row.visitStart);
      const now = new Date();
      const diffDays = Math.round((d - now) / 86400000);
      if (diffDays >= 0 && diffDays <= 7) return 'this week';
      if (diffDays > 7 && diffDays <= 14) return 'in the coming days';
    } catch {
      /* ignore */
    }
  }
  return 'this week';
}

function visitHistoryPhrase(existing, player) {
  const hadVisit =
    existing?.ufOvStatus === 'visit' ||
    existing?.ufOvStatus === 'scheduled' ||
    existing?.visitStart ||
    player?.visitStart;
  if (hadVisit) return 'visited Florida previously this offseason';
  return 'shown interest in Florida this offseason';
}

function optionalContext(rawDetail, maxLen = 120) {
  const clean = sanitizeSourceText(rawDetail);
  if (!clean || clean.length < 12) return '';
  const sentence = clean.split(/[.!?]/)[0].trim();
  if (!sentence || sentence.length < 12) return '';
  const clipped = sentence.length > maxLen ? `${sentence.slice(0, maxLen - 1).trim()}…` : sentence;
  if (/@\w|https?:|vip|tells/i.test(clipped)) return '';
  return clipped.endsWith('.') ? clipped : `${clipped}.`;
}

function joinParts(parts) {
  return parts
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\.\s+\./g, '.')
    .trim();
}

function buildSkinnyAlert({ player = {}, eventType = 'target_update', row = {}, extraContext = null } = {}) {
  const stars = starPrefix(player.stars);
  const pos = posLabel(player.pos);
  const name = playerName(player.name);
  const ctx = extraContext != null ? sanitizeSourceText(extraContext) : optionalContext(row.detail);

  switch (eventType) {
    case 'official_visit':
      return joinParts([
        `${stars} ${pos} ${name} will take an official visit to Florida ${visitTimingLabel(row)}.`.replace(/\s+/g, ' ').trim(),
        ctx && !ctx.toLowerCase().includes('official visit') ? ctx : ''
      ]);

    case 'unofficial_visit':
      return joinParts([
        `${stars} ${pos} ${name} will visit Florida ${visitTimingLabel(row)}.`.replace(/\s+/g, ' ').trim(),
        ctx && !/visit/i.test(ctx) ? ctx : ''
      ]);

    case 'visit_cancelled':
    case 'ov_change': {
      const next = String(row.nextVisitSchool || player.nextVisitSchool || '').trim();
      const base = `${stars} ${pos} ${name} has cancelled his official visit to Florida.`.replace(/\s+/g, ' ').trim();
      return next ? `${base} He is now scheduled to visit ${next}.` : base;
    }

    case 'prediction':
      return `${stars} ${pos} ${name} is trending toward Florida in recruiting predictions.`.replace(/\s+/g, ' ').trim();

    case 'commit':
      return `${stars} ${pos} ${name} has committed to Florida.`.replace(/\s+/g, ' ').trim();

    case 'flip':
      return `${stars} ${pos} ${name} has flipped his commitment to Florida.`.replace(/\s+/g, ' ').trim();

    case 'decommit':
      return `${stars} ${pos} ${name} has decommitted from Florida.`.replace(/\s+/g, ' ').trim();

    case 'portal_in':
      return `${stars} ${pos} ${name} is entering the portal with Florida among his top options.`.replace(/\s+/g, ' ').trim();

    case 'portal_out':
      return `${stars} ${pos} ${name} has entered the transfer portal.`.replace(/\s+/g, ' ').trim();

    default: {
      const bits = [stars, pos, name].filter(Boolean);
      const fallback = bits.length ? `${bits.join(' ')} recruiting update.` : 'Recruiting update.';
      return ctx || fallback;
    }
  }
}

function buildProfileNote({
  player = {},
  existing = null,
  eventType = 'target_update',
  row = {},
  extraContext = null
} = {}) {
  const name = schoolCommitPrefix(player);
  const pos = posLabel(player.pos);
  const priority = priorityLabel(player);
  const ctx = extraContext != null ? sanitizeSourceText(extraContext) : optionalContext(row.detail, 160);
  const next = String(row.nextVisitSchool || player.nextVisitSchool || '').trim();

  switch (eventType) {
    case 'official_visit':
      return joinParts([
        `${name} has ${visitHistoryPhrase(existing, player)} and is scheduled for an official visit this week.`,
        `Florida continues to evaluate him as a ${priority} ${pos} target.`,
        ctx
      ]);

    case 'unofficial_visit':
      return joinParts([
        `${name} has ${visitHistoryPhrase(existing, player)} and is expected on campus again soon.`,
        `Florida continues to evaluate him as a ${priority} ${pos} target.`,
        ctx
      ]);

    case 'visit_cancelled':
    case 'ov_change':
      return joinParts([
        `${name} cancelled his scheduled official visit to Florida${next ? ` and is now targeting ${next}` : ''}.`,
        `Florida had been evaluating him as a ${priority} ${pos} target.`,
        ctx
      ]);

    case 'prediction':
      return joinParts([
        `${name} has picked up FutureCast momentum toward Florida.`,
        `Florida continues to monitor him as a ${priority} ${pos} target.`,
        ctx
      ]);

    case 'commit':
      return joinParts([
        `${name} committed to Florida.`,
        `He projects as a ${priority} ${pos} addition for the Gators.`,
        ctx
      ]);

    case 'flip':
      return joinParts([
        `${name} flipped his commitment to Florida.`,
        `Florida adds a ${priority} ${pos} target.`,
        ctx
      ]);

    case 'decommit':
      return joinParts([
        `${name} decommitted from Florida.`,
        `Staff will reassess the ${pos} board after the change.`,
        ctx
      ]);

    case 'portal_in':
      return joinParts([
        `${name} is in the transfer portal with Florida in the mix.`,
        `Staff view him as a ${priority} ${pos} fit.`,
        ctx
      ]);

    default:
      return joinParts([
        `${name} remains on Florida's ${priority} ${pos} board.`,
        ctx
      ]);
  }
}

function buildRecruitingCopy({ player, existing, eventType, row = {} }) {
  return {
    skinny: buildSkinnyAlert({ player, eventType, row }),
    profileNote: buildProfileNote({ player, existing, eventType, row })
  };
}

module.exports = {
  sanitizeSourceText,
  buildSkinnyAlert,
  buildProfileNote,
  buildRecruitingCopy,
  priorityLabel,
  visitHistoryPhrase
};
