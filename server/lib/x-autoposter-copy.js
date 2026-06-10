/**
 * Autoposter copy — verified insider report templates only. No headline-only posts.
 */
const playerContext = require('./x-autoposter-player-context');
const template = require('./x-autoposter-template');
const { isValidPlayerName } = playerContext;

const SITE_URL = process.env.SITE_URL || 'https://gatorvaultinsider.com';

const BROKEN_COPY_PATTERNS = [
  /\bour own pi\b/i,
  /\bHer — via\b/i,
  /\bHis — via\b/i,
  /\bThe — via\b/i,
  /\bNew — via\b/i,
  /\bFour — via\b/i,
  /\bOther — via\b/i,
  /reports that .+ has (committed|decommitted|entered)/i,
  /🐊/
];

const PLAYER_INTEL_SIGNALS = [
  /\b(commit(?:ted|ment)?|decommit(?:ted)?|flip(?:ped)?|portal|enroll(?:s|ed|ing)?)\b/i,
  /\b(official visit|\bov\b|\buv\b|unofficial visit|visit(?:ed|ing|s)? scheduled|cancel(?:led|s)?\s+(?:his|her|their)?\s*(?:ov|official))\b/i,
  /\b(prediction machine|futurecast|expert pick|crystal ball|forecast logged|prediction logged|rpm)\b/i,
  /\b(offer(?:ed|s)?|verb(?:ed|al)?)\b/i,
  /\bClass of 20\d{2}\b/i,
  /\b20\d{2}\s+(?:\d+-Star\s+)?[A-Z]{1,4}\s+[A-Z][a-z]+/,
  /\btrend(?:ing)?\s+up\b/i,
  /\bstaff loves\b/i
];

const NAME_CHUNK = `[A-Z][A-Za-z'.-]+(?:\\s+[A-Z][A-Za-z'.-]+){0,2}`;

function extractPlayerFromText(text) {
  const t = String(text || '');
  const patterns = [
    new RegExp(`\\b(?:Class of )?(20\\d{2})\\s+(?:\\d+-Star\\s+)?(?:[A-Z]{1,4}\\s+)(${NAME_CHUNK})\\b`),
    new RegExp(`\\b(?:Class of 20\\d{2})\\s+(?:\\d+-Star\\s+)?(?:[A-Z]{1,4}\\s+)?(${NAME_CHUNK})\\b`),
    new RegExp(`\\b(?:BREAKING:)\\s*(?:Class of 20\\d{2}\\s+)?(?:\\d+-Star\\s+)?(?:[A-Z]{1,4}\\s+)?(${NAME_CHUNK})\\b`),
    new RegExp(`\\b(?:pick|prediction|forecast)\\s+for\\s+(${NAME_CHUNK})\\b`, 'i'),
    new RegExp(`\\bfor\\s+(${NAME_CHUNK})\\s+to\\s+Florida\\b`, 'i'),
    new RegExp(`\\b(${NAME_CHUNK})\\s+(?:has|have)\\s+(?:committed|cancelled|canceled|decommitted|flipped|enrolled|signed)\\b`),
    new RegExp(`\\b(${NAME_CHUNK})\\s+(?:will|to)\\s+(?:now\\s+)?(?:visit|take)\\b`)
  ];
  for (const re of patterns) {
    const m = t.match(re);
    const name = (m?.[2] || m?.[1])?.trim();
    if (name && isValidPlayerName(name)) return name;
  }
  const m = t.match(new RegExp(`\\b(${NAME_CHUNK})\\b`));
  const fallback = m?.[1]?.trim() || null;
  return isValidPlayerName(fallback) ? fallback : null;
}

function hasPlayerSpecificIntel(text) {
  const t = String(text || '');
  if (!PLAYER_INTEL_SIGNALS.some((re) => re.test(t))) return false;
  return !!extractPlayerFromText(t);
}

function isGeneralBeatCommentary(text) {
  const lower = String(text || '').toLowerCase();
  if (hasPlayerSpecificIntel(text)) return false;
  if (
    /still working|still chasing|still pushing|in the hunt|on the trail|weekend ahead|busy weekend|several targets|plenty of|lot of targets|working on targets|recruiting well|good momentum|big weekend coming|uf trending|trending for florida/i.test(
      lower
    )
  ) {
    return true;
  }
  return !extractPlayerFromText(text);
}

function isPredictionMachinePost(text) {
  return /prediction machine|futurecast|expert pick logged|prediction logged/i.test(String(text || ''));
}

function extractVerifiedPatchFromBeatText(text) {
  const t = String(text || '');
  const yearMatch = t.match(/\b(20\d{2})\b/);
  const posMatch = t.match(/\b20\d{2}\s+(?:\d+-Star\s+)?([A-Z]{1,4})\s+[A-Z]/);
  const starsMatch = t.match(/\b([1-5])-Star\b/i);
  return {
    classYear: yearMatch ? parseInt(yearMatch[1], 10) : null,
    pos: posMatch ? posMatch[1] : null,
    stars: starsMatch ? parseInt(starsMatch[1], 10) : null,
    category: yearMatch && parseInt(yearMatch[1], 10) >= 2024 ? 'recruit' : null
  };
}

