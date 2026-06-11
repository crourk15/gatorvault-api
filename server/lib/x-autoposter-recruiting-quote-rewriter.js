/**
 * Recruiting Quote Rewriter — never post beat writer text verbatim.
 * Extracts quote meaning, rewrites in GatorVault voice, blocks >40% source overlap.
 */
const template = require('./x-autoposter-template');

const OVERLAP_THRESHOLD = parseFloat(process.env.X_AUTOPOST_QUOTE_OVERLAP_MAX || '0.4', 10);
const MAX_REGEN_ATTEMPTS = parseInt(process.env.X_AUTOPOST_QUOTE_REGEN_ATTEMPTS || '4', 10);

const QUOTE_PATTERNS = [
  /[""]([^""]{6,160})[""]/g,
  /['']([^'']{6,160})['']/g,
  /[""]([^""]{6,160})[""]/g,
  /\b(?:said|told|posted|tweeted|wrote|stated)\s+["""']([^"""']{6,160})["""']/gi
];

const FIRST_PERSON_SIGNAL =
  /\b(i(?:'m| am|'ve| have| will| want| love| like| feel| think| plan| can't wait| committed| chose))\b/i;

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'to', 'for', 'of', 'in', 'on', 'at', 'is', 'was', 'are', 'and', 'or', 'but',
  'i', 'he', 'she', 'they', 'we', 'you', 'it', 'that', 'this', 'with', 'from', 'as', 'be', 'has',
  'have', 'had', 'will', 'would', 'could', 'should', 'my', 'me', 'his', 'her', 'their', 'our',
  'your', 'who', 'what', 'when', 'where', 'how', 'just', 'very', 'really', 'about', 'into', 'up'
]);

const PER_REPORT_RE = /^per .+ report\.?$/i;

function isRewriterEnabled() {
  return process.env.X_AUTOPOST_QUOTE_REWRITER !== 'false';
}

function isPerReportLine(text) {
  return PER_REPORT_RE.test(String(text || '').trim());
}

function significantTokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function sourceOverlapRatio(generated, source) {
  const genSet = new Set(significantTokens(generated));
  const sourceWords = significantTokens(source);
  if (!sourceWords.length) return 0;
  let matched = 0;
  for (const w of sourceWords) {
    if (genSet.has(w)) matched += 1;
  }
  return matched / sourceWords.length;
}

function exceedsOverlap(generated, source) {
  if (!generated || !source) return false;
  return sourceOverlapRatio(generated, source) > OVERLAP_THRESHOLD;
}

function extractQuotes(beatText) {
  const text = template.stripEmojisHashtags(beatText || '');
  const found = [];
  const seen = new Set();

  for (const re of QUOTE_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const q = (m[1] || m[2] || '').trim();
      const key = q.toLowerCase();
      if (q.length >= 6 && !seen.has(key)) {
        seen.add(key);
        found.push({ text: q, speaker: 'player' });
      }
    }
  }

  if (!found.length) {
    for (const sentence of template.extractSentences(text)) {
      if (FIRST_PERSON_SIGNAL.test(sentence) && sentence.length >= 20 && sentence.length <= 180) {
        const key = sentence.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          found.push({ text: sentence, speaker: 'player', paraphrase: true });
        }
      }
    }
  }

  return found;
}

