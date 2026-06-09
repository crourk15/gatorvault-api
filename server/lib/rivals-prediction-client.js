/**
 * Rivals Prediction Machine (On3 expert-predictions) — fetch UF FutureCast picks.
 */
const fetch = require('node-fetch');

const SITE = process.env.ON3_SITE_BASE || 'https://www.on3.com';
const ORG = process.env.ON3_ORG_SLUG || 'florida-gators';
const SPORT = process.env.ON3_SPORT || 'football';
const UF_SLUG = 'florida-gators';

function pageUrl(path) {
  return `${SITE}${path.startsWith('/') ? path : `/${path}`}`;
}

function defaultHeaders(classYear) {
  return {
    Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
    'User-Agent':
      process.env.ON3_USER_AGENT ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Referer: pageUrl(`/college/${ORG}/${SPORT}/${classYear || 2027}/commits/`)
  };
}

async function fetchNextPageProps(url, classYear) {
  const res = await fetch(url, { headers: defaultHeaders(classYear), timeout: 45000 });
  const html = await res.text();
  if (!res.ok) throw new Error(`On3 HTTP ${res.status} for ${url}`);
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('On3 page missing __NEXT_DATA__');
  return JSON.parse(match[1])?.props?.pageProps || null;
}

function isFloridaPick(pick) {
  const org = pick?.organization || {};
  const slug = String(org.slug || '').toLowerCase();
  const name = String(org.fullName || org.name || '').toLowerCase();
  return slug === UF_SLUG || /florida|\bgators\b|\buf\b/.test(name);
}

function normalizePredictionRow(row, classYear, sourceLabel) {
  const pick = row?.pick || {};
  const player = row?.player || {};
  if (!pick.key || !player.name) return null;
  if (!isFloridaPick(pick)) return null;

  const rating = player.rating || {};
  const on3Id = String(player.key || player.recruitmentKey || '');
  const slug = player.slug || `${String(player.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${on3Id}`;
  const ufRpm = (player.predictions || []).find((p) =>
    /florida|\bgators\b/i.test(p.organization?.fullName || p.organization?.name || '')
  );

  return {
    pickKey: pick.key,
    playerName: player.name,
    playerSlug: slug.replace(/-\d+$/, '') || slug,
    on3Id,
    on3Slug: player.slug,
    classYear: player.classYear || classYear,
    pos: player.positionAbbreviation || rating.positionAbbr || '',
    school: player.highSchoolName || player.highSchool?.name || '',
    analystName: pick.expert?.name || 'Rivals analyst',
    analystHandle: pick.expert?.niceName || pick.expert?.twitterHandle || null,
    confidence: pick.confidence != null ? Number(pick.confidence) : null,
    expertAccuracy: pick.expertAccuracy != null ? Number(pick.expertAccuracy) : null,
    timestamp: pick.dateAdded || new Date().toISOString(),
    articleUrl: pick.articleLink || null,
    predictionSchool: pick.organization?.fullName || 'Florida Gators',
    ufRpmPct: ufRpm?.percent != null ? Math.round(ufRpm.percent * 10) / 10 : null,
    stars: rating.stars || null,
    natlRank: rating.nationalRank || null,
    source: sourceLabel,
    sourceType: 'rivals_pm',
    fingerprint: `rivals_pick_${pick.key}_${pick.dateAdded}`
  };
}

async function fetchExpertPredictions(url, classYear, sourceLabel) {
  const pp = await fetchNextPageProps(url, classYear);
  const list = pp?.predictions?.list || [];
  return list.map((row) => normalizePredictionRow(row, classYear, sourceLabel)).filter(Boolean);
}

async function fetchUfExpertPredictions(classYear) {
  const url = pageUrl(`/college/${ORG}/expert-predictions/${SPORT}/${classYear}/`);
  return fetchExpertPredictions(url, classYear, 'Rivals Prediction Machine · UF');
}

async function fetchNationalRivalsPredictions(classYear) {
  const url = pageUrl(`/rivals/expert-predictions/${SPORT}/${classYear}/`);
  const rows = await fetchExpertPredictions(url, classYear, 'Rivals Prediction Machine');
  return rows.filter((r) => isFloridaPick({ organization: { fullName: r.predictionSchool, slug: UF_SLUG } }));
}

async function fetchAllUfPredictions(classYears = [2027, 2028, 2029]) {
  const byFp = new Map();
  for (const year of classYears) {
    const [ufRows, nationalRows] = await Promise.all([
      fetchUfExpertPredictions(year).catch((e) => {
        console.warn('[rivals-pm] UF page', year, e.message);
        return [];
      }),
      fetchNationalRivalsPredictions(year).catch((e) => {
        console.warn('[rivals-pm] national page', year, e.message);
        return [];
      })
    ]);
    [...ufRows, ...nationalRows].forEach((row) => {
      if (!byFp.has(row.fingerprint)) byFp.set(row.fingerprint, row);
    });
  }
  return [...byFp.values()];
}

module.exports = {
  UF_SLUG,
  isFloridaPick,
  normalizePredictionRow,
  fetchUfExpertPredictions,
  fetchNationalRivalsPredictions,
  fetchAllUfPredictions
};
