/**
 * Basic competitor school extraction from beat tweet / intel text.
 * Phase 0 — keyword patterns for major programs, not ML.
 */
const FLORIDA_RES = /\b(florida|gators|\buf\b|gainesville|the swamp)\b/i;

/** Canonical program name + match patterns (order = priority for primary competitor). */
const COMPETITOR_PROGRAMS = [
  { name: 'Georgia', patterns: [/\bgeorgia\b/i, /\buga\b/i, /\bbulldogs?\b/i] },
  { name: 'Alabama', patterns: [/\balabama\b/i, /\bcrimson tide\b/i] },
  { name: 'Florida State', patterns: [/\bflorida state\b/i, /\bfsu\b/i, /\bseminoles?\b/i] },
  { name: 'LSU', patterns: [/\blsu\b/i, /\blouisiana state\b/i] },
  { name: 'Tennessee', patterns: [/\btennessee\b/i, /\bvolunteers?\b/i, /\bvols\b/i] },
  { name: 'Ohio State', patterns: [/\bohio state\b/i, /\bbuckeyes?\b/i] },
  { name: 'Texas', patterns: [/\btexas longhorns\b/i, /\bcommitted to texas\b/i, /\bto texas\b/i, /\bwith texas\b/i] },
  { name: 'Texas A&M', patterns: [/\btexas a&m\b/i, /\btexas am\b/i, /\baggies?\b/i] },
  { name: 'Auburn', patterns: [/\bauburn\b/i, /\btigers?\b/i] },
  { name: 'Miami', patterns: [/\bmiami hurricanes\b/i, /\bthe canes\b/i, /\bcanes\b/i, /\bto miami\b/i, /\bwith miami\b/i] },
  { name: 'Clemson', patterns: [/\bclemson\b/i] },
  { name: 'Oklahoma', patterns: [/\boklahoma\b/i, /\bsooners?\b/i] },
  { name: 'Ole Miss', patterns: [/\bole miss\b/i, /\brebels?\b/i] },
  { name: 'Michigan', patterns: [/\bmichigan\b/i, /\bwolverines?\b/i] },
  { name: 'Notre Dame', patterns: [/\bnotre dame\b/i, /\bfighting irish\b/i] },
  { name: 'Penn State', patterns: [/\bpenn state\b/i, /\bnittany lions?\b/i] },
  { name: 'USC', patterns: [/\busc\b/i, /\bsouthern california\b/i] },
  { name: 'Oregon', patterns: [/\boregon\b/i, /\bducks?\b/i] },
  { name: 'Mississippi State', patterns: [/\bmississippi state\b/i] },
  { name: 'South Carolina', patterns: [/\bsouth carolina\b/i, /\bgamecocks?\b/i] },
  { name: 'Texas Tech', patterns: [/\btexas tech\b/i, /\bred raiders?\b/i] },
];

function isFloridaMention(text) {
  return FLORIDA_RES.test(String(text || ''));
}

function normalizeCompetitorName(name) {
  return String(name || '').trim();
}

/**
 * Extract competitor schools mentioned in beat/intel text.
 * @returns {{ competitorSchool: string|null, competitorMentions: string[] }}
 */
function extractCompetitorsFromText(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length < 4) {
    return { competitorSchool: null, competitorMentions: [] };
  }

  const mentions = [];
  const seen = new Set();

  for (const prog of COMPETITOR_PROGRAMS) {
    if (!prog.patterns.some((re) => re.test(t))) continue;
    const key = prog.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    mentions.push(normalizeCompetitorName(prog.name));
  }

  return {
    competitorSchool: mentions[0] || null,
    competitorMentions: mentions,
  };
}

/**
 * Merge competitor fields onto an intel row before save.
 */
function enrichIntelCompetitors(intelFields) {
  if (!intelFields || typeof intelFields !== 'object') return intelFields;

  const text = [intelFields.detail, intelFields.text, intelFields.nextVisitSchool]
    .filter(Boolean)
    .join(' ');

  const { competitorSchool, competitorMentions } = extractCompetitorsFromText(text);
  if (!competitorSchool && !competitorMentions.length) return intelFields;

  const out = { ...intelFields };
  if (competitorSchool && !out.competitorSchool) {
    out.competitorSchool = competitorSchool;
  }
  if (competitorMentions.length) {
    const merged = [...(Array.isArray(out.competitorMentions) ? out.competitorMentions : [])];
    for (const name of competitorMentions) {
      if (!merged.some((m) => String(m).toLowerCase() === name.toLowerCase())) {
        merged.push(name);
      }
    }
    out.competitorMentions = merged;
  }
  return out;
}

module.exports = {
  extractCompetitorsFromText,
  enrichIntelCompetitors,
  isFloridaMention,
  COMPETITOR_PROGRAMS,
};
