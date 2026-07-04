/**
 * Competition sourcing — real college rivals only; never high school / hometown.
 */

const COLLEGE_ALIASES = Object.freeze({
  fsu: 'Florida State',
  uga: 'Georgia',
  'ohio state': 'Ohio State',
  osu: 'Ohio State',
  bama: 'Alabama',
  lsu: 'LSU',
  miami: 'Miami',
  clemson: 'Clemson',
  auburn: 'Auburn',
  vanderbilt: 'Vanderbilt',
  vandy: 'Vanderbilt',
  tennessee: 'Tennessee',
  texas: 'Texas',
  texasam: 'Texas A&M',
  'texas a&m': 'Texas A&M'
});

const HIGH_SCHOOL_RE =
  /\b(high school|academy|prep|charter|christian school|devils|raiders|tigers|bulldogs|wildcats|eagles|panthers|knights|mustangs|warriors|hornets|cougars|patriots|trojans|lions|bears|wolverines|seminoles|gators)\b/i;

const REGION_RE =
  /\b(corridor|pipeline|in-state|in state|local gravity|hometown|metro|region)\b/i;

const KNOWN_COLLEGE_PATTERN =
  /\b(florida state|fsu|georgia|uga|alabama|auburn|vanderbilt|vandy|lsu|tennessee|clemson|miami|ohio state|texas|texas a&m|notre dame|penn state|michigan|usc|ucla|oregon|oklahoma|arkansas|mississippi state|ole miss|south carolina|kentucky|missouri|wisconsin|iowa|nebraska|duke|north carolina|nc state|virginia|virginia tech|pittsburgh|syracuse|boston college|louisville|baylor|tcu|oklahoma state|kansas state|west virginia|memphis|ucf|usf)\b/i;

function normalizeSchoolName(raw) {
  const key = String(raw || '')
    .trim()
    .toLowerCase();
  if (!key) return null;
  return COLLEGE_ALIASES[key] || String(raw).trim();
}

function isBlockedSchool(name, ctx = {}) {
  const n = String(name || '').trim();
  if (!n) return true;
  const lower = n.toLowerCase();
  const player = ctx.player || {};
  const block = [
    player.school,
    player.highSchool,
    player.hometownCity,
    player.hometownState,
    player.state,
    ctx.identity?.school
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());

  for (const b of block) {
    if (lower === b || lower.includes(b) || b.includes(lower)) return true;
  }
  if (HIGH_SCHOOL_RE.test(n) && !/\b(university|college)\b/i.test(n)) return true;
  if (REGION_RE.test(n)) return true;
  if (/^\d/.test(n)) return true;
  return false;
}

function isValidCollege(name, ctx = {}) {
  if (!name || isBlockedSchool(name, ctx)) return false;
  const n = String(name).trim();
  if (n.length < 2) return false;
  if (/^(florida|gators|uf)$/i.test(n)) return false;
  if (KNOWN_COLLEGE_PATTERN.test(n)) return true;
  if (/\b(university|college)\b/i.test(n)) return true;
  return false;
}

function schoolsFromBeat(beatText = '') {
  const beat = String(beatText);
  const found = new Set();
  let m;
  const re = new RegExp(KNOWN_COLLEGE_PATTERN.source, 'gi');
  while ((m = re.exec(beat)) !== null) {
    const norm = normalizeSchoolName(m[0]);
    if (norm) found.add(norm);
  }
  return [...found].filter((s) => !/^florida$/i.test(s));
}

function schoolsFromVisits(visits = []) {
  const out = [];
  for (const v of visits) {
    const school = v.school || v.visitSchool || v.host;
    if (school && !/^florida|gators|uf$/i.test(String(school))) {
      out.push(normalizeSchoolName(school) || school);
    }
  }
  return out;
}

function schoolsFromOffers(offers = []) {
  const out = [];
  for (const o of offers) {
    const school = typeof o === 'string' ? o : o?.school || o?.schoolName;
    if (school) out.push(normalizeSchoolName(school) || school);
  }
  return out;
}

function rpmTopFromSources(metrics = {}, intel = null) {
  if (Array.isArray(metrics.rpmTop) && metrics.rpmTop.length) {
    return metrics.rpmTop
      .map((row) => ({
        school: normalizeSchoolName(row.school || row.name) || row.school,
        pct: row.pct != null ? Number(row.pct) : null
      }))
      .filter((r) => r.school);
  }
  if (Array.isArray(intel?.rpmTop) && intel.rpmTop.length) return intel.rpmTop;
  const competitors = intel?.competitors || [];
  return competitors
    .filter((c) => c?.school && (c.score != null || c.pct != null || c.ufPct != null))
    .map((c) => ({
      school: c.school,
      pct: c.pct ?? c.score ?? c.ufPct ?? null
    }));
}

function resolveValidCompSchools(ctx = {}) {
  const player = ctx.player || ctx.intel?.identity || {};
  const beatText = ctx.beatText || '';
  const metrics = ctx.metrics || {};
  const intel = ctx.intel || null;
  const filterCtx = { player, identity: intel?.identity };

  const candidates = [];
  const push = (school, source) => {
    const norm = normalizeSchoolName(school) || school;
    if (!norm || !isValidCollege(norm, filterCtx)) return;
    candidates.push({ school: norm, source });
  };

  for (const row of rpmTopFromSources(metrics, intel)) push(row.school, 'rpm');
  for (const s of metrics.compSchools || []) push(s, 'metrics');
  for (const s of schoolsFromBeat(beatText)) push(s, 'beat');
  for (const s of schoolsFromOffers(intel?.offers || metrics.offers || [])) push(s, 'offers');
  for (const s of schoolsFromVisits(intel?.visits || metrics.visits || [])) push(s, 'visits');

  const seen = new Set();
  const schools = [];
  for (const c of candidates) {
    const key = c.school.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    schools.push(c.school);
  }

  const rpmTop = rpmTopFromSources(metrics, intel)
    .filter((r) => isValidCollege(r.school, filterCtx))
    .slice(0, 4);

  return { schools: schools.slice(0, 4), rpmTop, rejected: candidates.length - schools.length };
}

function compLabel(compSchools = []) {
  if (!compSchools.length) return null;
  if (compSchools.length >= 2) return `${compSchools[0]} and ${compSchools[1]}`;
  return compSchools[0];
}

module.exports = {
  normalizeSchoolName,
  isValidCollege,
  isBlockedSchool,
  resolveValidCompSchools,
  schoolsFromBeat,
  rpmTopFromSources,
  compLabel,
  HIGH_SCHOOL_RE
};