function appendSite(text) {
  const body = template.stripEmojisHashtags(text);
  if (!body) return '';
  const urlBit = SITE_URL.replace('https://', '');
  if (body.includes(urlBit)) return body.slice(0, 280);
  const withUrl = `${body}\n${SITE_URL}`;
  return withUrl.length <= 280 ? withUrl : template.enforceTweetLimit(body, 280);
}

function detectBeatNewsEvent(text) {
  const t = String(text || '');
  if (/cancel(?:led|s)?\s+(?:his|her|their)?\s*(?:ov|official visit).*?(?:florida|gators|\buf\b)/i.test(t)) {
    const next = t.match(/visit\s+((?:South\s+Carolina|North\s+Carolina|Ole\s+Miss|[A-Z][a-z]+(?:\s+State)?))/i);
    const nextPart = next?.[1] ? ` and will visit ${next[1]} this weekend` : '';
    return `cancelled his OV to Florida${nextPart}`;
  }
  if (/\b(commit(?:ted|ment)?|flip(?:ped)?)\b.*\b(florida|gators|\buf\b)/i.test(t)) return 'committed to Florida';
  if (/\bdecommit/i.test(t)) {
    const m = t.match(/decommitted from ([A-Za-z0-9 .]+)/i);
    return m ? `decommitted from ${m[1].trim()}` : 'decommitted';
  }
  if (/\bportal\b/i.test(t) && /\b(florida|gators|\buf\b)/i.test(t)) return 'entered the transfer portal (UF target)';
  if (/\bportal\b/i.test(t)) return 'entered the transfer portal';
  if (/\b(official visit|\bov\b).*?(?:florida|gators|gainesville|\buf\b)/i.test(t)) return 'scheduled an OV to Florida';
  if (/\b(unofficial visit|\buv\b).*?(?:florida|gators|gainesville|\buf\b)/i.test(t)) return 'scheduled a visit to Gainesville';
  if (/\boffer(?:ed|s)?\b.*\b(florida|gators|\buf\b)/i.test(t)) return 'received an offer from UF';
  if (isPredictionMachinePost(t) || /\brpm\b/i.test(t)) return 'picked up a UF prediction';
  if (/\bprediction\b/i.test(t) && /\b(florida|gators|\buf\b)/i.test(t)) return 'picked up a UF prediction';
  return null;
}

async function buildPredictionMachineCopyAsync(post) {
  const text = String(post.text || '').replace(/\s+/g, ' ').trim();
  const analyst = post.writerName || post.outlet || post.handle || 'Insider';
  const playerName = extractPlayerFromText(text);
  if (!playerName) return null;
  const matching = /matching.*prediction machine|prediction machine.*matching|logged a matching/i.test(text);
  const source = matching ? `Gators Online · ${analyst}` : `Rivals analyst ${analyst}`;
  const built = await playerContext.buildPlayerNewsPost({
    source,
    newsEvent: 'picked up a Florida Prediction Machine pick',
    playerName,
    beatText: text
  });
  return built?.text ? appendSite(built.text) : null;
}

async function buildBeatIntelCopyAsync(post) {
  const text = String(post.text || '').replace(/\s+/g, ' ').trim();
  if (!text || isGeneralBeatCommentary(text)) return null;
  if (template.HEADLINE_ONLY_RE.test(text)) return null;

  const analyst = post.writerName || post.outlet || post.handle || 'Beat writer';
  const playerName = extractPlayerFromText(text);

  if (isPredictionMachinePost(text)) {
    return buildPredictionMachineCopyAsync(post);
  }

  const beatFilters = require('./beat-writer-filters');
  const isTeam =
    !hasPlayerSpecificIntel(text) && beatFilters.matchesGatorFootballIntel(text) && playerName;

  if (isTeam) {
    const newsEvent = detectBeatNewsEvent(text) || 'UF roster update';
    const built = await playerContext.buildPlayerNewsPost({
      source: analyst,
      newsEvent,
      playerName,
      beatText: text,
      patch: { name: playerName, ...extractVerifiedPatchFromBeatText(text) },
      postKind: 'team',
      teamContext: template.detectTeamContext(text)
    });
    return built?.text ? appendSite(built.text) : null;
  }

  if (!hasPlayerSpecificIntel(text)) return null;
  if (!playerName) return null;

  const newsEvent = detectBeatNewsEvent(text);
  const hasMomentum = beatFilters.detectRecruitingMomentum(text);
  if (!newsEvent && !hasMomentum) return null;

  const built = await playerContext.buildPlayerNewsPost({
    source: analyst,
    newsEvent,
    playerName,
    beatText: text,
    patch: { name: playerName, ...extractVerifiedPatchFromBeatText(text) }
  });
  return built?.text ? appendSite(built.text) : null;
}

