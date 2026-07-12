const { fetchText } = require('./qa/qa-utils');
const { slugify } = require('./slug');

const SITE = process.env.ON3_SITE_BASE || 'https://www.on3.com';
const ORG = process.env.ON3_ORG_SLUG || 'florida-gators';
const SPORT = process.env.ON3_SPORT || 'football';

const COMMIT_STATUSES = new Set(['Committed', 'Enrolled', 'Signed']);
const UF_MATCH = /florida|\bgators\b|\buf\b/i;

function nameFromSlug(recruitSlug) {
  const base = String(recruitSlug || '').replace(/-\d+$/, '');
  if (!base) return recruitSlug;
  return base
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function pageUrl(path) {
  return `${SITE}${path.startsWith('/') ? path : `/${path}`}`;
}

function defaultHeaders(classYear) {
  return {
    Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent':
      process.env.ON3_USER_AGENT ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Referer: pageUrl(`/college/${ORG}/${SPORT}/${classYear || 2027}/commits/`)
  };
}

async function fetchNextPageProps(url, classYear) {
  const retries = Math.max(0, parseInt(process.env.ON3_FETCH_RETRIES || '3', 10) || 3);
  const { text: html } = await fetchText(url, {
    headers: defaultHeaders(classYear),
    retries,
    timeout: parseInt(process.env.ON3_FETCH_TIMEOUT_MS || '45000', 10) || 45000,
  });
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('On3 page missing __NEXT_DATA__');
  return JSON.parse(match[1])?.props?.pageProps || null;
}

function flattenVisits(pageProps) {
  const days = pageProps?.visitsList?.list?.list || pageProps?.visitsList?.list || [];
  const out = [];
  for (const day of days) {
    for (const v of day.list || []) {
      if (!v?.player?.slug) continue;
      out.push({
        player: v.player,
        official: v.official,
        visitDate: day.relatedModel?.date,
        visitStatus: day.relatedModel?.status
      });
    }
  }
  return out;
}

async function fetchTeamVisits(classYear) {
  const year = parseInt(classYear, 10);
  const url = pageUrl(`/college/${ORG}/${SPORT}/${year}/visits/`);
  const pp = await fetchNextPageProps(url, year);
  return flattenVisits(pp);
}

function stateFromHighSchoolSlug(slug) {
  const parts = String(slug || '')
    .split('-')
    .filter(Boolean);
  const last = parts[parts.length - 1];
  return /^[a-z]{2}$/i.test(last) ? last.toUpperCase() : null;
}

function cityStateFromHighSchoolSlug(slug) {
  const parts = String(slug || '')
    .split('-')
    .filter(Boolean);
  if (parts.length < 2) return null;
  const statePart = parts[parts.length - 1];
  if (!/^[a-z]{2}$/i.test(statePart)) return null;
  const citySlug = parts[parts.length - 2];
  if (!citySlug) return null;
  const city = citySlug.charAt(0).toUpperCase() + citySlug.slice(1);
  return `${city}, ${statePart.toUpperCase()}`;
}

function schoolLabelFromOn3(profile) {
  const name = profile?.school;
  if (!name) return null;
  if (/\([^)]+\)/.test(name)) return name;
  const cityState =
    cityStateFromHighSchoolSlug(profile?.highSchoolSlug) ||
    (profile?.hometownCity && profile?.state ? `${profile.hometownCity}, ${profile.state}` : null);
  return cityState ? `${name} (${cityState})` : name;
}

function parseOn3NilValue(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.round(raw);
  if (typeof raw === 'object') {
    const total = Number(raw.totalValue ?? raw.value ?? 0);
    if (Number.isFinite(total) && total > 0) return Math.round(total);
  }
  return null;
}

/** On3 stores height as "5-10.5" (string) and weight as lbs (number). */
function formatHtWt(height, weight) {
  const h = height != null ? String(height).trim() : '';
  const w = weight != null && weight !== '' ? Number(weight) : NaN;
  if (h && Number.isFinite(w) && w > 0) return `${h} / ${Math.round(w)}`;
  if (h) return h;
  if (Number.isFinite(w) && w > 0) return String(Math.round(w));
  return '';
}

