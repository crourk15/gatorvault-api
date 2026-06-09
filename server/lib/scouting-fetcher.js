/**
 * Fetch verified human-written scouting summaries from approved outlets only.
 */
const fetch = require('node-fetch');
const analysts = require('./scouting-analysts');

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNextData(html) {
  const start = html.indexOf('__NEXT_DATA__');
  if (start === -1) return null;
  const jsonStart = html.indexOf('>', start) + 1;
  const jsonEnd = html.indexOf('</script>', jsonStart);
  if (jsonEnd <= jsonStart) return null;
  try {
    return JSON.parse(html.slice(jsonStart, jsonEnd));
  } catch {
    return null;
  }
}

function detectAnalystInText(text, pool) {
  const t = String(text || '');
  if (analysts.isBlockedAuthor(t)) return null;
  for (const a of pool) {
    const nameRe = a.name.replace(/\./g, '\\.').replace(/\s+/g, '\\s+');
    const aliasPart = a.aliases.map((x) => x.replace(/\./g, '\\.')).join('|');
    const re = new RegExp(`\\b(?:${nameRe}|${aliasPart})\\b`, 'i');
    if (re.test(t)) return a.name;
  }
  return null;
}

function extractScoutingBlock(html, pool) {
  const text = stripHtml(html);
  const idx = text.search(/Scouting Summary|Scouting Report|Player Evaluation|Evaluation|NFL Comparison/i);
  if (idx === -1) return null;

  const window = text.slice(Math.max(0, idx - 200), idx + 10000);
  const analystName = detectAnalystInText(window, pool);
  if (!analystName) return null;

  let body = text.slice(idx).replace(/^(Scouting Summary|Scouting Report|Player Evaluation|Evaluation|NFL Comparison)\s*/i, '').trim();
  body = body.replace(/^[\d/]+\s*/, '');
  body = body.replace(new RegExp(`^${analystName.replace(/\./g, '\\.')}\\s*`, 'i'), '');
  const stop = body.search(
    /\b(Read More|Latest News|Athlete-Only|Rivals Verified|Featured Film|Personal Life|Gallery ·|COMMITTED|Recent Articles|Subscribe|Timeline|Videos|Related Stories|More Stories|Grade:|Overall Grade)\b/i
  );
  if (stop > 60) body = body.slice(0, stop).trim();
  if (analysts.looksLikeAiSummary(body)) return null;

  return { analystName, scoutingSummary: body };
}

function walkNextForScouting(node, pool, hits = [], depth = 0) {
  if (!node || depth > 16) return hits;
  if (typeof node === 'string') return hits;
  if (Array.isArray(node)) {
    node.forEach((v) => walkNextForScouting(v, pool, hits, depth + 1));
    return hits;
  }
  if (typeof node !== 'object') return hits;

  const author =
    node.author ||
    node.analyst ||
    node.analystName ||
    node.writer ||
    node.byline ||
    node.scout ||
    null;
  const summary =
    node.scoutingSummary ||
    node.scouting_summary ||
    node.evaluation ||
    node.scoutingReport ||
    node.scouting_report ||
    node.report ||
    node.body ||
    node.text ||
    null;

  if (typeof summary === 'string' && summary.length >= analysts.MIN_SUMMARY_LENGTH) {
    const authorStr = typeof author === 'string' ? author : author?.name || author?.fullName || '';
    const analystName =
      detectAnalystInText(`${authorStr} ${summary}`.slice(0, 600), pool) ||
      detectAnalystInText(summary.slice(0, 500), pool);
    if (analystName && !analysts.looksLikeAiSummary(summary)) {
      hits.push({ analystName, scoutingSummary: summary.trim() });
    }
  }

  Object.keys(node).forEach((k) => {
    if (/scout|evaluat|report|summary|analysis|projection/i.test(k) || depth < 8) {
      walkNextForScouting(node[k], pool, hits, depth + 1);
    }
  });
  return hits;
}