function inferSentiment(quotes, beatText) {
  const hay = [...quotes.map((q) => q.text), beatText].join(' ').toLowerCase();
  if (/\b(love|loved|blessed|dream|committed|all in|can't wait|home|gator|swamp)\b.*\b(florida|gators|uf|gainesville)\b/i.test(hay)) {
    return 'strong_uf_lean';
  }
  if (/\b(love|great|amazing|excited|impressed|best|top|favorite)\b/i.test(hay)) return 'positive';
  if (/\b(undecided|open|looking|considering|weighing|options|not sure|still deciding)\b/i.test(hay)) return 'open';
  if (/\b(not committed|elsewhere|staying|signed with|picked|chose)\b/i.test(hay)) return 'committed_elsewhere';
  if (/\b(decommit|portal|transfer|leaving)\b/i.test(hay)) return 'negative_shift';
  return 'neutral';
}

function inferPlayerIntent(quotes, beatText, eventType) {
  const hay = [...quotes.map((q) => q.text), beatText].join(' ');
  if (eventType === 'commit' || /\bcommit(?:ted|ment)?\b/i.test(hay)) return 'closing toward Florida';
  if (eventType === 'flip' || /\bflip(?:ped)?\b/i.test(hay)) return 'leaning flip to UF';
  if (eventType === 'decommit' || /\bdecommit\b/i.test(hay)) return 'reopening recruitment';
  if (/\bofficial visit|\bov\b/i.test(hay)) return 'evaluating Florida on campus';
  if (/\bunofficial|\buv\b/i.test(hay)) return 'building relationship with UF staff';
  if (/\boffer(?:ed|s)?\b/i.test(hay)) return 'weighing UF offer in the mix';
  if (/\bportal\b/i.test(hay)) return 'exploring portal options with UF involved';
  if (/\b(soon|decision|timeline|committing)\b/i.test(hay)) return 'approaching a decision window';
  if (quotes.some((q) => FIRST_PERSON_SIGNAL.test(q.text))) return 'signaling personal interest in the process';
  return 'monitoring Florida in the race';
}

function inferVisitSchedule(intel, research, beatText) {
  const visit =
    research?.timing?.visitWindow ||
    (intel?.visitStart && intel?.visitEnd ? `${intel.visitStart}–${intel.visitEnd}` : intel?.visitStart) ||
    null;
  if (visit) return visit;

  const t = String(beatText || '');
  const weekend = t.match(/\b(this|next)\s+(weekend|Saturday|Sunday)\b/i);
  if (weekend) return `${weekend[1]} ${weekend[2]}`;
  const monthDay = t.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}\b/i);
  if (monthDay) return monthDay[0];
  if (/\bofficial visit|\bov\b/i.test(t)) return 'official visit window set';
  if (/\bunofficial|\buv\b/i.test(t)) return 'unofficial visit planned';
  return null;
}

function inferReturnVisitPotential(intel, research, eventType) {
  if (eventType === 'visit_cancelled') {
    const next = intel?.nextVisitSchool || research?.intelRows?.find((r) => r.nextVisitSchool)?.nextVisitSchool;
    if (next && !/florida|gators/i.test(next)) return `return visit unlikely near-term — pivot to ${next}`;
    return 'return visit timing TBD after cancellation';
  }
  if (eventType === 'official_visit' || eventType === 'unofficial_visit') return 'second visit possible if first trip goes well';
  if (eventType === 'trending' || eventType === 'staff_push') return 'campus return trip on the table if momentum holds';
  if (research?.ufPosition === 'leading' || research?.ufPosition === 'staff priority') return 'strong chance of a follow-up visit';
  return null;
}

function inferCompetition(research, intel, beatText) {
  const schools = new Set();
  if (research?.topSchools) {
    for (const s of research.topSchools) {
      if (s && !/florida|gators|\buf\b/i.test(s)) schools.add(s);
    }
  }
  if (intel?.nextVisitSchool && !/florida|gators/i.test(intel.nextVisitSchool)) {
    schools.add(intel.nextVisitSchool);
  }
  const t = String(beatText || '');
  const also = t.match(/\b(?:also|along with|competing with|between)\s+([A-Z][A-Za-z .'-]{2,24}(?:,\s*[A-Z][A-Za-z .'-]{2,24}){0,3})/);
  if (also?.[1]) {
    also[1].split(/,\s*/).forEach((s) => {
      const clean = s.trim();
      if (clean && !/florida|gators/i.test(clean)) schools.add(clean);
    });
  }
  return [...schools].slice(0, 3);
}

function inferMomentum(research, sentiment, eventType) {
  if (research?.ufPosition === 'staff priority') return 'staff priority momentum building';
  if (research?.ufPosition === 'leading') return 'Florida sits in the lead group';
  if (sentiment === 'strong_uf_lean') return 'recruiting momentum tilting toward UF';
  if (eventType === 'prediction' && research?.predictions?.length) {
    const p = research.predictions[0];
    const pct = p.confidencePct || p.ufRpmPct;
    if (pct) return `Crystal Ball heat at ${pct}% for Florida`;
  }
  if (eventType === 'trending') return 'trending up on Florida board';
  if (eventType === 'offer') return 'offer extends UF footprint in the race';
  return null;
}