function extractHtWtFromOn3Player(player, recruitment = null) {
  const height =
    player?.height ??
    recruitment?.height ??
    player?.measurables?.height ??
    null;
  const weight =
    player?.weight ??
    recruitment?.weight ??
    player?.measurables?.weight ??
    null;
  const htWt = formatHtWt(height, weight);
  return {
    height: height != null && String(height).trim() ? String(height).trim() : null,
    weight: weight != null && Number.isFinite(Number(weight)) ? Math.round(Number(weight)) : null,
    htWt: htWt || null,
  };
}

async function fetchRecruitProfile(recruitSlug, classYear = 2027) {
  if (!recruitSlug) return null;
  const year = parseInt(classYear, 10) || 2027;
  const url = pageUrl(`/rivals/${recruitSlug.replace(/^\//, '')}/`);
  let pp;
  try {
    pp = await fetchNextPageProps(url, year);
  } catch (e) {
    return { slug: recruitSlug, error: e.message };
  }
  if (!pp) return null;

  const recruitment =
    (pp.recruitments || []).find((r) => Number(r.year) === year) ||
    (pp.recruitments || []).find((r) => r.year === 2028 || r.year === 2027 || r.year === 2026) ||
    (pp.recruitments || [])[0];
  const rp = pp.rankingsPlayer || {};
  const recruitmentRating = recruitment?.rating || {};
  const topTeamsRaw = pp.topTeams?.list || pp.topTeams || [];
  const classYearResolved = recruitment?.year || year;
  const topTeamForYear =
    topTeamsRaw.find((t) => Number(t.year) === Number(classYearResolved)) || topTeamsRaw[0];

  const highSchool = pp.player?.highSchool || null;
  const schoolName =
    highSchool?.name || pp.player?.highSchoolName || recruitment?.highSchool?.name || null;
  const state =
    pp.player?.homeTown?.stateAbbr ||
    pp.player?.hometown?.stateAbbr ||
    pp.player?.hometown?.state?.abbreviation ||
    pp.player?.homeTown?.state?.abbreviation ||
    (typeof pp.player?.hometownState === 'string' ? pp.player.hometownState : null) ||
    pp.player?.hometownState?.abbreviation ||
    rp.stateAbbr ||
    stateFromHighSchoolSlug(highSchool?.slug) ||
    null;
  const hometownCity =
    pp.player?.homeTown?.city ||
    pp.player?.hometown?.city ||
    (typeof pp.player?.hometownName === 'string'
      ? String(pp.player.hometownName).split(',')[0].trim()
      : null) ||
    null;
  const { height, weight, htWt } = extractHtWtFromOn3Player(pp.player, recruitment);

  const stars =
    rp.consensusStars ??
    rp.stars ??
    recruitmentRating.stars ??
    recruitmentRating.consensusStars ??
    null;
  const natlRank =
    rp.consensusOverallRank ??
    rp.overallRank ??
    rp.consensusNationalRank ??
    rp.nationalRank ??
    recruitmentRating.consensusOverallRank ??
    recruitmentRating.nationalRank ??
    null;
  const posRank =
    rp.consensusPositionRank ??
    rp.positionRank ??
    recruitmentRating.consensusPositionRank ??
    recruitmentRating.positionRank ??
    null;
  const stateRank =
    rp.consensusStateRank ??
    rp.stateRank ??
    recruitmentRating.consensusStateRank ??
    recruitmentRating.stateRank ??
    null;
  const rating =
    rp.consensusRating ??
    rp.rating ??
    recruitmentRating.consensusRating ??
    recruitmentRating.rating ??
    null;

  return {
    slug: recruitSlug,
    name: pp.player?.fullName || nameFromSlug(recruitSlug) || recruitSlug,
    pos: String(
      rp.positionAbbr ||
        pp.player?.positionAbbr ||
        recruitment?.positionAbbreviation ||
        recruitmentRating?.positionAbbr ||
        recruitmentRating?.position?.abbr ||
        topTeamForYear?.positionAbbreviation ||
        pp.personSports?.[0]?.position?.abbr ||
        ''
    )
      .trim()
      .toUpperCase(),
    classYear: classYearResolved,
    school: schoolName,
    highSchoolSlug: highSchool?.slug || null,
    state: state ? String(state).toUpperCase() : null,
    hometownCity,
    height,
    weight,
    htWt,
    stars,
    rating,
    natlRank,
    posRank,
    stateRank,
    rankingsPlayer: rp,
    topTeams: pp.topTeams?.list || [],
    visits: pp.visits?.list || pp.visits || [],
    recruitments: pp.recruitments || [],
    nilValue: parseOn3NilValue(pp.player?.nilValue ?? pp.nilValue),
    on3ProfileUrl: pageUrl(`/rivals/${recruitSlug.replace(/^\//, '')}/`),
    fetchedAt: new Date().toISOString()
  };
}

