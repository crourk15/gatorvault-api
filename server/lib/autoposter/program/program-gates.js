/**
 * Program elite compose gates — rumor block, recruiting mix, validation.
 */
const { extractProgramFacts, normalizeBeat } = require('./program-fact-extractor');

const RUMOR_RE =
  /\b(rumor|rumors|hearing|heard that|could land|might land|may land|sources? tell|per sources|nothing confirmed|unconfirmed|still fluid|take this with a grain)\b/i;

const RECRUITING_DOMINANT_RE =
  /\b(20\d{2}\s+(?:\d+-star|[0-9]\.?\d*)\s*(?:QB|RB|WR|TE|OL|OT|OG|C|DL|DE|EDGE|LB|CB|S|ATH|K|P)\b|\bofficial visit\b|\brecruit(?:ing|ment)\b|\btarget\b|\bprospect\b|\boffer(?:ed|s)?\b|\bcommit(?:ted|ment)?\b)/i;

const PROGRAM_SIGNAL_RE =
  /\b(heavener|training center|facility upgrade|renovation|nil|collective|florida victorious|gator boost|program culture|compete every snap|sec network|sec announces|tv announcement|broadcast|flex schedul(?:e|ing)|national tv|realignment|sec expansion|uniform reveal|branding|hall of fame|athletic department|florida athletics|uf athletics|football program|stadium)\b/i;

const THIN_FALLBACK_RE =
  /Florida program update:|Monitoring staff\/roster impact/i;

function isRumorBeat(beatText = '') {
  return RUMOR_RE.test(normalizeBeat(beatText));
}

function isRecruitingDominantProgramBeat(beatText = '') {
  const beat = normalizeBeat(beatText);
  if (!beat) return false;
  return RECRUITING_DOMINANT_RE.test(beat) && PROGRAM_SIGNAL_RE.test(beat);
}

function hasProgramSignal(beatText = '') {
  return PROGRAM_SIGNAL_RE.test(normalizeBeat(beatText));
}

function isFloridaRelevant(beatText = '') {
  const beat = normalizeBeat(beatText);
  return (
    /\b(florida|gators|gator|uf\b|swamp|gainesville)\b/i.test(beat) ||
    /\bheavener\b/i.test(beat)
  );
}

function passesProgramDetectionGate(beatText = '', post = null) {
  const beat = normalizeBeat(beatText);
  if (!beat) return { ok: false, reason: 'empty_beat' };
  if (!isFloridaRelevant(beat)) return { ok: false, reason: 'not_uf' };
  if (isRumorBeat(beat)) return { ok: false, reason: 'rumor_blocked' };
  if (isRecruitingDominantProgramBeat(beat)) return { ok: false, reason: 'recruiting_dominant' };
  if (!hasProgramSignal(beat) && !post?.programNewsType) {
    return { ok: false, reason: 'no_program_signal' };
  }

  const facts = extractProgramFacts(beat, {
    programNewsType: post?.programNewsType || null
  });
  if (facts.program_type === 'general' && !hasProgramSignal(beat)) {
    return { ok: false, reason: 'no_program_arc' };
  }

  return { ok: true, facts };
}

function hasFactCompleteness(facts = {}, ctx = {}) {
  if (!facts || !facts.program_type) return false;
  const hinted = String(ctx.programNewsType || '').toLowerCase();
  if (['sec_tv', 'realignment', 'branding', 'hall_of_fame', 'history', 'athletic_release', 'program_update'].includes(hinted)) {
    return true;
  }
  switch (facts.program_type) {
    case 'facility':
      return Boolean(facts.facility_name || facts.upgrade_type);
    case 'nil':
      return Boolean(facts.nil_entity);
    case 'culture':
      return Boolean(facts.program_quote && facts.program_speaker);
    case 'facility_visit':
      return Boolean(facts.facility_visit && (facts.facility_impression || facts.facility_quote));
    default:
      return Boolean(facts.official_source || facts.upgrade_type || facts.nil_entity);
  }
}

function validateProgramCompose(text = '') {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t || t.length < 40) return { ok: false, reason: 'too_short' };
  if (THIN_FALLBACK_RE.test(t)) return { ok: false, reason: 'thin_fallback' };
  if (RUMOR_RE.test(t)) return { ok: false, reason: 'rumor_copy' };
  return { ok: true };
}

module.exports = {
  RUMOR_RE,
  THIN_FALLBACK_RE,
  isRumorBeat,
  isRecruitingDominantProgramBeat,
  passesProgramDetectionGate,
  validateProgramCompose,
  hasFactCompleteness,
  hasProgramSignal
};