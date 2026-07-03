/**
 * beatPost / intelRow / elite research → Voice Signal (v1.1.1)
 */
const copy = require('../x-autoposter-copy');

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

function monthIndex(name) {
  const i = MONTH_NAMES.indexOf(String(name || '').toLowerCase());
  return i >= 0 ? i : null;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Pull visit window from beat copy when structured visitStart is missing. */
function extractVisitDateFromBeat(beatText, referenceIso) {
  const text = String(beatText || '');
  if (!text) return null;
  const ref = referenceIso ? new Date(referenceIso) : new Date();
  if (Number.isNaN(ref.getTime())) return null;

  const rangeRe =
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[–\-—]\s*(\d{1,2})\b/i;
  const onRe =
    /\b(?:on|from)\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b/i;
  const looseRe =
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b/i;

  const match = text.match(rangeRe) || text.match(onRe) || text.match(looseRe);
  if (!match) return null;

  const month = monthIndex(match[1]);
  const day = Number(match[2]);
  if (month == null || !day || day < 1 || day > 31) return null;

  let year = ref.getFullYear();
  if (month > ref.getMonth() + 1) year -= 1;

  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function resolvePlayerUrl(slug, meta = {}) {
  if (!slug) return null;
  return copy.playerProfileUrl(slug, meta);
}

function parseUfRpm(research, intel) {
  const fromPlayer = research?.player?.ufRpmPct ?? intel?.ufRpmPct;
  if (fromPlayer != null && Number(fromPlayer) > 0) return Number(fromPlayer);

  const preds = research?.predictions || [];
  for (const p of preds) {
    const school = String(p?.school || p?.pick || '').toLowerCase();
    if (/florida|gators|\buf\b/.test(school) && p?.pct != null) return Number(p.pct);
  }

  const teams = research?.on3TopTeams || research?.topSchools || [];
  for (const t of teams) {
    const name = String(t?.school || t?.name || t || '').toLowerCase();
    if (/florida|gators|\buf\b/.test(name) && t?.percent != null) return Number(t.percent);
  }
  return null;
}

function compSchoolsFromResearch(research) {
  const raw = research?.topSchools || research?.on3TopTeams || [];
  const names = raw
    .map((t) => (typeof t === 'string' ? t : t?.school || t?.name || null))
    .filter(Boolean)
    .filter((s) => !/florida|gators|\buf\b/i.test(String(s)));
  return [...new Set(names)].slice(0, 4);
}

function resolveSignalType(input, research) {
  const et = String(research?.eventType || input?.intel?.eventType || '').toLowerCase();
  if (/portal/.test(et)) return 'portal';
  if (/opponent|scout|matchup/.test(et)) return 'opponent';
  if (/roster|depth|rep/.test(et)) return 'roster';
  return 'recruiting';
}

function resolveMode(signal) {
  return signal.type === 'recruiting' && signal.player ? 'recruiting' : 'non_recruiting';
}

function buildPlayerUrl(slug, meta = {}) {
  return resolvePlayerUrl(slug, meta);
}

function signalFromBeatPost(beatPost, research = null, playerData = null) {
  const text = String(beatPost?.text || '').trim();
  const slug =
    research?.playerSlug ||
    playerData?.data?.playerSlug ||
    beatPost?.playerSlug ||
    null;

  return {
    id: beatPost?.id || beatPost?.url || `beat_${Date.now()}`,
    type: research ? resolveSignalType({ intel: {} }, research) : 'recruiting',
    player: playerData?.data
      ? {
          name: playerData.data.name,
          pos: playerData.data.pos,
          classYear: playerData.data.classYear,
          school: playerData.data.school || playerData.data.highSchool || null,
          ranking: playerData.data.natlRank || null
        }
      : beatPost?.playerName
        ? {
            name: beatPost.playerName,
            pos: beatPost.pos || null,
            classYear: beatPost.classYear || null,
            school: beatPost.school || null,
            ranking: null
          }
        : null,
    event: {
      kind: research?.eventType || 'target_update',
      timestamp: beatPost?.publishedAt || new Date().toISOString(),
      description: text,
      source: beatPost?.writerName || beatPost?.handle || 'Beat writer'
    },
    metrics: {
      rpm: research ? parseUfRpm(research) : null,
      visitDate:
        research?.timing?.visitStart ||
        research?.intel?.visitStart ||
        extractVisitDateFromBeat(text, beatPost?.publishedAt) ||
        null,
      compSchools: research ? compSchoolsFromResearch(research) : [],
      depthChartNote: null,
      schemeNote: null
    },
    links: {
      playerUrl: buildPlayerUrl(slug, {
        playerSlug: slug,
        eventType: research?.eventType || beatPost?.eventType || null
      }),
      boardUrl: copy.resolveAutoposterSiteUrl({ eventType: 'recruiting' }),
      portalUrl: copy.resolveAutoposterSiteUrl({ eventType: 'portal' }),
      opponentUrl: null
    },
    beatText: text,
    sourceHandle: beatPost?.handle || null,
    playerSlug: slug
  };
}

function signalFromIntelRow(intel, research = null) {
  const slug = intel?.playerSlug || null;
  const type = resolveSignalType({ intel }, research || { eventType: intel?.eventType });

  return {
    id: intel?.id || intel?.fingerprint || `intel_${Date.now()}`,
    type,
    player: intel?.playerName
      ? {
          name: intel.playerName,
          pos: intel?.pos || null,
          classYear: intel?.classYear || null,
          school: intel?.school || intel?.highSchool || null,
          ranking: intel?.natlRank || null
        }
      : null,
    event: {
      kind: intel?.eventType || 'target_update',
      timestamp: intel?.timestamp || intel?.reportedAt || intel?.createdAt || new Date().toISOString(),
      description: intel?.detail || intel?.text || '',
      source: intel?.analystName || intel?.source || 'Intel'
    },
    metrics: {
      rpm: parseUfRpm(research || {}, intel),
      visitDate:
        intel?.visitStart ||
        research?.timing?.visitStart ||
        extractVisitDateFromBeat(intel?.detail || intel?.text || '', intel?.timestamp) ||
        null,
      compSchools: research ? compSchoolsFromResearch(research) : [],
      depthChartNote: intel?.depthChartNote || null,
      schemeNote: intel?.schemeNote || null
    },
    links: {
      playerUrl: buildPlayerUrl(slug, {
        playerSlug: slug,
        eventType: intel?.eventType || research?.eventType || null
      }),
      boardUrl: copy.resolveAutoposterSiteUrl({ eventType: 'recruiting' }),
      portalUrl: copy.resolveAutoposterSiteUrl({ eventType: 'portal' }),
      opponentUrl: intel?.opponentUrl || null
    },
    beatText: intel?.detail || intel?.text || '',
    sourceHandle: intel?.sourceHandle || null,
    playerSlug: slug,
    xPostQueued: intel?.xPostQueued === true,
    fingerprint: intel?.fingerprint || null,
    resolutionStatus: intel?.resolutionStatus || null,
    identityConfirmed: intel?.identityConfirmed !== false
  };
}

function signalFromEliteInput(input, research, playerData) {
  const beatText = input?.beatText || input?.intel?.detail || '';
  const base = signalFromBeatPost(
    {
      text: beatText,
      handle: input?.intel?.sourceHandle,
      writerName: input?.intel?.source || input?.source,
      publishedAt: input?.intel?.timestamp,
      id: input?.intel?.fingerprint || input?.intel?.id
    },
    research,
    playerData
  );
  base.type = resolveSignalType(input, research);
  if (input?.intel?.fingerprint) base.fingerprint = input.intel.fingerprint;
  if (input?.intel?.visitStart) {
    base.metrics.visitDate = input.intel.visitStart;
  } else if (!base.metrics.visitDate) {
    base.metrics.visitDate = extractVisitDateFromBeat(
      beatText,
      input?.intel?.timestamp || input?.intel?.reportedAt
    );
  }
  if (base.playerSlug) {
    base.links.playerUrl = buildPlayerUrl(base.playerSlug, {
      playerSlug: base.playerSlug,
      eventType: research?.eventType || input?.intel?.eventType || null
    });
  }
  return base;
}

module.exports = {
  signalFromBeatPost,
  signalFromIntelRow,
  signalFromEliteInput,
  resolveMode,
  resolveSignalType,
  parseUfRpm,
  compSchoolsFromResearch,
  buildPlayerUrl,
  extractVisitDateFromBeat
};