function isHighSchoolOrg(team) {
  const name = (team?.fullName || team?.name || '').toLowerCase();
  const slug = (team?.slug || '').toLowerCase();
  if (/high school| academy| prep school/.test(name)) return true;
  if (/falcons|raiders|tigers/.test(slug) && !/(ole-miss|clemson|auburn|memphis)/.test(slug)) {
    if (!/(gators|bulldogs|seminoles|sooners|rebels|volunteers|crimson|longhorns|buckeyes)/.test(slug)) {
      return name.split(' ').length <= 3 && !team?.abbreviation?.match(/^[A-Z]{2,5}$/);
    }
  }
  return false;
}

function getYearTopTeams(topTeams, classYear) {
  return (topTeams || []).filter((t) => !t.year || t.year === classYear);
}

function getCollegeCommit(topTeams, classYear) {
  return getYearTopTeams(topTeams, classYear).find((t) => {
    if (!COMMIT_STATUSES.has(t.status)) return false;
    if (t.committedDate) return true;
    const slug = (t.team?.slug || '').toLowerCase();
    return /-(gators|bulldogs|tigers|sooners|rebels|seminoles|volunteers|longhorns|buckeyes|crimson-tide|gamecocks|hurricanes|cowboys|razorbacks|wildcats|commodores|panthers|tar-heels|orange|fighting-irish|trojans|bruins|ducks|huskies|badgers|spartans|wolverines|hoosiers|boilermakers|yellow-jackets|hokies|blue-devils|bearcats|cougars|horned-frogs|cyclones|jayhawks|aggies|black-knights|cardinal|sun-devils|buffaloes|mean-green|roadrunners|miners|razorbacks)/.test(
      slug
    );
  });
}

function getFloridaTeam(topTeams, classYear) {
  return getYearTopTeams(topTeams, classYear).find((t) => UF_MATCH.test(t.team?.name || t.team?.fullName || ''));
}

function isFloridaTeam(team) {
  return UF_MATCH.test(team?.team?.name || team?.team?.fullName || '');
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}

function resolveRecruitSlug(player, visitsByName) {
  if (player.on3RecruitSlug) return player.on3RecruitSlug;
  if (player.on3Id) return `${slugify(player.name)}-${player.on3Id}`;
  const key = String(player.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return visitsByName.get(key) || null;
}

module.exports = {
  SITE,
  ORG,
  SPORT,
  COMMIT_STATUSES,
  UF_MATCH,
  fetchTeamVisits,
  fetchRecruitProfile,
  fetchNextPageProps,
  flattenVisits,
  getCollegeCommit,
  getFloridaTeam,
  getYearTopTeams,
  isFloridaTeam,
  isHighSchoolOrg,
  mapPool,
  parseOn3NilValue,
  formatHtWt,
  extractHtWtFromOn3Player,
  resolveRecruitSlug,
  slugify,
  stateFromHighSchoolSlug,
  cityStateFromHighSchoolSlug,
  schoolLabelFromOn3,
};
