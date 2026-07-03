/**
 * Paraphrase beat/intel text — restate verified facts only (v1.1.1).
 * Uses quote rewriter when enabled; never invents schools, dates, or percentages.
 */
const template = require('../x-autoposter-template');
const quoteRewriter = require('../x-autoposter-recruiting-quote-rewriter');

function stripUrls(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstFactualSentence(text, maxLen = 200) {
  const sentences = template.extractSentences(stripUrls(text));
  for (const s of sentences) {
    const clean = template.sanitizeCopyLine(s, maxLen, { sport: 'football' });
    if (clean && clean.length >= 24 && !template.HEADLINE_ONLY_RE.test(clean)) return clean;
  }
  const flat = stripUrls(text).slice(0, maxLen).trim();
  return flat.length >= 20 ? flat : null;
}

/**
 * Paraphrase event description for INTEL line.
 */
function paraphraseIntel(signal, { sourceLabel = 'Beat writer' } = {}) {
  const raw = signal?.event?.description || signal?.beatText || '';
  if (!raw) return null;

  if (quoteRewriter.isRewriterEnabled()) {
    const rewritten = quoteRewriter.rewriteBeatUpdate({
      beatText: raw,
      sourceLabel: signal?.event?.source || sourceLabel,
      postKind: signal?.type === 'recruiting' ? 'recruiting' : 'news',
      sport: 'football'
    });
    if (rewritten?.ok && rewritten.contextLine) {
      const line = quoteRewriter.sanitizeRewrittenLine(rewritten.contextLine, raw, 200);
      if (line && !quoteRewriter.exceedsOverlap(line, raw)) return line.endsWith('.') ? line : `${line}.`;
    }
  }

  const fallback = firstFactualSentence(raw, 200);
  if (!fallback) return null;
  return fallback.endsWith('.') ? fallback : `${fallback}.`;
}

function positionalNeedPhrase(signal) {
  const pos = String(signal?.player?.pos || '').toUpperCase();
  const year = signal?.player?.classYear;
  const map = {
    CB: 'secondary depth',
    WR: 'speed on the perimeter',
    DL: 'trench depth',
    OT: 'tackle depth',
    QB: 'quarterback room',
    RB: 'backfield depth',
    LB: 'linebacker corps',
    TE: 'tight end room'
  };
  const need = map[pos] || 'board priority';
  if (year) return `This fits Florida's ${need} focus in the ${year} class.`;
  return `This fits Florida's ${need} in this cycle.`;
}

function paraphraseUFContext(signal) {
  const type = signal?.type || 'recruiting';
  const beat = String(signal?.beatText || signal?.event?.description || '').toLowerCase();

  if (type === 'portal') {
    return 'Trenches and snap distribution remain the highest-variance piece entering camp.';
  }
  if (type === 'roster') {
    const pos = signal?.player?.pos || 'the position group';
    return `Two-deep movement at ${pos} is still fluid for Florida.`;
  }
  if (type === 'opponent') {
    if (/\bquick|tempo|pass\b/.test(beat)) {
      return "Florida's quick-game packages should be live early in this matchup.";
    }
    return 'Florida can stress this front with tempo and spacing in the early install window.';
  }

  if (/\bdecision day\b|\bannouncement\b/.test(beat)) {
    return 'Florida is in the decision window — board priority is real for this spot.';
  }
  if (/\brpm\b|\bprediction\b|\bfuturecast\b/.test(beat)) {
    return 'UF remains in the RPM mix — this pick carries weight with decision timing in play.';
  }
  if (/\bvisit\b|\bcampus\b|\bgainesville\b|\bov\b|\bfnl\b|friday night lights/.test(beat)) {
    return 'Gainesville activity matters here — visit timing tracks with UF board momentum.';
  }

  return positionalNeedPhrase(signal);
}

function paraphraseRPM(rpm) {
  const n = Math.round(Number(rpm) * 10) / 10;
  if (!Number.isFinite(n) || n <= 0) return null;
  return `UF leads On3 RPM at ${n}% — board math backs the momentum.`;
}

function paraphraseVisit(visitDate) {
  const d = String(visitDate || '').trim();
  if (!d) return null;
  const label = d.length >= 10 ? d.slice(0, 10) : d;
  return `Visit window on ${label} carries real weight in this race.`;
}

function paraphraseCompetition(schools) {
  const list = (schools || []).filter(Boolean).slice(0, 3);
  if (!list.length) return null;
  if (list.length === 1) return `Competing with ${list[0]} for this role — UF is in the mix.`;
  return `Competing with ${list.slice(0, -1).join(', ')} and ${list[list.length - 1]} — UF holds a live lane.`;
}

function paraphraseDepth(note) {
  const t = String(note || '').trim();
  if (!t || t.length < 12) return null;
  const clean = template.sanitizeCopyLine(t, 140, { sport: 'football' });
  return clean ? (clean.endsWith('.') ? clean : `${clean}.`) : null;
}

function paraphraseSchemeNote(note) {
  const t = String(note || '').trim();
  if (!t || t.length < 12) return null;
  const clean = template.sanitizeCopyLine(t, 140, { sport: 'football' });
  return clean ? (clean.endsWith('.') ? clean : `${clean}.`) : null;
}

class StrategyDataMissing extends Error {
  constructor() {
    super('strategy_data_missing');
    this.code = 'strategy_data_missing';
  }
}

function buildStrategyLine(signal) {
  const m = signal?.metrics || {};
  if (m.rpm != null && Number(m.rpm) > 0) {
    const line = paraphraseRPM(m.rpm);
    if (line) return line;
  }
  if (m.visitDate) {
    const line = paraphraseVisit(m.visitDate);
    if (line) return line;
  }
  if (m.compSchools?.length) {
    const line = paraphraseCompetition(m.compSchools);
    if (line) return line;
  }
  if (m.depthChartNote) {
    const line = paraphraseDepth(m.depthChartNote);
    if (line) return line;
  }
  if (m.schemeNote) {
    const line = paraphraseSchemeNote(m.schemeNote);
    if (line) return line;
  }
  throw new StrategyDataMissing();
}

module.exports = {
  StrategyDataMissing,
  paraphraseIntel,
  paraphraseUFContext,
  buildStrategyLine,
  paraphraseRPM,
  paraphraseVisit,
  paraphraseCompetition,
  paraphraseDepth,
  firstFactualSentence
};
