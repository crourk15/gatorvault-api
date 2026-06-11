/**
 * Verified player context for autoposter — On3/Rivals/GatorVault records only. No inference.
 * Every post: identity block · context block · insider angle block (verified sources only).
 */
const template = require('./x-autoposter-template');

const INVALID_NAME_PARTS = new Set([
  'her', 'his', 'the', 'new', 'four', 'five', 'star', 'class', 'florida', 'gators', 'gator',
  'other', 'top', 'per', 'via', 'our', 'own', 'breaking', 'official', 'unofficial', 'south',
  'north', 'ole', 'miss', 'state', 'carolina', 'georgia', 'alabama', 'tennessee', 'recruit',
  'recruits', 'target', 'targets', 'nation', 'machine', 'prediction', 'rivals', 'online',
  'gators', 'weekend', 'this', 'that', 'with', 'from', 'they', 'will', 'now', 'has', 'have',
  'had', 'for', 'and', 'to', 'on', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
  'saturday', 'sunday', 'today', 'tomorrow', 'analyst', 'analysts', 'logged', 'logs',
  'way', 'https', 'http', 'intel', 'blog', 'loaded', 'visitor', 'promo', 'check', 'out',
  'schools', "i'm", 'im', "we're", "they're", "you're", "he's", "she's", 'who', 'what', 'when', 'where'
]);

