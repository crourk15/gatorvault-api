/**
 * Verified player context for autoposter — On3/Rivals/GatorVault records only. No inference.
 * Every post: identity block · context block · insider angle block (verified sources only).
 */
const template = require('./x-autoposter-template');
const quoteRewriter = require('./x-autoposter-recruiting-quote-rewriter');
const postSpec = require('./x-autoposter-post-spec');

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

function buildVerifiedInsiderAngle({ ctx, playerSlug, beatText, intel, contextLine, copyMeta = {}, research = null } = {}) {
  const sport = copyMeta.sport || 'football';
  if (sport !== 'football') {
    return { line: null, meta: { nonFootballSport: true, sport } };
  }
  if (quoteRewriter.isRewriterEnabled() && beatText && ctx?.hasMinimumContext) {
    const rewritten = quoteRewriter.rewriteBeatUpdate({
      beatText,
      ctx,
      intel,
      research,
      eventType: intel?.eventType || copyMeta.triggerType,
      postKind: copyMeta.postKind || 'recruiting',
      sport: copyMeta.sport || 'football'
    });
    if (rewritten.ok && rewritten.insiderLine) {
      const insider = quoteRewriter.sanitizeRewrittenLine(rewritten.insiderLine, beatText, 140);
      if (insider) {
        return {
          line: insider,
          meta: { insiderFromRewrite: true, ...rewritten.meta }
        };
      }
    }
  }

  const lineMeta = { ...copyMeta, beatText, text: beatText };
  const fromIntel = template.insiderFromIntel(intel, lineMeta);
  if (fromIntel) {
    const line = quoteRewriter.sanitizeRewrittenLine(fromIntel, beatText || fromIntel, 140) || fromIntel;
    return { line, meta: { insiderFromIntel: true } };
  }

  const scouting = loadVerifiedScouting(playerSlug);
  const fromScouting = template.insiderFromScouting(scouting, lineMeta);
  if (fromScouting) return { line: fromScouting, meta: { insiderFromScouting: true } };

  const breakdown = loadVerifiedBreakdown(playerSlug);
  const fromBreakdown = template.insiderFromBreakdown(breakdown, lineMeta);
  if (fromBreakdown) return { line: fromBreakdown, meta: { insiderFromBreakdown: true } };

  return { line: null, meta: {} };
}