function mapUfStanding(research, intel, eventType, sentiment) {
  if (research?.ufPosition) {
    switch (research.ufPosition) {
      case 'committed':
        return 'Florida has closed';
      case 'hosting OV':
        return 'Florida is hosting an official visit';
      case 'leading':
        return 'Florida leads the pack';
      case 'staff priority':
        return 'UF staff has him on the short list';
      case 'offered':
        return 'Florida has extended an offer';
      case 'in the mix':
        return 'Florida is firmly in the mix';
      case 'trending up':
        return 'Florida is gaining traction';
      default:
        return 'Florida is actively tracking';
    }
  }
  if (eventType === 'commit') return 'Florida has landed the commitment';
  if (eventType === 'flip') return 'Florida is the flip destination';
  if (sentiment === 'strong_uf_lean') return 'Florida is the clear lean';
  if (intel?.ufRpmPct >= 50) return `On3 RPM has Florida at ${intel.ufRpmPct}%`;
  return 'Florida remains in the conversation';
}

function analyzeRecruitingSignal({ beatText, ctx, intel, research, eventType, newsEvent } = {}) {
  const quotes = extractQuotes(beatText);
  const sentiment = inferSentiment(quotes, beatText);
  const resolvedEvent = eventType || research?.eventType || intel?.eventType || 'update';
  const competition = inferCompetition(research, intel, beatText);
  const visitSchedule = inferVisitSchedule(intel, research, beatText);
  const returnVisitPotential = inferReturnVisitPotential(intel, research, resolvedEvent);
  const momentum = inferMomentum(research, sentiment, resolvedEvent);
  const ufStanding = mapUfStanding(research, intel, resolvedEvent, sentiment);
  const playerIntent = inferPlayerIntent(quotes, beatText, resolvedEvent);

  return {
    quotes,
    sentiment,
    ufStanding,
    visitSchedule,
    competition,
    playerIntent,
    momentum,
    returnVisitPotential,
    eventType: resolvedEvent,
    newsEvent,
    quoteSummary: quotes.length
      ? quotes.map((q) => summarizeQuote(q.text)).join('; ')
      : null
  };
}

function summarizeQuote(quoteText) {
  const q = String(quoteText || '').trim();
  const lower = q.toLowerCase();
  if (/\blove\b.*\b(florida|gators|uf|gainesville|swamp)\b/i.test(q)) return 'expresses strong affection for Florida';
  if (/\b(commit|committed|all in|dream school)\b/i.test(q)) return 'signals commitment intent toward Florida';
  if (/\b(visit|coming|campus|gainesville)\b/i.test(q)) return 'references a Florida campus visit';
  if (/\b(blessed|grateful|honored|excited)\b/i.test(q)) return 'shows positive emotion about the process';
  if (/\b(undecided|open|options|weighing)\b/i.test(q)) return 'keeps options open in the process';
  if (FIRST_PERSON_SIGNAL.test(q)) return 'first-person comment on his recruitment';
  return 'player-commentary on the recruitment trail';
}

