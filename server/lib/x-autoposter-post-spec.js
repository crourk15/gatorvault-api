/**
 * X AutoPoster — Elite posting spec (fast, UF-focused, insider-style).
 * Rules: ≤1h intel, mandatory identity + situation, 3-line template, dedupe/spam guards.
 */
const template = require('./x-autoposter-template');

/** Rule 1 — only post intel ≤ 60 minutes old */
const MAX_INTEL_AGE_MS = parseInt(process.env.X_AUTOPOST_MAX_INTEL_AGE_MS || String(60 * 60 * 1000), 10);

/** Rule 8 — no repost within 6 hours */
const DEDUPE_REPOST_WINDOW_MS = parseInt(
  process.env.X_AUTOPOST_DEDUPE_WINDOW_MS || String(6 * 60 * 60 * 1000),
  10
);

/** Rule 8 — similarity threshold */
const SIMILARITY_THRESHOLD = parseFloat(process.env.X_AUTOPOST_SIMILARITY_THRESHOLD || '0.85', 10);

const SITUATION_TYPES = [
  'visit',
  'offer',
  'trending',
  'portal',
  'commitment',
  'decommitment',
  'staff',
  'injury',
  'ranking',
  'general'
];

const SITUATION_DETECTORS = [
  {
    type: 'visit',
    patterns: [
      /\b(?:visit|OV|official visit|unofficial visit|\bofficial\b|\bunofficial\b|on campus|on-campus|in Gainesville|the Swamp|scheduled (?:a |an )?visit|visit (?:to |at )?(?:florida|gainesville|the swamp))\b/i
    ]
  },
  {
    type: 'offer',
    patterns: [/\b(?:offered|picked up an offer|extended an offer|received an offer|offer from florida|florida offered)\b/i]
  },
  {
    type: 'trending',
    patterns: [
      /\b(?:prediction|RPM|forecast|buzz|momentum|trending|heating up|staff confidence|confidence rising|crystal ball)\b/i
    ]
  },
  {
    type: 'portal',
    patterns: [/\b(?:entered the portal|portal target|portal interest|portal visit|transfer portal|in the portal)\b/i]
  },
  {
    type: 'commitment',
    patterns: [/\b(?:committed|flipped|pledged|commits to florida|committed to florida|flipped to florida)\b/i]
  },
  {
    type: 'decommitment',
    patterns: [/\b(?:decommitted|decommit|reopened recruitment|back on the market)\b/i]
  },
  {
    type: 'staff',
    patterns: [
      /\b(?:hired|promoted|role change|analyst added|coordinator|coach(?:es)?|WR coach|DL coach|GA\b|graduate assistant)\b/i
    ]
  },
  {
    type: 'injury',
    patterns: [/\b(?:out for|day-to-day|expected back|injury update|ruled out|game-time decision|\bout\b)\b/i]
  },
  {
    type: 'ranking',
    patterns: [/\b(?:moved up|moved down|new ranking|ranked no\.|on3 #|composite rating)\b/i]
  }
];

const UF_FRAMING_PHRASES = [
  'Florida continues to push',
  'Staff confidence rising',
  'A key visit for the Gators',
  'A name to watch for Florida',
  'The Gators are evaluating fit',
  'Florida is gaining momentum',
  'Behind the scenes, staff confidence',
  'The staff has been pushing hard',
  'Florida has early interest',
  'The Gators continue expanding'
];

const SITUATION_CONTEXT_TEMPLATES = {
  visit: [
    '{name} is on campus today for a Florida visit.',
    '{name} is scheduled for a visit to Gainesville.',
    '{name} has an official visit to Florida on the calendar.',
    '{name} is making a stop in The Swamp this weekend.'
  ],
  offer: [
    'Florida has offered {name}, a rising prospect with strong arm talent.',
    'Florida extended an offer to {name}.',
    '{name} picked up a Florida offer.',
    'The Gators have offered {name}.'
  ],
  portal: [
    'Portal {pos} {name} has officially entered the transfer portal.',
    '{name} entered the transfer portal.',
    '{name} is in the portal and drawing early interest.'
  ],
  trending: [
    'Florida is gaining momentum for {identityShort}.',
    '{name} is trending up for Florida.',
    'Recruiting momentum is building for {name} with the Gators.'
  ],
  commitment: [
    '{name} has committed to Florida.',
    '{name} flipped to Florida.',
    '{name} is shutting it down for the Gators.'
  ],
  decommitment: [
    '{name} has decommitted and reopened his recruitment.',
    '{name} is back on the market.'
  ],
  staff: [
    '{coachTitle} {coachName} continues to lead evaluations for {classTag} {posGroup}.',
    'Florida {coachTitle} {coachName} remains heavily involved in {posGroup} evaluations.'
  ],
  injury: [
    '{name} is {injuryStatus}.',
    'Injury update: {name} {injuryStatus}.'
  ],
  ranking: [
    '{name} moved in the national rankings.',
    '{name} received an updated On3 ranking.'
  ],
  general: ['{name} {situationHint}.']
};

const SITUATION_INSIDER_TEMPLATES = {
  visit: [
    'The staff has been pushing hard here, and this stop is viewed as an important checkpoint in the Gators\' pursuit.',
    'This visit is a key data point as Florida evaluates fit and timeline.',
    'Staff angle: Sumrall\'s crew wants clarity on where this one stands after the trip.'
  ],
  offer: [
    'The Gators continue expanding their early {pos} board as evaluations ramp up.',
    'Florida is positioning this offer within a broader push at the position.',
    'Staff view: offer extends UF\'s footprint in the {classTag} class.'
  ],
  portal: [
    'Florida has early interest and is evaluating his fit as they explore options at the position.',
    'The Gators are among the programs positioned to move if the fit checks out.',
    'UF staff is monitoring portal value at {pos}.'
  ],
  trending: [
    'Behind the scenes, staff confidence has quietly increased as communication has picked up.',
    'Florida is firmly in the mix with momentum building on the trail.',
    'The Gators are trending up — decision window worth watching.'
  ],
  commitment: [
    'Florida closes another piece of the {classTag} puzzle.',
    'Staff momentum converts to a commitment — roster fit validated.',
    'The Gators land a target they had prioritized on the board.'
  ],
  decommitment: [
    'Florida is expected to stay engaged as his timeline reopens.',
    'The Gators will monitor where this one lands in the new cycle.',
    'UF staff keeps this name on the short list after the decommitment.'
  ],
  staff: [
    'He\'s expected to be heavily involved in several upcoming summer visits.',
    'Florida\'s staff structure puts him at the center of {posGroup} evaluations.',
    'On-field impact expected as the Gators build out the {classTag} board.'
  ],
  injury: [
    'Florida will adjust depth chart planning based on availability.',
    'Staff monitoring recovery timeline before setting rotation plans.',
    'The Gators need clarity here before fall camp positioning.'
  ],
  ranking: [
    'Florida continues to track as his profile rises nationally.',
    'Ranking shift aligns with UF\'s evaluation timeline at {pos}.',
    'The Gators had already prioritized this name — ranking confirms the board read.'
  ],
  general: [
    'Florida is actively tracking — more clarity expected soon.',
    'The Gators remain engaged as this situation develops.',
    'Staff angle: UF is monitoring closely for the next move.'
  ]
};

function detectSituation(text, eventType) {
  const hay = `${eventType || ''} ${text || ''}`.trim();
  if (!hay) return 'general';

  for (const det of SITUATION_DETECTORS) {
    if (det.patterns.some((re) => re.test(hay))) return det.type;
  }

  const et = String(eventType || '').toLowerCase();
  if (/visit/.test(et)) return 'visit';
  if (/offer/.test(et)) return 'offer';
  if (/portal/.test(et)) return 'portal';
  if (/commit|flip/.test(et)) return 'commitment';
  if (/decommit/.test(et)) return 'decommitment';
  if (/prediction|trend|momentum|rpm|futurecast/.test(et)) return 'trending';
  if (/injury/.test(et)) return 'injury';
  if (/rank/.test(et)) return 'ranking';
  if (/staff|coach/.test(et)) return 'staff';

  return 'general';
}

function isCoachContext(ctx, text) {
  if (ctx?.isCoach) return true;
  const t = String(text || '').toLowerCase();
  return /\b(?:coach|coordinator|analyst|GA\b|graduate assistant)\b/i.test(t) && !ctx?.classYear;
}

function buildCoachIdentity(coachName, role, positionGroup) {
  const name = String(coachName || '').trim();
  const title = String(role || 'Florida coach').trim();
  const group = positionGroup ? String(positionGroup).trim() : null;
  if (group && !title.toLowerCase().includes(group.toLowerCase())) {
    return `Florida ${title} ${name}`.replace(/\s+/g, ' ').trim();
  }
  return `Florida ${title} ${name}`.replace(/\s+/g, ' ').trim();
}

function identityShort(ctx) {
  const parts = [];
  if (ctx.starsLabel) parts.push(ctx.starsLabel);
  if (ctx.pos) parts.push(ctx.pos);
  parts.push(ctx.name);
  if (ctx.classYear) parts.push(`(${ctx.classYear})`);
  return parts.join(' ').trim();
}

function fillTemplate(str, vars) {
  return String(str || '').replace(/\{(\w+)\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));
}

function pickVariant(templates, seed = 0) {
  const list = templates || [];
  if (!list.length) return '';
  return list[Math.abs(seed) % list.length];
}

function buildSituationContextLine(ctx, situation, meta = {}) {
  const name = ctx?.name || 'Target';
  const pos = ctx?.pos || '';
  const classTag = ctx?.classYear ? String(ctx.classYear) : '2026';
  const vars = {
    name,
    pos,
    identityShort: identityShort(ctx),
    classTag,
    coachName: meta.coachName || name,
    coachTitle: meta.coachTitle || pos || 'coach',
    posGroup: meta.posGroup || `${classTag} pass-catchers`,
    injuryStatus: meta.injuryStatus || 'day-to-day',
    situationHint: meta.situationHint || 'has new recruiting movement'
  };

  const templates = SITUATION_CONTEXT_TEMPLATES[situation] || SITUATION_CONTEXT_TEMPLATES.general;
  const line = fillTemplate(pickVariant(templates, name.length + situation.length), vars);
  return template.sanitizeCopyLine(line, 160, { eliteMode: true });
}

function buildUfInsiderLine(ctx, situation, meta = {}) {
  const classTag = ctx?.classYear ? String(ctx.classYear) : '2026';
  const pos = ctx?.pos || 'position';
  const templates = SITUATION_INSIDER_TEMPLATES[situation] || SITUATION_INSIDER_TEMPLATES.general;
  const line = fillTemplate(pickVariant(templates, (ctx?.name || '').length + pos.length), {
    classTag,
    pos,
    posGroup: meta.posGroup || `${classTag} ${pos}s`.replace(/s+s/g, 's')
  });
  return template.sanitizeCopyLine(line, 140, { eliteMode: true });
}

function validateMandatoryFields(ctx, situation, { isCoach = false } = {}) {
  const missing = [];
  const skipReasons = [];

  if (isCoach || ctx?.isCoach) {
    if (!ctx?.name || ctx.name.length < 4) missing.push('coachName');
    if (!ctx?.pos && !ctx?.coachRole) missing.push('coachRole');
    if (missing.length) {
      skipReasons.push('missing_coach_identity');
      return { ok: false, missing, skipReason: 'missing_coach_identity', reason: 'Coach posts require name and role.' };
    }
    return { ok: true, missing: [], situation: situation || 'staff' };
  }

  if (!ctx?.name || ctx.name.length < 4) missing.push('name');
  if (!ctx?.pos) missing.push('position');
  if (!ctx?.isPortal && (!ctx?.classYear || Number.isNaN(Number(ctx.classYear)))) missing.push('classYear');

  if (missing.length) {
    return {
      ok: false,
      missing,
      skipReason: 'missing_mandatory_fields',
      reason: `Missing mandatory fields: ${missing.join(', ')}`
    };
  }

  return { ok: true, missing: [], situation: situation || 'general' };
}

function validateIntelFreshness(timestampMs, now = Date.now()) {
  if (timestampMs == null || Number.isNaN(timestampMs)) {
    return { ok: false, skipReason: 'missing_timestamp', reason: 'Intel timestamp required.', ageSec: null };
  }
  const ageSec = Math.round((now - timestampMs) / 1000);
  if (ageSec > MAX_INTEL_AGE_MS / 1000) {
    return {
      ok: false,
      skipReason: 'stale_intel',
      reason: `Stale intel — source is ${Math.round(ageSec / 60)}m old (max ${MAX_INTEL_AGE_MS / 60000}m).`,
      ageSec,
      logTag: 'stale intel'
    };
  }
  return { ok: true, ageSec, logTag: null };
}

function tokenSet(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^\w\s']/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function textSimilarity(a, b) {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  sa.forEach((w) => {
    if (sb.has(w)) inter += 1;
  });
  return inter / Math.max(sa.size, sb.size);
}