function buildVerifiedContextLine({ newsEvent, sourceLabel, beatText, intel, copyMeta = {}, ctx = null, research = null } = {}) {
  const sport = copyMeta.sport || 'football';
  if (sport !== 'football') {
    return { line: null, meta: { nonFootballSport: true, sport } };
  }
  if (quoteRewriter.isRewriterEnabled() && beatText && (ctx?.hasMinimumContext || intel?.playerName)) {
    const rewritten = quoteRewriter.rewriteBeatUpdate({
      beatText,
      ctx,
      intel,
      research,
      newsEvent,
      eventType: intel?.eventType || copyMeta.triggerType,
      sourceLabel,
      postKind: copyMeta.postKind || 'recruiting',
      sport: copyMeta.sport || 'football'
    });
    if (rewritten.ok && rewritten.contextLine) {
      const line = quoteRewriter.sanitizeRewrittenLine(rewritten.contextLine, beatText, 160);
      if (line) {
        return { line, meta: { fromRewrite: true, ...rewritten.meta } };
      }
    }
  }

  const lineMeta = { ...copyMeta, beatText, text: beatText };
  const intelDetail = template.stripEmojisHashtags(intel?.detail || '');
  if (intelDetail.length >= 28 && !/trending|momentum/i.test(intelDetail)) {
    const line = quoteRewriter.sanitizeRewrittenLine(
      template.sanitizeCopyLine(intelDetail, 160, { ...lineMeta, text: intelDetail }),
      beatText || intelDetail,
      160
    );
    if (line) {
      return { line, meta: { fromIntel: true, intelDetail } };
    }
  }
  if (beatText) {
    const sentences = template.extractSentences(beatText);
    const factual = sentences.find(
      (s) => !template.HEADLINE_ONLY_RE.test(s) && (template.FACTUAL_SIGNAL_RE.test(s) || s.length >= 40)
    );
    if (factual && !quoteRewriter.isRewriterEnabled()) {
      return {
        line: template.sanitizeCopyLine(factual, 160, lineMeta),
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
  const copyMeta = {
    triggerType: 'team_event',
    postKind: 'team_event',
    teamEventType: teamEventType || 'general',
    beatText
  };

  const contextResult = buildVerifiedContextLine({
    newsEvent: null,
    sourceLabel,
    beatText,
    intel: null,
    copyMeta: { ...copyMeta, sport: 'football' }
  });
  let contextLine = contextResult.line;
  if (!contextLine && beatText && quoteRewriter.isRewriterEnabled()) {
    const rewritten = quoteRewriter.rewriteBeatUpdate({
      beatText,
      sourceLabel,
      postKind: 'team_event',
      sport: 'football'
    });
    if (rewritten.ok) contextLine = rewritten.contextLine;
  }
  if (!contextLine) {
    const sentences = template.extractSentences(beatText || '');
    const factual = sentences.find(
      (s) =>
        !template.HEADLINE_ONLY_RE.test(s) &&
        (template.FACTUAL_SIGNAL_RE.test(s) || s.length >= 35) &&
        !template.INSIDER_SIGNAL_RE.test(s)
    );
    if (factual && !quoteRewriter.isRewriterEnabled()) {
      contextLine = template.sanitizeCopyLine(factual, 160, copyMeta);
    }
  }
  if (!contextLine) return null;

  const beat = beatText ? template.classifyBeatSentences(beatText) : { context: [], insider: [] };
  const contextNorm = template.stripEmojisHashtags(contextLine).toLowerCase();
  let insiderLine = null;
  if (quoteRewriter.isRewriterEnabled() && beatText) {
    const rewritten = quoteRewriter.rewriteBeatUpdate({
      beatText,
      sourceLabel,
      postKind: 'team_event',
      sport: 'football'
    });
    if (rewritten.ok) insiderLine = rewritten.insiderLine;
  }
  if (!insiderLine) {
    insiderLine = beat.insider.find(
      (s) => template.stripEmojisHashtags(s).toLowerCase() !== contextNorm
    );
  }
  if (!insiderLine) {
    insiderLine = quoteRewriter.resolveInsiderFallback({
      sourceLabel,
      sport: 'football',
      contextBuilderFailed: !contextLine
    });
  } else {
    insiderLine = quoteRewriter.sanitizeRewrittenLine(
      template.sanitizeCopyLine(insiderLine, 140, copyMeta),
      beatText || '',
      140
    ) || quoteRewriter.resolveInsiderFallback({ sourceLabel, sport: 'football', contextBuilderFailed: false });
  }
  if (
    template.stripEmojisHashtags(contextLine).toLowerCase() ===
    template.stripEmojisHashtags(insiderLine).toLowerCase()
  ) {
    insiderLine = quoteRewriter.resolveInsiderFallback({
      sourceLabel,
      sport: 'football',
      contextBuilderFailed: !contextLine
    });
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

  const text = template.enforceTweetLimit(raw, 280, copyMeta);
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

function buildProgramNewsPost({ beatText, source, programNewsType = null, postUrl = null } = {}) {
  const newsContext =
    template.programNewsLabel(programNewsType) || template.detectProgramNewsContext(beatText) || 'Program News';
  const identity = `Florida Gators — ${newsContext}`;
  const sourceLabel = String(source || 'Beat writer').trim();
  const copyMeta = {
    triggerType: 'program_news',
    postKind: 'program_news',
    programNewsType: programNewsType || 'general',
    beatText
  };

  const contextResult = buildVerifiedContextLine({
    newsEvent: null,
    sourceLabel,
    beatText,
    intel: null,
    copyMeta: { ...copyMeta, sport: 'football' }
  });
  let contextLine = contextResult.line;
  if (!contextLine && beatText && quoteRewriter.isRewriterEnabled()) {
    const rewritten = quoteRewriter.rewriteBeatUpdate({
      beatText,
      sourceLabel,
      postKind: 'program_news',
      sport: 'football'
    });
    if (rewritten.ok) contextLine = rewritten.contextLine;
  }
  if (!contextLine) {
    const sentences = template.extractSentences(beatText || '');
    const factual = sentences.find(
      (s) =>
        !template.HEADLINE_ONLY_RE.test(s) &&
        (template.FACTUAL_SIGNAL_RE.test(s) || s.length >= 35) &&
        !template.INSIDER_SIGNAL_RE.test(s)
    );
    if (factual && !quoteRewriter.isRewriterEnabled()) {
      contextLine = template.sanitizeCopyLine(factual, 160, copyMeta);
    }
  }
  const usedFallback = !contextLine;
  if (!contextLine) {
    const eventSummary = template.inferProgramNewsEvent(beatText, programNewsType);
    contextLine = `Florida program update: ${eventSummary}. Monitoring staff/roster impact.`;
  }

  const beat = beatText ? template.classifyBeatSentences(beatText) : { context: [], insider: [] };
  const contextNorm = template.stripEmojisHashtags(contextLine).toLowerCase();
  let insiderLine = null;
  if (quoteRewriter.isRewriterEnabled() && beatText) {
    const rewritten = quoteRewriter.rewriteBeatUpdate({
      beatText,
      sourceLabel,
      postKind: 'program_news',
      sport: 'football'
    });
    if (rewritten.ok) insiderLine = rewritten.insiderLine;
  }
  if (!insiderLine) {
    insiderLine = beat.insider.find(
      (s) => template.stripEmojisHashtags(s).toLowerCase() !== contextNorm
    );
  }
  if (!insiderLine && beat.context.length > 1) {
    insiderLine = beat.context.find((s) => template.stripEmojisHashtags(s).toLowerCase() !== contextNorm);
  }
  if (!insiderLine) {
    insiderLine = quoteRewriter.resolveInsiderFallback({
      sourceLabel,
      sport: 'football',
      contextBuilderFailed: usedFallback
    });
  } else {
    insiderLine = quoteRewriter.sanitizeRewrittenLine(
      template.sanitizeCopyLine(insiderLine, 140, copyMeta),
      beatText || '',
      140
    ) || quoteRewriter.resolveInsiderFallback({ sourceLabel, sport: 'football', contextBuilderFailed: usedFallback });
  }
  if (
    template.stripEmojisHashtags(contextLine).toLowerCase() ===
    template.stripEmojisHashtags(insiderLine).toLowerCase()
  ) {
    insiderLine = quoteRewriter.resolveInsiderFallback({
      sourceLabel,
      sport: 'football',
      contextBuilderFailed: usedFallback
    });
  }

  const raw = template.composeInsiderReport({
    identity,
    context: contextLine,
    insider: insiderLine
  });
  if (!raw || !template.hasTemplateStructure(raw)) {
    const eventSummary = template.inferProgramNewsEvent(beatText, programNewsType);
    const fallbackText = template.enforceTweetLimit(
      `Florida program update: ${eventSummary}. Monitoring staff/roster impact.`,
      280,
      copyMeta
    );
    return {
      text: fallbackText,
      playerName: null,
      postKind: 'program_news',
      triggerType: 'program_news',
      programNewsType: programNewsType || 'general',
      context: { programNews: true, name: 'Florida Gators' },
      templateBlocks: { identity, context: fallbackText, insider: '' },
      validationMeta: {
        programNews: true,
        programNewsType: programNewsType || 'general',
        monitoringFallback: true,
        beatText: beatText || null,
        postUrl: postUrl || null
      },
      playerContext: { programNews: true, name: 'Florida Gators' }
    };
  }
  if (template.isHeadlineOnlyPost(raw) && !usedFallback) {
    const eventSummary = template.inferProgramNewsEvent(beatText, programNewsType);
    contextLine = `Florida program update: ${eventSummary}. Monitoring staff/roster impact.`;
  }

  const finalRaw = usedFallback
    ? contextLine
    : template.composeInsiderReport({ identity, context: contextLine, insider: insiderLine });
  const text = template.enforceTweetLimit(finalRaw, 280, copyMeta);
  if (!text) return null;

  return {
    text,
    playerName: null,
    postKind: 'program_news',
    triggerType: 'program_news',
    programNewsType: programNewsType || 'general',
    context: { programNews: true, name: 'Florida Gators' },
    templateBlocks: { identity, context: contextLine, insider: insiderLine },
    validationMeta: {
      programNews: true,
      programNewsType: programNewsType || 'general',
      monitoringFallback: usedFallback,
      beatText: beatText || null,
      insiderFromBeat: beat.insider.includes(insiderLine),
      contextFromBeat: contextResult.meta.fromBeat === true,
      postUrl: postUrl || null
    },
    playerContext: { programNews: true, name: 'Florida Gators' }
  };
}

function parseCoachFromText(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return null;

  const roleMatch =
    t.match(
      /\b(?:Florida\s+)?((?:WR|DL|QB|RB|TE|OL|OT|OG|C|CB|S|LB|EDGE|ST|special teams)\s+coach|(?:defensive|offensive)\s+coordinator|recruiting coordinator|analyst|GA|graduate assistant)\b/i
    ) || t.match(/\b(coach(?:es)?)\b/i);
  const nameMatch =
    t.match(/\bcoach\s+([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)+)/) ||
    t.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)+)\s+(?:continues|remains|leads|expected|is heavily)/);

  if (!nameMatch) return null;
  const name = nameMatch[1].trim();
  if (!isValidPlayerName(name)) return null;

  const coachRole = roleMatch ? roleMatch[1].trim() : 'Florida coach';
  const posGroupMatch = coachRole.match(/\b(WR|DL|QB|RB|TE|OL|CB|S|LB|EDGE)\b/i);
  return {
    name,
    coachRole,
    pos: coachRole,
    isCoach: true,
    posGroup: posGroupMatch ? `${posGroupMatch[1].toUpperCase()}s` : 'position group'
  };
}

function buildCoachNewsPost({ source, beatText = null, intel = null, coachCtx = null, postUrl = null } = {}) {
  const dataLayer = require('./x-autoposter-data-layer');
  const intelInput = {
    ...(intel || {}),
    beatText: beatText || intel?.detail || null,
    timestamp: intel?.timestamp || intel?.sourceEventCreatedAt || intel?.publishedAt || null,
    source: intel?.source || source,
    sourceHandle: intel?.sourceHandle || null,
    eventType: intel?.eventType || 'staff',
    coachName: coachCtx?.name || null
  };

  const fetched = dataLayer.fetchAutoposterCoachData(intelInput);
  if (!fetched.ok) {
    return require('./autoposter-identity').buildIdentitySkipPayload({
      reason: fetched.skipReason,
      playerName: intelInput.coachName,
      triggerPhrase: beatText || intel?.detail,
      missingFields: fetched.missingFields || []
    });
  }

  const coach = fetched.coach;
  const situation = fetched.situation;
  const classTag = intel?.classYear ? String(intel.classYear) : '2026';
  const meta = {
    coachName: coach.name,
    coachTitle: coach.title,
    posGroup: `${classTag} ${coach.positionGroup || 'pass-catchers'}`.replace(/\s+/g, ' ').trim(),
    beatText
  };

  let contextLine = null;
  let insiderLine = null;

  if (quoteRewriter.isRewriterEnabled() && beatText) {
    const rewritten = quoteRewriter.rewriteBeatUpdate({
      beatText,
      ctx: coach,
      intel,
      eventType: 'staff'
    });
    if (rewritten?.contextLine) {
      contextLine = quoteRewriter.sanitizeRewrittenLine(rewritten.contextLine, beatText, 160);
    }
    if (rewritten?.insiderLine) {
      insiderLine = quoteRewriter.sanitizeRewrittenLine(rewritten.insiderLine, beatText, 140);
    }
  }

  const composed = postSpec.composeStructuredPost(coach, situation, {
    ...meta,
    contextLine: contextLine || undefined,
    insiderLine: insiderLine || undefined
  });

  const text = template.enforceTweetLimit(composed.text, 280, { beatText, postKind: 'staff', eliteMode: true });
  if (!text || !template.hasTemplateStructure(text)) return null;

  return {
    text,
    playerName: coach.name,
    context: coach,
    postKind: 'staff',
    autoposterData: fetched.data,
    templateBlocks: composed.templateBlocks,
    validationMeta: {
      playerContext: coach,
      situation,
      isCoach: true,
      beatText: beatText || null,
      contextFromRewrite: !!contextLine,
      insiderFromRewrite: !!insiderLine,
      contextHint: fetched.data?.context || null,
      identitySource: 'staff_db',
      sourceUrl: postUrl || intel?.articleUrl || null
    }
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
  identityConfidence = null,
  article = null,
  headline = null,
  body = null
} = {}) {
  const eliteCaption = require('./x-autoposter-elite-caption');
  if (eliteCaption.isEliteModeEnabled()) {
    const elite = await eliteCaption.buildElitePlayerPost({
      source,
      newsEvent,
      playerSlug,
      playerName,
      patch,
      beatText,
      intel,
      postKind,
      teamContext,
      portalStatus,
      article,
      headline,
      body
    });
    if (elite?.ok && elite.text) return elite;
    if (elite?.skipped && elite.reason === 'no_usable_signal') {
      /* fall through to legacy only if we have full identity path */
    } else if (elite?.ok === false && elite.reason !== 'missing_player_identity') {
      /* elite attempted but failed — do not emit generic legacy copy */
      return null;
    }
  }

  const autoposterIdentity = require('./autoposter-identity');
  const dataLayer = require('./x-autoposter-data-layer');

  const beatDetail = beatText || intel?.detail || '';
  const intelInput = {
    playerName: intel?.playerName || playerName,
    playerSlug: intel?.playerSlug || playerSlug,
    beatText: beatDetail,
    detail: beatDetail,
    timestamp: intel?.timestamp || intel?.sourceEventCreatedAt || intel?.publishedAt || intel?.createdAt || null,
    eventType: intel?.eventType,
    sourceEventType: intel?.sourceEventType,
    source: intel?.source || source,
    sourceHandle: intel?.sourceHandle || null,
    directlyInvolvesUF: intel?.directlyInvolvesUF
  };

  if (postSpec.isCoachContext(null, beatDetail) && postSpec.detectSituation(beatDetail, intel?.eventType) === 'staff') {
    return buildCoachNewsPost({ source, beatText: beatDetail, intel: intelInput, postUrl: intel?.articleUrl });
  }

  const playerData = await dataLayer.fetchAutoposterPlayerData(intelInput);
  if (!playerData.ok) {
    if (playerData.skipReason === 'needs_resolution' || playerData.skipReason === 'missing_identity_fields') {
      return autoposterIdentity.buildNeedsResolutionPayload({
        missingFields: playerData.missingFields || [],
        playerName: playerData.playerName || intelInput.playerName,
        playerSlug: intelInput.playerSlug,
        triggerPhrase: beatDetail
      });
    }
    return autoposterIdentity.buildIdentitySkipPayload({
      reason: playerData.skipReason,
      playerName: intelInput.playerName,
      playerSlug: intelInput.playerSlug,
      triggerPhrase: beatDetail,
      missingFields: playerData.missingFields || []
    });
  }

  const ctx = playerData.ctx;
  const situation = playerData.situation;
  const resolvedSlug = playerData.data.playerSlug || intelInput.playerSlug;
  const resolvedIntel = {
    ...(intel || {}),
    playerName: ctx.name,
    playerSlug: resolvedSlug,
    detail: beatDetail,
    eventType: intel?.eventType,
    identityConfirmed: true
  };

  intel = resolvedIntel;

  const kind = postKind || resolvePostKind(ctx, { newsEvent, intel, beatText });
  const sourceLabel = String(source || 'On3').trim();
  const copyMod = require('./x-autoposter-copy');
  const copyMeta = {
    postKind: kind,
    triggerType: intel?.triggerType || intel?.eventType || null,
    beatText,
    teamEventType: null
  };
  if (beatText && copyMod.isGeneralBeatCommentary(beatText)) {
    copyMeta.postKind = 'recruiting_discussion';
  }

  const contextResult = buildVerifiedContextLine({ newsEvent, sourceLabel, beatText, intel, copyMeta, ctx });
  let contextLine = contextResult.line;
  if (!contextLine) return null;

  const insiderResult = buildVerifiedInsiderAngle({ ctx, playerSlug, beatText, intel, contextLine, copyMeta });
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

  const text = template.enforceTweetLimit(raw, 280, copyMeta);
  if (!text || !template.hasTemplateStructure(text)) return null;

  return {
    text,
    playerName: ctx.name,
    context: ctx,
    postKind: kind,
    autoposterData: playerData.data,
    templateBlocks: { identity, context: contextLine, insider: insiderLine },
    validationMeta: {
      playerContext: ctx,
      situation,
      autoposterData: playerData.data,
      identitySource: playerData.data?.identitySource || 'gatorvault_db',
      contextHint: playerData.data?.context || null,
      ufStatus: playerData.data?.ufStatus || null,
      beatText: beatText || null,
      intelDetail: intel?.detail || null,
      insiderFromBeat: insiderResult.meta.insiderFromBeat === true,
      insiderFromIntel: insiderResult.meta.insiderFromIntel === true,
      insiderFromScouting: insiderResult.meta.insiderFromScouting === true,
      insiderFromBreakdown: insiderResult.meta.insiderFromBreakdown === true,
      contextFromBeat: contextResult.meta.fromBeat === true,
      contextFromIntel: contextResult.meta.fromIntel === true,
      contextFromRewrite: contextResult.meta.fromRewrite === true,
      insiderFromRewrite: insiderResult.meta.insiderFromRewrite === true,
      rewrittenFromQuote: contextResult.meta.rewrittenFromQuote || insiderResult.meta.rewrittenFromQuote || false,
      quoteOverlapRatio: contextResult.meta.overlapRatio || insiderResult.meta.overlapRatio || null,
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
  parseCoachFromText,
  buildCoachNewsPost,
  buildPlayerNewsPost,
  buildTeamEventPost,
  buildProgramNewsPost,
  newsEventForIntel,
  newsEventForRecruitingEvent,
  sourceLabelForIntel,
  verifiedPatchFromIntel,
  verifiedPatchFromRow,
  verifiedPatchFromPlayer,
  resolvePostKind,
  loadVerifiedScouting
};