function buildContextVariants(signal, ctx, research) {
  const name = ctx?.name || research?.playerName || 'Target';
  const pos = ctx?.pos || research?.player?.pos || '';
  const yr = ctx?.classYear || research?.player?.classYear || '';
  const yrTag = yr ? `'${String(yr).slice(-2)}` : '';
  const id = [name, pos, yrTag].filter(Boolean).join(' · ');

  const comp =
    signal.competition.length > 0
      ? ` with ${signal.competition.slice(0, 2).join(' and ')} also involved`
      : '';
  const visit = signal.visitSchedule ? ` — visit window: ${signal.visitSchedule}` : '';

  const variants = [];

  if (signal.quoteSummary) {
    variants.push(
      `${name}${pos ? ` (${pos})` : ''} ${signal.quoteSummary} — ${signal.ufStanding.toLowerCase()}${comp}.`
    );
  }

  switch (signal.eventType) {
    case 'commit':
      variants.push(`${name} shuts it down for Florida${yrTag ? ` in the ${yr} cycle` : ''} — ${signal.ufStanding.toLowerCase()}.`);
      break;
    case 'flip':
      variants.push(`${name} is flipping Florida's way${comp}${visit}.`);
      break;
    case 'decommit':
      variants.push(`${name} is back on the market — UF expected to stay engaged${comp}.`);
      break;
    case 'official_visit':
      variants.push(`${name} sets an official visit to The Swamp${visit}${comp}.`);
      break;
    case 'unofficial_visit':
      variants.push(`${name} plans a Gainesville trip${visit} as Florida pushes in the ${yr || '2026'} class.`);
      break;
    case 'visit_cancelled':
      variants.push(`${name} drops the Florida visit${visit ? ` (${signal.visitSchedule})` : ''} — timing shift to monitor.`);
      break;
    case 'offer':
      variants.push(`Florida extends an offer to ${name}${pos ? ` (${pos})` : ''}${research?.player?.natlRank ? ` · On3 #${research.player.natlRank}` : ''}.`);
      break;
    case 'prediction':
    case 'rivals_futurecast': {
      const pct = research?.predictions?.[0]?.confidencePct || research?.predictions?.[0]?.ufRpmPct;
      variants.push(
        pct
          ? `${name} picks up ${pct}% Florida Crystal Ball momentum${comp}.`
          : `${name} logs fresh prediction heat toward Florida${comp}.`
      );
      break;
    }
    case 'portal_in':
      variants.push(`${name} enters the portal — Florida among programs positioned to move${comp}.`);
      break;
    default:
      variants.push(`${name} ${signal.playerIntent} — ${signal.ufStanding.toLowerCase()}${comp}${visit}.`);
  }

  if (signal.momentum && !variants.some((v) => v.toLowerCase().includes('momentum'))) {
    variants.push(`${name}: ${signal.momentum}${comp}.`);
  }

  return variants.filter(Boolean).map((v) => template.sanitizeCopyLine(v, 160, { eliteMode: true }));
}

function buildInsiderVariants(signal, ctx, research, contextLine) {
  const name = ctx?.name || research?.playerName || 'Target';
  const contextNorm = template.stripEmojisHashtags(contextLine || '').toLowerCase();
  const variants = [];

  if (signal.returnVisitPotential && !contextNorm.includes('return visit')) {
    variants.push(`${name} — ${signal.returnVisitPotential}.`);
  }

  if (signal.momentum) {
    variants.push(`Board read: ${signal.momentum}.`);
  }

  if (signal.competition.length) {
    variants.push(`Competition watch: ${signal.competition.join(', ')} remain in the picture.`);
  }

  if (signal.sentiment === 'strong_uf_lean' || signal.sentiment === 'positive') {
    variants.push('GatorVault read: language points toward a favorable UF outcome.');
  } else if (signal.sentiment === 'open') {
    variants.push('GatorVault read: timeline still fluid — decision window approaching.');
  } else if (signal.playerIntent) {
    variants.push(`Trail signal: ${signal.playerIntent}.`);
  }

  if (research?.ufPosition === 'staff priority') {
    variants.push('Sumrall staff has made this one a priority on the board.');
  } else if (research?.ufPosition === 'leading') {
    variants.push('Florida sits in the lead group with momentum building.');
  } else if (research?.ufPosition === 'hosting OV') {
    variants.push('Official visit window should clarify where UF stands.');
  }

  if (research?.player?.natlRank && signal.eventType !== 'prediction') {
    variants.push(`On3 has him at No. ${research.player.natlRank} nationally — UF fits the timeline.`);
  }

  if (research?.predictions?.length) {
    const p = research.predictions[0];
    const pct = p.confidencePct || p.ufRpmPct;
    if (pct) {
      variants.push(`${p.analystName || p.source || 'Analyst'} has Florida at ${pct}% in the Crystal Ball mix.`);
    }
  }

  variants.push('Florida is actively tracking — more clarity expected soon.');

  return variants
    .map((v) => template.sanitizeCopyLine(v, 140, { eliteMode: true }))
    .filter((v) => template.stripEmojisHashtags(v).toLowerCase() !== contextNorm);
}

function pickNonOverlapping(variants, sourceText, { minLen = 24 } = {}) {
  for (const v of variants) {
    if (!v || v.length < minLen) continue;
    if (!exceedsOverlap(v, sourceText)) return v;
  }
  return null;
}

function rewriteBeatUpdate({
  beatText,
  ctx = null,
  intel = null,
  research = null,
  newsEvent = null,
  eventType = null,
  sourceLabel = null,
  postKind = 'recruiting',
  sport = 'football'
} = {}) {
  if (sport !== 'football') {
    return { ok: false, reason: 'non_football_sport', sport };
  }
  if (!isRewriterEnabled() || !beatText) {
    return { ok: false, reason: 'disabled_or_empty' };
  }

  const signal = analyzeRecruitingSignal({
    beatText,
    ctx,
    intel,
    research,
    eventType: eventType || research?.eventType || intel?.eventType,
    newsEvent
  });

  const contextVariants = buildContextVariants(signal, ctx, research);
  const sourceText = template.stripEmojisHashtags(beatText);

  let contextLine = null;
  for (let i = 0; i < Math.min(MAX_REGEN_ATTEMPTS, contextVariants.length); i += 1) {
    const candidate = contextVariants[i];
    if (candidate && !exceedsOverlap(candidate, sourceText)) {
      contextLine = candidate;
      break;
    }
  }
  if (!contextLine) {
    contextLine = pickNonOverlapping(contextVariants, sourceText) || contextVariants[contextVariants.length - 1];
  }

  const insiderVariants = buildInsiderVariants(signal, ctx, research, contextLine);
  let insiderLine = pickNonOverlapping(insiderVariants, sourceText);
  if (!insiderLine) {
    for (const v of insiderVariants) {
      if (v && !exceedsOverlap(`${contextLine} ${v}`, sourceText)) {
        insiderLine = v;
        break;
      }
    }
  }
  if (!insiderLine) {
    insiderLine = insiderVariants[insiderVariants.length - 1] || 'Florida is actively tracking — more clarity expected soon.';
  }

  const combined = `${contextLine} ${insiderLine}`;
  if (exceedsOverlap(combined, sourceText)) {
    return {
      ok: false,
      reason: 'overlap_exceeded',
      signal,
      overlap: sourceOverlapRatio(combined, sourceText)
    };
  }

  return {
    ok: true,
    contextLine,
    insiderLine,
    signal,
    meta: {
      rewrittenFromQuote: signal.quotes.length > 0,
      quoteCount: signal.quotes.length,
      sentiment: signal.sentiment,
      ufStanding: signal.ufStanding,
      visitSchedule: signal.visitSchedule,
      competition: signal.competition,
      playerIntent: signal.playerIntent,
      momentum: signal.momentum,
      returnVisitPotential: signal.returnVisitPotential,
      overlapRatio: sourceOverlapRatio(combined, sourceText),
      sport
    }
  };
}

function buildFootballPerReportFallback(sourceLabel) {
  const src = String(sourceLabel || 'beat writer').trim();
  return `Per ${src} report.`;
}

function resolveInsiderFallback({ sourceLabel, sport = 'football', contextBuilderFailed = false } = {}) {
  if (contextBuilderFailed && sport === 'football') {
    return buildFootballPerReportFallback(sourceLabel);
  }
  return 'Florida is actively tracking — more clarity expected soon.';
}

function sanitizeRewrittenLine(line, beatText, maxLen = 160) {
  if (!line) return null;
  const cleaned = template.sanitizeCopyLine(line, maxLen, { eliteMode: true, beatText });
  if (exceedsOverlap(cleaned, beatText)) return null;
  return cleaned;
}

module.exports = {
  isRewriterEnabled,
  isPerReportLine,
  extractQuotes,
  analyzeRecruitingSignal,
  sourceOverlapRatio,
  exceedsOverlap,
  rewriteBeatUpdate,
  buildFootballPerReportFallback,
  resolveInsiderFallback,
  sanitizeRewrittenLine,
  OVERLAP_THRESHOLD,
  PER_REPORT_RE
};