function jaccardSimilarity(a, b) {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  sa.forEach((w) => {
    if (sb.has(w)) inter += 1;
  });
  const union = sa.size + sb.size - inter;
  return union ? inter / union : 0;
}

function isTooSimilar(generated, existing, threshold = SIMILARITY_THRESHOLD) {
  const sim = Math.max(textSimilarity(generated, existing), jaccardSimilarity(generated, existing));
  return sim >= threshold;
}

function findSimilarInQueue(text, items, threshold = SIMILARITY_THRESHOLD) {
  const cutoff = Date.now() - DEDUPE_REPOST_WINDOW_MS;
  for (const item of items || []) {
    if (!item?.text) continue;
    const sentAt = item.sentAt ? new Date(item.sentAt).getTime() : 0;
    const createdAt = item.createdAt ? new Date(item.createdAt).getTime() : 0;
    const ts = Math.max(sentAt, createdAt);
    if (item.status === 'pending' || (item.status === 'sent' && ts >= cutoff)) {
      if (isTooSimilar(text, item.text, threshold)) {
        return { hit: true, itemId: item.id, similarity: textSimilarity(text, item.text) };
      }
    }
  }
  return { hit: false };
}

function composeStructuredPost(ctx, situation, meta = {}) {
  const identity = ctx?.isCoach
    ? buildCoachIdentity(ctx.name, ctx.coachRole || ctx.pos, meta.posGroup)
    : template.buildRecruitingIdentity(ctx);

  const context = meta.contextLine || buildSituationContextLine(ctx, situation, meta);
  const insider = meta.insiderLine || buildUfInsiderLine(ctx, situation, meta);

  const text = template.composeInsiderReport({ identity, context, insider });
  return {
    text,
    templateBlocks: { identity, context, insider },
    situation,
    playerContext: ctx
  };
}

module.exports = {
  MAX_INTEL_AGE_MS,
  DEDUPE_REPOST_WINDOW_MS,
  SIMILARITY_THRESHOLD,
  SITUATION_TYPES,
  UF_FRAMING_PHRASES,
  detectSituation,
  isCoachContext,
  buildCoachIdentity,
  buildSituationContextLine,
  buildUfInsiderLine,
  validateMandatoryFields,
  validateIntelFreshness,
  textSimilarity,
  jaccardSimilarity,
  isTooSimilar,
  findSimilarInQueue,
  composeStructuredPost,
  identityShort
};
