/**
 * Learns abstract posting patterns from UF beat-writer X timelines.
 * Stores structure and cadence only — never reuses verbatim beat text in output.
 */
const template = require('../x-autoposter-template');

const RECRUITING_RE =
  /\b(20(?:2[6-9]|3[0-2])|commit|decommit|flip|portal|visit|offer|rpm|recruit|swamp|gainesville|official|unofficial|\bov\b|\buv\b|fnl|friday night lights|crystal ball|futurecast)\b/i;

const HYPE_RE = /\b(breaking|omg|huge|massive|insane|crazy|!!!|locked in|done deal)\b/i;

/** Seed shapes — authored examples, not copied from live posts. Used when X cache is empty. */
const SEED_POSTS = [
  { handle: 'Corey_Bender', text: '2028 DL Marcus Lee (IMG Academy) was in The Swamp on Saturday. UF coaches spent extended time with him during FNL.' },
  { handle: 'ZachAbolverdi', text: 'Florida is firmly in the mix for 2027 QB Jayden Cole out of Miami Central. Staff has been on him for months.' },
  { handle: 'ttjharden8', text: '2026 WR Devin Hart took an unofficial visit to Gainesville this weekend. Gators are pushing hard in his recruitment.' },
  { handle: 'Corey_Bender', text: 'BREAKING: 2026 OT Ryan Moss commits to Florida.' },
  { handle: 'Hayesfawcett3', text: '2027 CB Jordan Wells picks up an offer from UF. The Gators like his length and ball skills.' },
  { handle: 'KeithNiebuhr', text: 'Sumrall and staff had a long sit-down with 2028 TE Chris Allen during his OV. Real momentum building behind the scenes.' },
  { handle: 'Blake_Alderman', text: '2028 LB Sam Porter (Oak Hill) plans a return trip to The Swamp this month. Florida sits in a good spot.' },
  { handle: 'Andrew_Ivins', text: 'Crystal Ball update: Florida now at 72% for 2027 DL Nate Brooks. Competition from Georgia and Miami remains.' },
  { handle: 'GatorsOnline', text: '2028 QB Tyler Dunn was on campus for Friday Night Lights. Position coaches got quality face time with the Trinity Christian prospect.' },
  { handle: 'NickdelatorreGC', text: 'Gators recruiting notebook: UF hosted a handful of 2028 targets this week with FNL serving as the main event.' },
  { handle: 'ThomasGoldkamp', text: '2027 ATH Leo Grant received a Gators offer after camp. Scheme fit is there — watch for a campus visit next.' },
  { handle: 'EJHollandOn3', text: '2028 DL Tory Clark (Woodward Academy) logged time in Gainesville. Connections with the staff are growing.' }
];