function extractLinkedUrls(html) {
  const urls = [];
  const re = /https?:\/\/(?:www\.)?(?:on3\.com|247sports\.com|espn\.com|theathletic\.com|nfl\.com)[^\s"'<>]*/gi;
  let m;
  while ((m = re.exec(html)) && urls.length < 12) {
    urls.push(m[0].replace(/\\u002F/g, '/').replace(/\\/g, ''));
  }
  return urls;
}

async function fetchUrl(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GatorVaultScouting/2.0)' },
    timeout: 25000
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function buildCollegeUrls(player) {
  const urls = [];
  const slug = player.slug;
  const on3Id = player.on3Id;
  const nameSlug = String(player.name || slug)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (on3Id && slug) {
    urls.push(`https://www.on3.com/rivals/${slug}-${on3Id}/`);
    urls.push(`https://www.on3.com/high-school/${slug}-${on3Id}/`);
    urls.push(`https://www.on3.com/db/${slug}-${on3Id}/`);
  }
  if (player.on3ProfileUrl) urls.push(player.on3ProfileUrl);

  if (player.recruit247Id && slug) {
    urls.push(`https://247sports.com/player/${slug}-${player.recruit247Id}/`);
  }
  urls.push(`https://247sports.com/Season/2027-Football/CompositeRecruitRankings/?Player=${encodeURIComponent(player.name || '')}`);

  urls.push(`https://www.espn.com/college-sports/football/recruiting/player/_/name/${nameSlug}`);

  return [...new Set(urls.filter(Boolean))];
}

function buildNflUrls(player) {
  const nameEnc = encodeURIComponent(player.name || player.slug);
  const slug = player.slug;
  return [
    `https://www.espn.com/nfl/draft/story/_/id/0/search/${nameEnc}`,
    `https://www.espn.com/search/results?q=${nameEnc}+mel+kiper`,
    `https://www.espn.com/search/results?q=${nameEnc}+daniel+jeremiah`,
    `https://www.nfl.com/search?query=${nameEnc}`,
    `https://theathletic.com/search/?q=${nameEnc}+draft`,
    `https://www.espn.com/college-football/player/_/id/0/${slug}`
  ].filter(Boolean);
}

function pickBestHit(hits, pool, sourceType) {
  for (const h of hits) {
    const resolved =
      sourceType === 'NFL' ? analysts.resolveNflAnalyst(h.analystName) : analysts.resolveCollegeAnalyst(h.analystName);
    if (resolved) return { ...h, analystName: resolved.name, analyst: resolved };
  }
  return null;
}

async function fetchFromUrl(url, pool, sourceType) {
  const outlet = analysts.outletFromUrl(url);
  if (!outlet || !analysts.isAllowedOutlet(outlet)) return null;

  let html;
  try {
    html = await fetchUrl(url);
  } catch {
    return null;
  }

  const hits = [];
  const next = parseNextData(html);
  if (next) walkNextForScouting(next, pool, hits);
  const htmlHit = extractScoutingBlock(html, pool);
  if (htmlHit) hits.unshift(htmlHit);

  const best = pickBestHit(hits, pool, sourceType);
  if (!best) return null;

  const validation = analysts.validateScoutingEntry({
    analystName: best.analystName,
    sourceUrl: url,
    scoutingSummary: best.scoutingSummary,
    sourceType
  });
  if (!validation.ok) return null;

  return {
    analystName: validation.analyst.name,
    sourceUrl: url,
    scoutingSummary: best.scoutingSummary,
    sourceType,
    outlet: validation.outlet,
    timestamp: new Date().toISOString()
  };
}

async function crawlLinkedSources(seedUrl, pool, sourceType, seen = new Set()) {
  if (seen.has(seedUrl) || seen.size > 8) return null;
  seen.add(seedUrl);

  const direct = await fetchFromUrl(seedUrl, pool, sourceType);
  if (direct) return direct;

  let html;
  try {
    html = await fetchUrl(seedUrl);
  } catch {
    return null;
  }

  for (const link of extractLinkedUrls(html)) {
    const outlet = analysts.outletFromUrl(link);
    if (!outlet || !analysts.isAllowedOutlet(outlet)) continue;
    const hit = await fetchFromUrl(link, pool, sourceType);
    if (hit) return hit;
  }
  return null;
}

/**
 * Find one verified scouting row for a player.
 * Portal/transfers/recruits/commits → college analysts only.
 * Roster/draft-eligible → NFL first, college fallback.
 */
async function findVerifiedScouting(player) {
  const rules = analysts.analystsForPlayerType(player.playerType, player);
  const seen = new Set();

  if (rules.useNflFirst) {
    for (const url of buildNflUrls(player)) {
      const hit = await crawlLinkedSources(url, analysts.NFL_ANALYSTS, 'NFL', seen);
      if (hit) return hit;
    }
  }

  if (rules.useCollege) {
    for (const url of buildCollegeUrls(player)) {
      const hit = await crawlLinkedSources(url, analysts.COLLEGE_ANALYSTS, 'College', seen);
      if (hit) return hit;
    }
  }

  return null;
}

module.exports = {
  fetchFromUrl,
  findVerifiedScouting,
  buildCollegeUrls,
  buildNflUrls,
  extractScoutingBlock,
  stripHtml
};