function isValidPlayerName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 4 || trimmed.length > 48) return false;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  if (parts.some((p) => INVALID_NAME_PARTS.has(p.toLowerCase()))) return false;
  if (parts.some((p) => /https?|www|\.com/i.test(p))) return false;
  if (!parts.every((p) => /^[A-Za-z][A-Za-z'-]{1,}$/.test(p))) return false;
  return true;
}

const VERIFIED_PATCH_KEYS = new Set([
  'name',
  'pos',
  'classYear',
  'school',
  'stars',
  'rating',
  'natlRank',
  'htWt',
  'headliner',
  'category',
  'inState',
  'committedTo',
  'status',
  'formerSchool',
  'transferFrom'
]);

function mergeVerifiedFields(player, patch, { preferPatch = false } = {}) {
  const out = { ...(player || {}) };
  if (!patch || typeof patch !== 'object') return out;
  for (const [key, val] of Object.entries(patch)) {
    if (!VERIFIED_PATCH_KEYS.has(key)) continue;
    if (val == null || val === '') continue;
    if (preferPatch || out[key] == null || out[key] === '' || out[key] === 0) {
      out[key] = val;
    }
  }
  return out;
}

function formatPlayerContext(player) {
  const name = String(player?.name || '').trim();
  const pos = String(player?.pos || player?.position || '').trim() || null;
  const classYear = player?.classYear != null ? Number(player.classYear) : null;
  const yearRaw = player?.year || player?.class;
  const resolvedClass =
    classYear && !Number.isNaN(classYear) ? classYear : yearRaw ? parseInt(String(yearRaw).replace(/\D/g, ''), 10) : null;
  const starsLabel = template.formatStarsLabel(player?.stars);
  const school = String(player?.school || player?.hometown || '').trim() || null;
  const htWt = String(player?.htWt || '').trim() || null;
  const natlRank = player?.natlRank != null ? Number(player.natlRank) : null;
  const combinedHtWt =
    htWt ||
    (player?.height && player?.weight
      ? `${String(player.height).replace(/['"]/g, "'")}, ${String(player.weight).replace(/\D/g, '')}`
      : null);
  const category = String(player?.category || '').toLowerCase();
  const formerSchool =
    player?.formerSchool ||
    player?.transferFrom ||
    (category === 'portal' ? player?.committedTo || player?.school : null);

  const hasMinimumContext =
    isValidPlayerName(name) && !!(pos || (resolvedClass && !Number.isNaN(resolvedClass)) || starsLabel);

  const hasFullIdentity =
    isValidPlayerName(name) &&
    !!pos &&
    !!(school || formerSchool) &&
    (category === 'portal' ||
      (!!resolvedClass && !Number.isNaN(resolvedClass) && (natlRank > 0 || !!starsLabel)));

  return {
    name,
    pos,
    classYear: resolvedClass && !Number.isNaN(resolvedClass) ? resolvedClass : null,
    starsLabel,
    school,
    formerSchool: formerSchool ? String(formerSchool).trim() : school,
    htWt: combinedHtWt,
    natlRank,
    category,
    isPortal: category === 'portal' || player?.status === 'portal_in' || !!player?.transferInfo,
    hasMinimumContext,
    hasFullIdentity
  };
}

async function resolvePlayerContext({ playerSlug, playerName, patch = null, preferPatch = false } = {}) {
  const store = require('./recruiting-store');
  let player = null;
  if (playerSlug) {
    player = await store.getPlayerBySlug(playerSlug);
  }
  if (!player && playerName) {
    const all = await store.getAllPlayers();
    const key = String(playerName).toLowerCase();
    player = all.find((p) => String(p.name || '').toLowerCase() === key) || null;
  }
  if (player && playerName && String(player.name || '').toLowerCase() !== String(playerName).toLowerCase()) {
    player = null;
  }
  if (
    player &&
    patch?.classYear &&
    String(player.category || '').toLowerCase() === 'portal' &&
    (patch.category === 'recruit' || !patch.category)
  ) {
    player = null;
  }
  if (player && patch?.category === 'recruit' && String(player.category || '').toLowerCase() === 'portal') {
    player = null;
  }
  if (!player && playerName) {
    try {
      const rosterStore = require('./roster-store');
      const roster = rosterStore.getAllRosterPlayers();
      const key = String(playerName).toLowerCase();
      const rp = roster.find((p) => String(p.name || '').toLowerCase() === key);
      if (rp) {
        player = {
          name: rp.name,
          pos: rp.pos || rp.position,
          classYear: parseInt(String(rp.year || rp.class || '').replace(/\D/g, ''), 10) || null,
          school: rp.hometown || 'Florida',
          htWt: rp.height && rp.weight ? `${rp.height} / ${rp.weight}` : null,
          category: 'roster',
          stars: rp.stars,
          natlRank: rp.rank
        };
      }
    } catch {
      /* optional */
    }
  }
  const merged = mergeVerifiedFields(player, patch, { preferPatch: preferPatch || !!patch });
  if (!merged.name && playerName) merged.name = playerName;
  return formatPlayerContext(merged);
}

function loadVerifiedScouting(slug) {
  if (!slug) return null;
  try {
    const scoutingDb = require('./scouting-database');
    return scoutingDb.getEntryBySlug(slug) || null;
  } catch {
    return null;
  }
}

function loadVerifiedBreakdown(slug) {
  if (!slug) return null;
  try {
    const warRoom = require('./war-room-store');
    const b = warRoom.getBreakdownBySlug(slug);
    return b?.verified ? b : null;
  } catch {
    return null;
  }
}

function resolvePostKind(ctx, { newsEvent, intel, beatText } = {}) {
  if (ctx.category === 'roster') return 'team';
  if (ctx.isPortal || /portal/i.test(String(newsEvent || ''))) return 'portal';
  if (intel?.eventType?.startsWith('portal')) return 'portal';
  if (/portal/i.test(String(beatText || ''))) return 'portal';
  return 'recruiting';
}

function buildVerifiedInsiderAngle({ ctx, playerSlug, beatText, intel, contextLine }) {
  const beat = beatText ? template.classifyBeatSentences(beatText) : { context: [], insider: [] };
  const contextNorm = template.stripEmojisHashtags(contextLine || '').toLowerCase();
  const insiderPick = beat.insider.find(
    (s) => template.stripEmojisHashtags(s).toLowerCase() !== contextNorm
  );
  if (insiderPick) {
    const line = insiderPick.length <= 140 ? insiderPick : `${insiderPick.slice(0, 137)}…`;
    return { line, meta: { insiderFromBeat: true } };
  }

  const fromIntel = template.insiderFromIntel(intel);
  if (fromIntel) return { line: fromIntel, meta: { insiderFromIntel: true } };

  const scouting = loadVerifiedScouting(playerSlug);
  const fromScouting = template.insiderFromScouting(scouting);
  if (fromScouting) return { line: fromScouting, meta: { insiderFromScouting: true } };

  const breakdown = loadVerifiedBreakdown(playerSlug);
  const fromBreakdown = template.insiderFromBreakdown(breakdown);
  if (fromBreakdown) return { line: fromBreakdown, meta: { insiderFromBreakdown: true } };

  return { line: null, meta: {} };
}

function buildVerifiedContextLine({ newsEvent, sourceLabel, beatText, intel }) {
  const beat = beatText ? template.classifyBeatSentences(beatText) : { context: [], insider: [] };
  if (beat.context[0]) {
    return {
      line: beat.context[0].length <= 160 ? beat.context[0] : `${beat.context[0].slice(0, 157)}…`,
      meta: { fromBeat: true }
    };
  }
  const intelDetail = template.stripEmojisHashtags(intel?.detail || '');
  if (intelDetail.length >= 28 && !/trending|momentum/i.test(intelDetail)) {
    return {
      line: intelDetail.length <= 160 ? intelDetail : `${intelDetail.slice(0, 157)}…`,
      meta: { fromIntel: true, intelDetail }
    };
  }
  if (beatText) {
    const sentences = template.extractSentences(beatText);
    const factual = sentences.find(
      (s) => !template.HEADLINE_ONLY_RE.test(s) && (template.FACTUAL_SIGNAL_RE.test(s) || s.length >= 40)
    );
    if (factual) {
      return {
        line: factual.length <= 160 ? factual : `${factual.slice(0, 157)}…`,
        meta: { fromBeat: true, beatText }
      };
    }
  }
  if ((beatText || intelDetail) && newsEvent) {
    const fromEvent = template.contextFromNewsEvent(newsEvent, sourceLabel);
    if (fromEvent && !require('./x-autoposter-validation').isGenericSyntheticContext(fromEvent)) {
      return { line: fromEvent, meta: { fromEvent: true, beatText, intelDetail } };
    }
  }
  return { line: null, meta: {} };
}

function buildTeamEventPost({ beatText, source, teamEventType = null, postUrl = null } = {}) {
  const teamContext =
    template.teamEventLabel(teamEventType) || template.detectTeamContext(beatText) || 'UF Update';
  const identity = `Florida Gators — ${teamContext}`;
  const sourceLabel = String(source || 'Beat writer').trim();

  const contextResult = buildVerifiedContextLine({
    newsEvent: null,
    sourceLabel,
    beatText,
    intel: null
  });
  let contextLine = contextResult.line;
  if (!contextLine) {
    const sentences = template.extractSentences(beatText || '');
    const factual = sentences.find(
      (s) =>
        !template.HEADLINE_ONLY_RE.test(s) &&
        (template.FACTUAL_SIGNAL_RE.test(s) || s.length >= 35) &&
        !template.INSIDER_SIGNAL_RE.test(s)
    );
    if (factual) {
      contextLine = factual.length <= 160 ? factual : `${factual.slice(0, 157)}…`;
    }
  }
  if (!contextLine) return null;

  const beat = beatText ? template.classifyBeatSentences(beatText) : { context: [], insider: [] };
  const contextNorm = template.stripEmojisHashtags(contextLine).toLowerCase();
  let insiderLine = beat.insider.find(
    (s) => template.stripEmojisHashtags(s).toLowerCase() !== contextNorm
  );
  if (!insiderLine && beat.context.length > 1) {
    insiderLine = beat.context.find((s) => template.stripEmojisHashtags(s).toLowerCase() !== contextNorm);
  }
  if (!insiderLine) {
    insiderLine = `Per ${sourceLabel} report.`;
  } else if (insiderLine.length > 140) {
    insiderLine = `${insiderLine.slice(0, 137)}…`;
  }

  const raw = template.composeInsiderReport({
    identity,
    context: contextLine,
    insider: insiderLine
  });
  if (!raw || !template.hasTemplateStructure(raw)) return null;
  if (template.isHeadlineOnlyPost(raw)) return null;
  if (
    require('./x-autoposter-validation').hasDuplicateSentences(raw, {
      identity,
      context: contextLine,
      insider: insiderLine
    })
  ) {
    return null;
  }

  const text = template.enforceTweetLimit(raw, 280);
  if (!text || !template.hasTemplateStructure(text)) return null;

  return {
    text,
    playerName: null,
    postKind: 'team_event',
    triggerType: 'team_event',
    teamEventType: teamEventType || 'general',
    context: { teamEvent: true, name: 'Florida Gators' },
    templateBlocks: { identity, context: contextLine, insider: insiderLine },
    validationMeta: {
      teamEvent: true,
      teamEventType: teamEventType || 'general',
      beatText: beatText || null,
      insiderFromBeat: beat.insider.includes(insiderLine),
      contextFromBeat: contextResult.meta.fromBeat === true,
      postUrl: postUrl || null
    },
    playerContext: { teamEvent: true, name: 'Florida Gators' }
  };
}

async function buildPlayerNewsPost({
  source,
  newsEvent,
  playerSlug,
  playerName,
  patch = null,
  beatText = null,
  intel = null,
  postKind = null,
  teamContext = null,
  portalStatus = 'Portal',
  identityInferred = null,
  identityConfidence = null
} = {}) {
  const autoposterIdentity = require('./autoposter-identity');

  const intelStub = {
    ...(intel || {}),
    playerName: intel?.playerName || playerName,
    playerSlug: intel?.playerSlug || playerSlug,
    detail: beatText || intel?.detail,
    eventType: intel?.eventType,
    fingerprint: intel?.fingerprint,
    source: intel?.source || source
  };

  let resolvedIntel = intelStub;
  if (!intelStub.identityConfirmed) {
    const resolution = await autoposterIdentity.resolveIntelForAutoposter(intelStub, {
      beatText,
      fields: patch,
      eventType: intel?.eventType,
      subsystem: 'autoposter:player-context'
    });

    if (resolution.nonPlayerIntel) return resolution.skip;
    if (!resolution.ok) {
      return (
        resolution.skip ||
        autoposterIdentity.buildNeedsResolutionPayload({
          missingFields: resolution.resolution?.missingFields || [],
          playerName: playerName || intel?.playerName,
          playerSlug,
          triggerPhrase: beatText || intel?.detail
        })
      );
    }
    resolvedIntel = resolution.intel || intelStub;
  }

  const resolvedName = resolvedIntel.playerName || playerName;
  const resolvedSlug = resolvedIntel.playerSlug || playerSlug;
  const resolvedPatch = {
    ...(patch || {}),
    name: resolvedName,
    pos: resolvedIntel.pos || patch?.pos,
    classYear: resolvedIntel.classYear || patch?.classYear,
    school: resolvedIntel.school || resolvedIntel.highSchool || patch?.school,
    stars: resolvedIntel.stars || patch?.stars,
    natlRank: resolvedIntel.natlRank || patch?.natlRank
  };

  if (!resolvedName || !isValidPlayerName(resolvedName)) {
    return autoposterIdentity.buildNeedsResolutionPayload({
      missingFields: ['fullName'],
      playerName: resolvedName || null,
      playerSlug: resolvedSlug || null,
      triggerPhrase: beatText || intel?.detail || null
    });
  }

  const ctx = await resolvePlayerContext({
    playerSlug: resolvedSlug,
    playerName: resolvedName,
    patch: resolvedPatch,
    preferPatch: true
  });

  if (!ctx.hasFullIdentity) {
    const autoResolver = require('./recruiting-auto-resolution');
    autoResolver.logNeedsResolution({
      missingFields: autoposterIdentity.listMissingContextFields(ctx),
      playerName: ctx.name || resolvedName,
      playerSlug: resolvedSlug,
      detail: beatText || intel?.detail,
      subsystem: 'autoposter:player-context'
    });
    return autoposterIdentity.buildNeedsResolutionPayload({
      missingFields: autoposterIdentity.listMissingContextFields(ctx),
      playerName: ctx.name || resolvedName || null,
      playerSlug: resolvedSlug || null,
      triggerPhrase: beatText || intel?.detail || null
    });
  }

  intel = resolvedIntel;

  const kind = postKind || resolvePostKind(ctx, { newsEvent, intel, beatText });
  const sourceLabel = String(source || 'On3').trim();

  const contextResult = buildVerifiedContextLine({ newsEvent, sourceLabel, beatText, intel });
  let contextLine = contextResult.line;
  if (!contextLine) return null;

  const insiderResult = buildVerifiedInsiderAngle({ ctx, playerSlug, beatText, intel, contextLine });
  let insiderLine = insiderResult.line;
  if (!insiderLine) return null;

  const inferred = identityInferred ?? intel?.identityInferred;
  const conf = identityConfidence ?? intel?.identityConfidence ?? 0;
  if (inferred && conf >= 70 && conf < 92) {
    if (contextLine && !/Per beat report/i.test(contextLine)) {
      contextLine = `Per beat report — ${contextLine.replace(/^Per beat report —\s*/i, '')}`;
    }
    if (insiderLine && !/^Board match/i.test(insiderLine)) {
      insiderLine = `Board match · ${insiderLine}`;
    }
  }

  let identity;
  if (kind === 'portal') {
    identity = template.buildPortalIdentity(ctx, portalStatus);
  } else if (kind === 'team') {
    identity = template.buildTeamIdentity(ctx, teamContext || template.detectTeamContext(beatText));
  } else {
    identity = template.buildRecruitingIdentity(ctx);
  }

  const raw = template.composeInsiderReport({
    identity,
    context: contextLine,
    insider: insiderLine
  });
  if (!raw || !template.hasTemplateStructure(raw)) return null;
  if (template.isHeadlineOnlyPost(raw)) return null;
  if (require('./x-autoposter-validation').hasDuplicateSentences(raw, { identity, context: contextLine, insider: insiderLine })) {
    return null;
  }

  const text = template.enforceTweetLimit(raw, 280);
  if (!text || !template.hasTemplateStructure(text)) return null;

  return {
    text,
    playerName: ctx.name,
    context: ctx,
    postKind: kind,
    templateBlocks: { identity, context: contextLine, insider: insiderLine },
    validationMeta: {
      playerContext: ctx,
      beatText: beatText || null,
      intelDetail: intel?.detail || null,
      insiderFromBeat: insiderResult.meta.insiderFromBeat === true,
      insiderFromIntel: insiderResult.meta.insiderFromIntel === true,
      insiderFromScouting: insiderResult.meta.insiderFromScouting === true,
      insiderFromBreakdown: insiderResult.meta.insiderFromBreakdown === true,
      contextFromBeat: contextResult.meta.fromBeat === true,
      contextFromIntel: contextResult.meta.fromIntel === true,
      identityInferred: !!inferred,
      identityConfidence: conf || null
    }
  };
}

function newsEventForIntel(intel) {
  const visitRange =
    intel.visitStart && intel.visitEnd ? ` (${intel.visitStart}–${intel.visitEnd})` : intel.visitStart ? ` (${intel.visitStart})` : '';

  switch (intel.eventType) {
    case 'official_visit':
      return `scheduled an OV to Florida${visitRange}`;
    case 'unofficial_visit':
      return `scheduled a visit to Gainesville${visitRange}`;
    case 'visit_cancelled':
    case 'ov_change': {
      const next = intel.nextVisitSchool ? ` and will visit ${intel.nextVisitSchool} this weekend` : '';
      return `cancelled his OV to Florida${next}`;
    }
    case 'prediction':
    case 'rivals_futurecast': {
      const conf = intel.confidencePct != null ? ` (${intel.confidencePct}% confidence)` : '';
      if (/rivals|futurecast|prediction machine/i.test(String(intel.source || intel.status || ''))) {
        return `picked up a Florida FutureCast prediction${conf}`;
      }
      if (/rpm|on3/i.test(String(intel.source || intel.detail || ''))) {
        return `logged an On3 RPM pick for Florida${conf}`;
      }
      return `picked up a UF prediction${conf}`;
    }
    case 'trending':
    case 'recruiting_momentum':
      return null;
    case 'offer':
    case 'target_update':
    case 'offers':
      return 'received an offer from UF';
    case 'commit':
    case 'commitment':
      return 'committed to Florida';
    case 'decommit': {
      const school =
        intel.cancelledSchool ||
        intel.detail?.match(/decommitted from ([^.,]+)/i)?.[1]?.trim() ||
        null;
      return school ? `decommitted from ${school}` : 'decommitted';
    }
    case 'portal_in':
      return 'entered the transfer portal (UF target)';
    case 'portal_out':
    case 'portal':
      return 'entered the transfer portal';
    default:
      if (intel.detail && !/trending|momentum/i.test(String(intel.detail))) {
        return String(intel.detail).replace(/\.$/, '').slice(0, 120);
      }
      if (intel.status && !/trending/i.test(String(intel.status))) {
        return String(intel.status).replace(/\.$/, '').slice(0, 120);
      }
      return null;
  }
}

function newsEventForRecruitingEvent(ev) {
  const et = String(ev.eventType || '').toLowerCase();
  const player = ev.payload?.player || {};
  const school = player.committedTo || player.committed_to || null;
  switch (et) {
    case 'commit':
      return 'committed to Florida';
    case 'flip':
      return 'flipped to Florida';
    case 'decommit':
      return school ? `decommitted from ${school}` : 'decommitted';
    case 'portal_in':
      return 'entered the transfer portal (UF target)';
    case 'portal_out':
      return 'entered the transfer portal';
    case 'prediction':
      return 'picked up a UF prediction';
    case 'visit_cancelled':
      return 'cancelled his OV to Florida';
    case 'offer':
    case 'target_update':
      return 'received an offer from UF';
    case 'official_visit':
      return 'scheduled an OV to Florida';
    case 'unofficial_visit':
      return 'scheduled a visit to Gainesville';
    default:
      if (ev.detail && !/trending|ranking/i.test(String(ev.detail))) {
        return String(ev.detail).replace(/\.$/, '').slice(0, 120);
      }
      if (ev.title && !/ranking/i.test(String(ev.title))) {
        return String(ev.title).replace(/^[^:]+:\s*/, '').replace(/\.$/, '').slice(0, 120);
      }
      return null;
  }
}

function sourceLabelForIntel(intel) {
  if (intel.analystName) {
    if (/rivals|futurecast/i.test(String(intel.source || ''))) return `Rivals analyst ${intel.analystName}`;
    return intel.analystName;
  }
  return intel.source || 'GatorVault Recruiting';
}

function verifiedPatchFromIntel(intel) {
  return {
    name: intel.playerName,
    pos: intel.pos,
    classYear: intel.classYear,
    school: intel.school,
    highSchool: intel.highSchool,
    hometownState: intel.hometownState,
    stars: intel.stars,
    natlRank: intel.natlRank,
    htWt: intel.htWt,
    ufRpmPct: intel.ufRpmPct
  };
}

function verifiedPatchFromRow(row) {
  return {
    name: row.playerName,
    pos: row.pos,
    classYear: row.classYear,
    school: row.school,
    highSchool: row.highSchool,
    hometownState: row.hometownState,
    stars: row.stars,
    natlRank: row.natlRank,
    htWt: row.htWt,
    ufRpmPct: row.ufRpmPct
  };
}

function verifiedPatchFromPlayer(player) {
  if (!player) return null;
  return {
    name: player.name,
    pos: player.pos,
    classYear: player.classYear,
    school: player.school,
    stars: player.stars,
    natlRank: player.natlRank,
    htWt: player.htWt,
    headliner: player.headliner,
    category: player.category,
    inState: player.inState,
    committedTo: player.committedTo,
    status: player.status,
    formerSchool: player.transferFrom || player.committedTo
  };
}

module.exports = {
  isValidPlayerName,
  formatPlayerContext,
  resolvePlayerContext,
  buildPlayerNewsPost,
  buildTeamEventPost,
  newsEventForIntel,
  newsEventForRecruitingEvent,
  sourceLabelForIntel,
  verifiedPatchFromIntel,
  verifiedPatchFromRow,
  verifiedPatchFromPlayer,
  resolvePostKind,
  loadVerifiedScouting
};