function countWords(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function stripForAnalysis(text) {
  return template
    .stripEmojisHashtags(String(text || ''))
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function firstName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return parts[0] || 'Target';
}

function isRecruitingPost(text) {
  const t = stripForAnalysis(text);
  if (!t || t.length < 24) return false;
  if (HYPE_RE.test(t) && !/\bcommit/i.test(t)) return false;
  return RECRUITING_RE.test(t);
}

function analyzePost(text) {
  const clean = stripForAnalysis(text);
  const sentences = splitSentences(clean);
  const words = countWords(clean);
  const first = sentences[0] || clean;
  return {
    wordCount: words,
    sentenceCount: sentences.length,
    avgSentenceWords: words / Math.max(1, sentences.length),
    startsWithYear: /^20(?:2[6-9]|3[0-2])\b/.test(first),
    startsWithName: /^[A-Z][a-z]+\s[A-Z][a-z]+/.test(first),
    startsWithFlorida: /^(UF|Florida|Gators)\b/i.test(first),
    startsWithCrystalBall: /^crystal ball/i.test(first),
    hasEmDash: /—/.test(clean),
    hasColonLead: /^[^:]{1,48}:/.test(first),
    mentionsCampus: /\b(campus|swamp|gainesville|fnl|friday night lights)\b/i.test(clean),
    mentionsStaff: /\b(staff|coaches|sumrall|position coach)\b/i.test(clean),
    mentionsMomentum: /\b(momentum|trending|push|priority|behind the scenes|in the mix)\b/i.test(clean),
    mentionsCompetition: /\b(competition|also involved|georgia|miami|alabama|lsu|texas|ohio state)\b/i.test(clean),
    hasPercent: /\b\d{1,3}%\b/.test(clean),
    hasRank: /\b#\d+\b|\btop\s+\d+\b|\bno\.\s*\d+\b/i.test(clean),
    hasSchoolParen: /\([A-Za-z0-9 .'-]+(?:Academy|High School|HS|Prep)\)/.test(clean),
    isDeclarative: !/\?/.test(clean),
    recruitingRelevant: isRecruitingPost(clean)
  };
}

function pctTrue(rows, key) {
  if (!rows.length) return 0;
  return rows.filter((r) => r[key]).length / rows.length;
}

function analyzeCorpus(posts = []) {
  const recruiting = (posts || [])
    .map((p) => ({
      handle: p.handle || p.writerName || 'unknown',
      text: p.text || p.summary || ''
    }))
    .filter((p) => isRecruitingPost(p.text));

  const rows = recruiting.map((p) => analyzePost(p.text));
  if (!rows.length) {
    return analyzeCorpus(SEED_POSTS);
  }

  const wordCounts = rows.map((r) => r.wordCount);
  const avgWords = wordCounts.reduce((a, b) => a + b, 0) / rows.length;

  return {
    sampleSize: rows.length,
    writersSampled: [...new Set(recruiting.map((p) => p.handle))].slice(0, 12),
    aggregate: {
      avgWords: Math.round(avgWords),
      avgSentenceWords: Math.round(
        rows.reduce((a, r) => a + r.avgSentenceWords, 0) / rows.length
      ),
      pctStartsWithYear: pctTrue(rows, 'startsWithYear'),
      pctStartsWithName: pctTrue(rows, 'startsWithName'),
      pctStartsWithFlorida: pctTrue(rows, 'startsWithFlorida'),
      pctHasEmDash: pctTrue(rows, 'hasEmDash'),
      pctMentionsCampus: pctTrue(rows, 'mentionsCampus'),
      pctMentionsStaff: pctTrue(rows, 'mentionsStaff'),
      pctMentionsMomentum: pctTrue(rows, 'mentionsMomentum'),
      pctMentionsCompetition: pctTrue(rows, 'mentionsCompetition'),
      pctHasPercent: pctTrue(rows, 'hasPercent'),
      pctHasSchoolParen: pctTrue(rows, 'hasSchoolParen'),
      pctDeclarative: pctTrue(rows, 'isDeclarative')
    },
    source: 'analyzed'
  };
}

function getStyleHints(corpus = {}, { eventType = null, situation = null } = {}) {
  const agg = corpus.aggregate || analyzeCorpus(SEED_POSTS).aggregate;
  const et = String(eventType || '').toLowerCase();
  const visit =
    et.includes('visit') ||
    situation === 'visit' ||
    /campus|swamp|fnl|gainesville/i.test(String(situation || ''));

  return {
    leadWithYearFirst: agg.pctStartsWithYear >= 0.28,
    leadWithFlorida: agg.pctStartsWithFlorida >= 0.18,
    preferCampusLanguage: visit || agg.pctMentionsCampus >= 0.3,
    preferStaffFrame: agg.pctMentionsStaff >= 0.22,
    preferMomentumClose: agg.pctMentionsMomentum >= 0.25,
    preferCompetitionNote: agg.pctMentionsCompetition >= 0.2,
    preferEmDash: agg.pctHasEmDash >= 0.35,
    preferDeclarative: agg.pctDeclarative >= 0.85,
    targetContextWords: Math.min(32, Math.max(18, Math.round(agg.avgWords * 0.52))),
    targetInsiderWords: Math.min(28, Math.max(14, Math.round(agg.avgWords * 0.38))),
    sampleSize: corpus.sampleSize || 0,
    eventType: et,
    situation
  };
}

function joinWithDash(a, b, useDash) {
  if (!a) return b || '';
  if (!b) return a;
  return useDash ? `${a} — ${b}` : `${a} ${b}`;
}

function buildStyleContextVariants({
  hints = {},
  playerName,
  pos,
  school,
  classYear,
  eventType,
  beatText
} = {}) {
  const fn = firstName(playerName);
  const schoolTag = school ? ` (${school})` : '';
  const yr = classYear ? `${classYear} ` : '';
  const beat = String(beatText || '').toLowerCase();
  const fnl = /\bfnl\b|friday night lights/.test(beat);
  const campus = hints.preferCampusLanguage || /campus|swamp|gainesville|visit/.test(beat);
  const et = String(eventType || '').toLowerCase();
  const dash = hints.preferEmDash;
  const variants = [];

  if (campus || et.includes('visit')) {
    variants.push(
      joinWithDash(
        `${fn}${schoolTag} was on campus in Gainesville${fnl ? ' for FNL' : ''}`,
        'UF logged extended staff time.',
        dash
      )
    );
    variants.push(
      `${yr}${pos ? `${pos} ` : ''}${fn}${schoolTag} picked up another Gainesville window. Florida pushed for face time.`
    );
    if (hints.preferStaffFrame) {
      variants.push(
        joinWithDash(
          `UF coaches got a long look at ${fn}${schoolTag}${fnl ? ' during Friday Night Lights' : ''}`,
          'staff contact is picking up.',
          dash
        )
      );
    }
  }

  if (et.includes('offer')) {
    variants.push(
      joinWithDash(
        `Florida extended an offer to ${fn}${pos ? ` (${pos})` : ''}${schoolTag}`,
        'scheme fit checks out for this cycle.',
        dash
      )
    );
  }

  if (et.includes('commit') || et.includes('flip')) {
    variants.push(`${fn}${schoolTag} is trending toward Florida. Staff feels good about the fit.`);
  }

  if (hints.leadWithFlorida && !variants.length) {
    variants.push(
      joinWithDash(
        `Florida is in the mix on ${fn}${schoolTag}`,
        `${pos ? `${pos} ` : ''}target the staff is tracking.`,
        dash
      )
    );
  }

  if (hints.leadWithYearFirst && !variants.some((v) => v.startsWith(String(classYear)))) {
    variants.push(
      `${yr}${pos ? `${pos} ` : ''}${fn}${schoolTag} remains on UF's board with steady staff contact.`
    );
  }

  return variants
    .map((v) => {
      const trimmed = String(v || '').trim();
      if (!trimmed) return '';
      const withPeriod = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
      return template.sanitizeCopyLine(withPeriod, 160, { eliteMode: true });
    })
    .filter(Boolean);
}

function buildStyleInsiderVariants({
  hints = {},
  playerName,
  pos,
  school,
  eventType,
  competition = []
} = {}) {
  const fn = firstName(playerName);
  const schoolTag = school ? ` (${school})` : '';
  const et = String(eventType || '').toLowerCase();
  const variants = [];

  if (hints.preferMomentumClose) {
    variants.push('Momentum is building behind the scenes as staff contact stays active.');
    variants.push('Quiet traction here — another campus touch could move the needle.');
  }

  if (hints.preferStaffFrame) {
    variants.push('Position coaches have stayed engaged — Florida wants to stay in front.');
    variants.push(`${fn}${schoolTag}: staff confidence is growing after recent face time.`);
  }

  if (hints.preferCompetitionNote && competition.length) {
    variants.push(
      `Competition from ${competition.slice(0, 2).join(' and ')} remains, but UF is still in the picture.`
    );
  }

  if (et.includes('official')) {
    variants.push('OV fallout should clarify where Florida stands in the leader group.');
  } else if (et.includes('unofficial') || et.includes('visit')) {
    variants.push('Repeat campus time is building real momentum behind the scenes.');
  }

  if (et.includes('prediction') || et.includes('futurecast')) {
    variants.push('Watch for movement after the next staff touch or campus window.');
  }

  return variants
    .map((v) => template.sanitizeCopyLine(v, 140, { eliteMode: true }))
    .filter(Boolean);
}

function enrichVariantLists(contextVariants = [], insiderVariants = [], opts = {}) {
  const hints = opts.hints || getStyleHints(opts.corpus || {}, opts);
  const styleContext = buildStyleContextVariants({
    hints,
    playerName: opts.playerName,
    pos: opts.pos,
    school: opts.school,
    classYear: opts.classYear,
    eventType: opts.eventType,
    beatText: opts.beatText
  });
  const styleInsider = buildStyleInsiderVariants({
    hints,
    playerName: opts.playerName,
    pos: opts.pos,
    school: opts.school,
    eventType: opts.eventType,
    competition: opts.competition || []
  });

  const dedupe = (list) => {
    const seen = new Set();
    return list.filter((line) => {
      const key = template.stripEmojisHashtags(line).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  return {
    contextVariants: dedupe([...styleContext, ...contextVariants]),
    insiderVariants: dedupe([...styleInsider, ...insiderVariants]),
    hints
  };
}

function getStyleGuide(corpus = {}) {
  const agg = corpus.aggregate || analyzeCorpus(SEED_POSTS).aggregate;
  const hints = getStyleHints(corpus);
  return {
    description:
      'Derived from UF beat-writer X posts — structure and cadence only, never verbatim reuse.',
    sampleSize: corpus.sampleSize || SEED_POSTS.length,
    updatedAt: corpus.updatedAt || null,
    source: corpus.source || 'seed',
    aggregate: agg,
    writingRules: [
      hints.leadWithYearFirst
        ? 'Lead with class year + name when posting player updates (common on UF beat timelines).'
        : 'Lead with the news hook, then identity.',
      hints.preferCampusLanguage
        ? 'Name the campus window (Gainesville, FNL, Swamp) when visits are the signal.'
        : 'Keep visit language specific when the beat confirms a trip.',
      hints.preferStaffFrame
        ? 'Frame moves through staff contact and face time — not fan hype.'
        : 'Use staff/board framing over emotional visit language.',
      hints.preferMomentumClose
        ? 'Close with quiet momentum or next-step framing, not BREAKING-style hype.'
        : 'End with what changes next for Florida on the board.',
      hints.preferEmDash
        ? 'Use an em dash to separate fact from interpretation when it fits.'
        : 'Keep sentences clean and declarative.',
      'Never copy beat-writer wording — overlap guards still apply.'
    ],
    seedFallback: !corpus.sampleSize
  };
}

module.exports = {
  SEED_POSTS,
  RECRUITING_RE,
  countWords,
  stripForAnalysis,
  isRecruitingPost,
  analyzePost,
  analyzeCorpus,
  getStyleHints,
  buildStyleContextVariants,
  buildStyleInsiderVariants,
  enrichVariantLists,
  getStyleGuide,
  firstName
};