async function buildIntelCopyAsync(intel) {
  if (!intel?.eventType || !isValidPlayerName(intel.playerName)) return null;
  const newsEvent = playerContext.newsEventForIntel(intel);
  if (!newsEvent) return null;
  const source = playerContext.sourceLabelForIntel(intel);
  const built = await playerContext.buildPlayerNewsPost({
    source,
    newsEvent,
    playerSlug: intel.playerSlug,
    playerName: intel.playerName,
    patch: playerContext.verifiedPatchFromIntel(intel),
    intel,
    beatText: intel.detail || null
  });
  if (!built?.text) return null;
  return { text: appendSite(built.text), playerName: built.playerName };
}

async function buildMomentumCopyAsync(post) {
  const beatFilters = require('./beat-writer-filters');
  const text = String(post.text || '');
  if (!beatFilters.detectRecruitingMomentum(text)) return null;
  if (!template.INSIDER_SIGNAL_RE.test(text)) return null;
  const playerName = extractPlayerFromText(text);
  if (!playerName) return null;
  const source = post.writerName || post.outlet || post.handle || 'Insider';
  const built = await playerContext.buildPlayerNewsPost({
    source,
    newsEvent: null,
    playerName,
    beatText: text
  });
  return built?.text ? appendSite(built.text) : null;
}

async function buildRecruitingEventCopyAsync(ev, { source = 'On3' } = {}) {
  const player = ev.payload?.player || null;
  const playerName = player?.name || null;
  if (!isValidPlayerName(playerName)) return null;
  const newsEvent = playerContext.newsEventForRecruitingEvent(ev);
  if (!newsEvent) return null;
  const isPortal = ['portal_in', 'portal_out'].includes(String(ev.eventType || '').toLowerCase());
  const built = await playerContext.buildPlayerNewsPost({
    source,
    newsEvent,
    playerSlug: ev.playerSlug || player?.slug,
    playerName,
    patch: playerContext.verifiedPatchFromPlayer(player),
    postKind: isPortal ? 'portal' : 'recruiting',
    portalStatus: isPortal ? 'Portal' : undefined
  });
  if (!built?.text) return null;
  return { text: appendSite(built.text), playerName: built.playerName };
}

async function buildPortalHeadlinerCopyAsync(headliner) {
  if (!headliner?.name || !isValidPlayerName(headliner.name)) return null;
  const newsEvent =
    headliner.category === 'portal' ? 'entered the transfer portal (UF target)' : 'committed to Florida';
  const built = await playerContext.buildPlayerNewsPost({
    source: 'On3',
    newsEvent,
    playerSlug: headliner.slug,
    playerName: headliner.name,
    patch: playerContext.verifiedPatchFromPlayer(headliner),
    postKind: headliner.category === 'portal' ? 'portal' : 'recruiting',
    portalStatus: 'Portal'
  });
  if (!built?.text) return null;
  return { text: appendSite(built.text), playerName: built.playerName };
}

async function buildArticleCopyAsync(article) {
  if (!article?.title) return null;
  const playerName = extractPlayerFromText(`${article.title} ${article.summary || article.excerpt || ''}`);
  if (!playerName) return null;
  const beatText = template.stripEmojisHashtags(
    `${article.title}. ${article.summary || article.excerpt || ''}`.trim()
  );
  if (!beatText || beatText.length < 40) return null;
  const built = await playerContext.buildPlayerNewsPost({
    source: article.author || 'GatorVault',
    newsEvent: null,
    playerName,
    beatText,
    postKind: 'recruiting'
  });
  if (!built?.text) return null;
  return { text: appendSite(built.text), playerName: built.playerName };
}

function isBrokenCopy(text) {
  const t = String(text || '');
  if (!t.trim()) return true;
  if (BROKEN_COPY_PATTERNS.some((re) => re.test(t))) return true;
  if (template.isHeadlineOnlyPost(t)) return true;
  if (!template.hasTemplateStructure(t)) return true;
  if (/^[A-Z][a-z]{1,3} — via /i.test(t)) return true;
  if (/#[A-Za-z0-9_]+/.test(t)) return true;
  return false;
}

module.exports = {
  SITE_URL,
  isValidPlayerName,
  extractPlayerFromText,
  hasPlayerSpecificIntel,
  isGeneralBeatCommentary,
  isPredictionMachinePost,
  appendSite,
  buildPredictionMachineCopyAsync,
  buildBeatIntelCopyAsync,
  buildIntelCopyAsync,
  buildMomentumCopyAsync,
  buildRecruitingEventCopyAsync,
  buildPortalHeadlinerCopyAsync,
  buildArticleCopyAsync,
  isBrokenCopy
};
