/**
 * Auto-Resolution Mode — retrieve missing recruiting fields before store/feed/autoposter.
 * Required: full name, position, rating, school, class year, event type, context.
 * On failure: needs_resolution (no surface, no events, no autoposter).
 */
const { isValidPlayerName } = require('./x-autoposter-player-context');
const {
  buildSnapshot,
  mergeMissingFields,
  collectIdentitySources,
  confirmIdentity,
  normalizeNameKey,
  findStorePlayer,
  resolveRecruitSlug,
  sourceFromOn3Profile,
  sourceFrom247Profile,
  sourceFromGatorVault,
  sourceFromIntel
} = require('./player-identity-lookup');

const REQUIRED_FIELD_KEYS = [
  'fullName',
  'position',
  'rating',
  'school',
  'classYear',
  'eventType',
  'context'
];

function parseStars(value) {
  const n = parseInt(value, 10);
  return n >= 1 && n <= 5 ? n : null;
}

function hasSchool(snapshot) {
  return Boolean(
    String(snapshot?.highSchool || snapshot?.school || snapshot?.hometownState || '').trim()
  );
}

function resolveEventTypeFromText(text, fallback = null) {
  const t = String(text || '');
  if (!t.trim()) return fallback;
  if (/visit\s+cancel|cancelled\s+.*visit|ov\s+cancel/i.test(t)) return 'visit_cancelled';
  if (/unofficial\s+visit|\buv\b/i.test(t)) return 'unofficial_visit';
  if (/official\s+visit|\bov\b/i.test(t)) return 'official_visit';
  if (/prediction|futurecast|pick\s+to|pm\s+pick/i.test(t)) return 'prediction';
  if (/commit|flipped|pledged/i.test(t)) return 'commit';
  return fallback;
}

function buildRecruitingContext({ detail, row, player, eventType, snapshot }) {
  const existing = String(detail || row?.detail || '').trim();
  if (existing.length >= 20) return existing.slice(0, 280);

  try {
    const copy = require('./recruiting-alert-templates').buildRecruitingCopy({
      player: player || {
        name: snapshot?.playerName,
        slug: snapshot?.playerSlug,
        pos: snapshot?.pos,
        classYear: snapshot?.classYear,
        school: snapshot?.school || snapshot?.hometownState,
        stars: snapshot?.stars
      },
      existing: player,
      eventType: eventType || row?.eventType || 'official_visit',
      row: row || {}
    });
    return (copy?.profileNote || copy?.skinny || existing || null)?.slice?.(0, 280) || null;
  } catch {
    return existing || null;
  }
}

function listMissingRequiredFields(ctx) {
  const missing = [];
  const name = String(ctx.playerName || ctx.name || '').trim();
  if (!name || !isValidPlayerName(name)) missing.push('fullName');
  if (!String(ctx.pos || ctx.position || '').trim()) missing.push('position');
  if (!parseStars(ctx.stars) && !(Number(ctx.natlRank) > 0)) missing.push('rating');
  if (!hasSchool(ctx)) missing.push('school');
  if (!ctx.classYear || Number.isNaN(Number(ctx.classYear))) missing.push('classYear');
  if (!String(ctx.eventType || '').trim()) missing.push('eventType');
  if (!String(ctx.context || ctx.detail || '').trim()) missing.push('context');
  return missing;
}

function snapshotToRequiredContext(snapshot, extras = {}) {
  return {
    playerName: snapshot?.playerName,
    name: snapshot?.playerName,
    pos: snapshot?.pos,
    position: snapshot?.pos,
    stars: snapshot?.stars,
    natlRank: snapshot?.natlRank,
    highSchool: snapshot?.highSchool,
    school: snapshot?.school || snapshot?.highSchool || snapshot?.hometownState,
    hometownState: snapshot?.hometownState,
    classYear: snapshot?.classYear,
    eventType: extras.eventType,
    context: extras.context || extras.detail,
    detail: extras.detail || extras.context
  };
}

function mergeSnapshotFromSources(base, sources) {
  const matched = (sources || []).filter((s) => s?.snapshot);
  if (!matched.length) return { ...(base || {}) };
  const confirmation = { matchedSources: matched.sort((a, b) => b.confidence - a.confidence) };
  return mergeMissingFields(base || {}, confirmation.matchedSources);
}

async function pullBoardPlayerByName(playerName, classYear) {
  if (!playerName) return null;
  try {
    const resolver = require('./contextual-identity-resolver');
    const board = await resolver.getBoardPlayers();
    const key = normalizeNameKey(playerName);
    const exact = board.find((p) => normalizeNameKey(p.name) === key);
    if (exact) return exact;
    const parts = String(playerName).trim().split(/\s+/);
    const first = parts[0]?.toLowerCase();
    const last = parts.slice(1).join(' ').toLowerCase();
    if (first && last) {
      const byBoth = board.find((p) => {
        const np = String(p.name || '').toLowerCase();
        return np.startsWith(first) && np.includes(last);
      });
      if (byBoth) return byBoth;
    }
    if (classYear) {
      const byClass = board.filter((p) => Number(p.classYear) === Number(classYear));
      const hit = byClass.find((p) => normalizeNameKey(p.name).includes(key) || key.includes(normalizeNameKey(p.name)));
      if (hit) return hit;
    }
    return null;
  } catch {
    return null;
  }
}

async function pullFromStoredIntel({ playerSlug, playerName }) {
  try {
    const intelStore = require('./recruiting-intel-store');
    const rows = intelStore.getIntelForPlayer({ playerSlug, playerName });
    const complete = rows
      .filter((i) => i.resolutionStatus !== 'needs_resolution')
      .filter((i) => !listMissingRequiredFields(snapshotToRequiredContext(buildSnapshot(i), { eventType: i.eventType, detail: i.detail })).length);
    return complete[0] || rows[0] || null;
  } catch {
    return null;
  }
}

async function runAggressiveResolutionPass(working, opts, resolutionLog) {
  const text = opts.beatText || opts.row?.detail || opts.intel?.detail || working.detail || '';
  const resolver = require('./contextual-identity-resolver');
  let snapshot = { ...(working.snapshot || {}) };
  const sources = [];

  const override = resolver.lookupManualOverride(text);
  if (override?.playerSlug || override?.playerName) {
    const player = await resolver.resolvePlayerFromSlug(override.playerSlug, override.playerName);
    if (player) {
      const src = sourceFromGatorVault(player, { confidence: 100 });
      if (src) sources.push(src);
      resolutionLog.steps.push('mot_override');
    }
  }

  const patternEntries = await resolver.loadIdentityPatternEntries();
  const patternHit = resolver.lookupIdentityPattern(text, patternEntries);
  if (patternHit?.slug) {
    const player = await resolver.resolvePlayerFromSlug(patternHit.slug, patternHit.name);
    if (player) {
      const src = sourceFromGatorVault(player, { confidence: patternHit.confidence || 92 });
      if (src) sources.push(src);
      resolutionLog.steps.push('identity_pattern');
    }
  }

  if (!snapshot.playerName || !isValidPlayerName(snapshot.playerName)) {
    const boardPlayer = await pullBoardPlayerByName(snapshot.playerName || opts.playerName, snapshot.classYear);
    if (boardPlayer) {
      const src = sourceFromGatorVault(boardPlayer, { confidence: 85 });
      if (src) sources.push(src);
      resolutionLog.steps.push('board_name_search');
    }
  }

  const storedIntel = await pullFromStoredIntel({
    playerSlug: snapshot.playerSlug || opts.playerSlug,
    playerName: snapshot.playerName || opts.playerName
  });
  if (storedIntel) {
    const src = sourceFromIntel(storedIntel);
    if (src) {
      sources.push(src);
      resolutionLog.steps.push('stored_intel');
    }
  }

  snapshot = mergeSnapshotFromSources(snapshot, sources);

  const slug =
    resolveRecruitSlug({
      playerSlug: snapshot.playerSlug || opts.playerSlug,
      on3Id: snapshot.on3Id || opts.row?.on3Id || opts.intel?.playerId,
      playerName: snapshot.playerName || opts.playerName
    }) || snapshot.playerSlug;

  if (slug) {
    const on3 = await sourceFromOn3Profile(slug, snapshot.classYear || opts.classYear);
    if (on3) {
      snapshot = mergeSnapshotFromSources(snapshot, [on3]);
      resolutionLog.steps.push('on3_profile');
    }
    const profile247 = await sourceFrom247Profile({
      playerSlug: slug,
      playerName: snapshot.playerName || opts.playerName,
      classYearHint: snapshot.classYear || opts.classYear
    });
    if (profile247) {
      snapshot = mergeSnapshotFromSources(snapshot, [profile247]);
      resolutionLog.steps.push('247_profile');
    }
  }

  if (snapshot.playerSlug) {
    try {
      const autoposterIdentity = require('./autoposter-identity');
      await autoposterIdentity.ensurePatternsForPlayer(snapshot.playerSlug);
      resolutionLog.steps.push('pattern_rebuild');
    } catch {
      /* optional */
    }
  }

  if (opts.allowContextual !== false) {
    const contextual = await resolver.resolveContextualIdentity({
      text,
      sourceHandle: opts.sourceHandle || opts.row?.sourceHandle || opts.intel?.sourceHandle,
      hints: {
        playerName: snapshot.playerName || opts.playerName,
        stars: snapshot.stars || opts.fields?.stars,
        pos: snapshot.pos || opts.fields?.pos,
        classYear: snapshot.classYear || opts.classYear,
        school: snapshot.school || opts.fields?.school
      }
    });
    if (contextual?.mergedSnapshot) {
      snapshot = { ...snapshot, ...contextual.mergedSnapshot };
      resolutionLog.steps.push(`contextual:${contextual.mode || 'retry'}`);
    }
  }

  return snapshot;
}

function logNeedsResolution({ missingFields, playerName, playerSlug, fingerprint, source, detail, subsystem = 'recruiting:auto-resolution' } = {}) {
  try {
    require('./ops-monitor').logEvent({
      subsystem,
      status: 'needs_resolution',
      message: `Auto-resolution incomplete — missing: ${(missingFields || []).join(', ')}`,
      details: {
        missingFields,
        playerName: playerName || null,
        playerSlug: playerSlug || null,
        fingerprint: fingerprint || null,
        source: source || null,
        detail: String(detail || '').slice(0, 160)
      }
    });
  } catch {
    /* ops optional */
  }
}

/**
 * Auto-Resolution Mode entry — retrieve all required fields or return needs_resolution.
 */
async function autoResolveRecruitingIntel({
  fields = null,
  playerName = null,
  playerSlug = null,
  row = null,
  intel = null,
  player = null,
  classYear = null,
  beatText = null,
  sourceHandle = null,
  eventType = null,
  allowContextual = true,
  fingerprint = null,
  source = null
} = {}) {
  const resolutionLog = { steps: [], startedAt: new Date().toISOString() };
  resolutionLog.attempts = 1;

  let detail = beatText || row?.detail || intel?.detail || '';
  let resolvedEventType = eventType || row?.eventType || intel?.eventType || null;

  let snapshot = buildSnapshot({
    playerName: fields?.playerName || playerName,
    playerSlug,
    stars: fields?.stars,
    pos: fields?.pos,
    classYear: fields?.classYear || classYear,
    highSchool: fields?.highSchool || fields?.school,
    hometownState: fields?.hometownState,
    natlRank: fields?.natlRank,
    on3Id: row?.on3Id || intel?.playerId
  });

  const storePlayer = player || (await findStorePlayer({ playerName, playerSlug, on3Id: row?.on3Id || intel?.playerId }));
  if (storePlayer) {
    snapshot = mergeSnapshotFromSources(snapshot, [sourceFromGatorVault(storePlayer)].filter(Boolean));
    resolutionLog.steps.push('recruiting_store');
  }

  const sources = await collectIdentitySources({
    playerName: snapshot?.playerName || playerName,
    playerSlug: snapshot?.playerSlug || playerSlug,
    classYear: snapshot?.classYear || classYear,
    row,
    intel,
    player: storePlayer
  });

  let confirmation = confirmIdentity(sources);
  let contextual = null;

  if (confirmation.confirmed) {
    snapshot = mergeMissingFields(snapshot || {}, confirmation.matchedSources);
    resolutionLog.steps.push(`identity:${confirmation.mode}`);
  } else if (allowContextual) {
    const resolver = require('./contextual-identity-resolver');
    contextual = await resolver.resolveContextualIdentity({
      text: detail,
      sourceHandle: sourceHandle || row?.sourceHandle || intel?.sourceHandle,
      hints: {
        playerName: snapshot?.playerName || playerName,
        stars: fields?.stars || row?.stars || intel?.stars,
        pos: fields?.pos || row?.pos || intel?.pos,
        classYear: fields?.classYear || row?.classYear || intel?.classYear,
        school: fields?.school || row?.school || intel?.school
      }
    });
    if (contextual?.confirmed && contextual.mergedSnapshot) {
      snapshot = { ...mergeMissingFields(snapshot || {}, []), ...contextual.mergedSnapshot };
      confirmation = {
        confirmed: true,
        mode: contextual.mode,
        confidence: contextual.confidence,
        inferred: contextual.inferred
      };
      resolutionLog.steps.push(`contextual:${contextual.mode}`);
    } else {
      snapshot = mergeSnapshotFromSources(snapshot, sources);
      resolutionLog.steps.push('identity_unconfirmed');
    }
  } else {
    snapshot = mergeSnapshotFromSources(snapshot, sources);
  }

  let requiredCtx = snapshotToRequiredContext(snapshot, {
    eventType: resolvedEventType,
    detail,
    context: detail
  });
  let missing = listMissingRequiredFields(requiredCtx);

  if (missing.length) {
    resolutionLog.attempts += 1;
    snapshot = await runAggressiveResolutionPass(
      { snapshot, detail, eventType: resolvedEventType },
      { fields, playerName, playerSlug, row, intel, classYear, beatText: detail, sourceHandle, allowContextual },
      resolutionLog
    );
    requiredCtx = snapshotToRequiredContext(snapshot, { eventType: resolvedEventType, detail, context: detail });
    missing = listMissingRequiredFields(requiredCtx);
  }

  if (missing.includes('eventType')) {
    resolvedEventType = resolveEventTypeFromText(detail, resolvedEventType || row?.eventType || 'official_visit');
    requiredCtx.eventType = resolvedEventType;
    missing = listMissingRequiredFields(requiredCtx);
    if (resolvedEventType) resolutionLog.steps.push('event_classification');
  }

  if (missing.includes('context')) {
    detail =
      buildRecruitingContext({
        detail,
        row,
        player: storePlayer,
        eventType: resolvedEventType,
        snapshot
      }) || detail;
    requiredCtx.context = detail;
    requiredCtx.detail = detail;
    missing = listMissingRequiredFields(requiredCtx);
    if (detail) resolutionLog.steps.push('context_build');
  }

  if (!missing.length && snapshot?.playerName && isValidPlayerName(snapshot.playerName)) {
    return {
      resolved: true,
      confirmed: true,
      mergedSnapshot: snapshot,
      eventType: resolvedEventType,
      context: detail,
      detail,
      confirmation,
      contextual,
      resolutionLog,
      identityPatch: {
        playerName: snapshot.playerName,
        playerSlug: snapshot.playerSlug,
        identityInferred: !!confirmation?.inferred || !!contextual?.inferred,
        identityConfidence: confirmation?.confidence || contextual?.confidence || null,
        identityResolutionMode: confirmation?.mode || contextual?.mode || 'auto_resolution'
      },
      intelPatch: {
        stars: snapshot.stars,
        pos: snapshot.pos,
        classYear: snapshot.classYear,
        highSchool: snapshot.highSchool,
        hometownState: snapshot.hometownState,
        school: snapshot.highSchool || snapshot.hometownState,
        natlRank: snapshot.natlRank,
        playerSlug: snapshot.playerSlug,
        playerId: snapshot.on3Id,
        playerName: snapshot.playerName,
        eventType: resolvedEventType,
        detail
      }
    };
  }

  logNeedsResolution({
    missingFields: missing,
    playerName: snapshot?.playerName || playerName,
    playerSlug: snapshot?.playerSlug || playerSlug,
    fingerprint: fingerprint || row?.fingerprint || intel?.fingerprint,
    source: source || row?.source || intel?.source,
    detail
  });

  return {
    resolved: false,
    confirmed: false,
    needs_resolution: true,
    reason: 'needs_resolution',
    missingFields: missing,
    mergedSnapshot: snapshot,
    eventType: resolvedEventType,
    detail,
    confirmation,
    contextual,
    resolutionLog
  };
}

/**
 * Autoposter entry — prefilter, auto-resolution, needs_resolution persistence.
 * Replaces direct enrichAndConfirmIntelIdentity calls in the Autoposter pipeline.
 */
async function autoResolveIntel(intel, opts = {}) {
  const prefilter = require('./beat-intel-prefilter');
  const phrase = opts.beatText || intel?.detail || intel?.playerName || '';
  const subsystem = opts.subsystem || 'autoposter';

  if (intel?.eventType === 'program_news' || intel?.triggerType === 'program_news') {
    return {
      resolved: true,
      confirmed: true,
      programNews: true,
      intelPatch: {},
      mergedSnapshot: { programNews: true }
    };
  }

  if (intel?.eventType === 'team_event' || intel?.triggerType === 'team_event') {
    return {
      resolved: true,
      confirmed: true,
      teamEvent: true,
      intelPatch: {},
      mergedSnapshot: { teamEvent: true }
    };
  }

  const programGate = prefilter.evaluateProgramNewsEligibility(phrase, { post: opts.post || null });
  if (programGate.eligible) {
    return {
      resolved: true,
      confirmed: true,
      programNews: true,
      programNewsType: programGate.programNewsType,
      intelPatch: {
        eventType: 'program_news',
        triggerType: 'program_news',
        programNewsType: programGate.programNewsType
      },
      mergedSnapshot: { programNews: true }
    };
  }

  const teamGate = prefilter.evaluateTeamEventEligibility(phrase, { post: opts.post || null });
  if (teamGate.eligible) {
    return {
      resolved: true,
      confirmed: true,
      teamEvent: true,
      teamEventType: teamGate.teamEventType,
      intelPatch: {
        eventType: 'team_event',
        triggerType: 'team_event',
        teamEventType: teamGate.teamEventType
      },
      mergedSnapshot: { teamEvent: true }
    };
  }

  const skip = await prefilter.bypassRecruitingPipeline(phrase, {
    playerName: intel?.playerName,
    playerSlug: intel?.playerSlug,
    source: intel?.sourceHandle || intel?.source,
    subsystem
  });
  if (skip) {
    return { resolved: false, confirmed: false, nonPlayerIntel: true, skip };
  }

  const gate = await prefilter.evaluateBeatIntelEligibility(phrase, {
    playerName: intel?.playerName,
    playerSlug: intel?.playerSlug
  });
  if (!gate.eligible) {
    return {
      resolved: false,
      confirmed: false,
      nonPlayerIntel: true,
      skip: prefilter.buildNonPlayerSkipPayload(gate)
    };
  }

  const playerName = gate.playerName || intel?.playerName;
  const playerSlug = gate.playerSlug || intel?.playerSlug;

  const result = await autoResolveRecruitingIntel({
    fields: {
      playerName,
      pos: opts.fields?.pos || intel?.pos,
      classYear: opts.fields?.classYear || intel?.classYear,
      highSchool: opts.fields?.highSchool || intel?.highSchool,
      hometownState: opts.fields?.hometownState || intel?.hometownState,
      school: opts.fields?.school || intel?.school,
      stars: opts.fields?.stars || intel?.stars,
      natlRank: opts.fields?.natlRank || intel?.natlRank,
      ufRpmPct: opts.fields?.ufRpmPct || intel?.ufRpmPct
    },
    playerName,
    playerSlug,
    intel,
    row: opts.row || null,
    player: opts.player || null,
    classYear: opts.classYear || intel?.classYear,
    beatText: phrase,
    sourceHandle: intel?.sourceHandle || opts.sourceHandle,
    eventType: intel?.eventType || opts.eventType,
    allowContextual: opts.allowContextual !== false,
    fingerprint: intel?.fingerprint,
    source: intel?.source
  });

  if (result.resolved) {
    const mergedIntel = {
      ...(intel || {}),
      ...result.intelPatch,
      playerName: result.mergedSnapshot?.playerName || playerName,
      playerSlug: result.mergedSnapshot?.playerSlug || playerSlug,
      pos: result.mergedSnapshot?.pos || intel?.pos,
      classYear: result.mergedSnapshot?.classYear || intel?.classYear,
      stars: result.mergedSnapshot?.stars || intel?.stars,
      school: result.intelPatch?.school || intel?.school,
      highSchool: result.mergedSnapshot?.highSchool || intel?.highSchool,
      hometownState: result.mergedSnapshot?.hometownState || intel?.hometownState,
      natlRank: result.mergedSnapshot?.natlRank || intel?.natlRank,
      detail: result.detail || result.context || intel?.detail,
      identityConfirmed: true,
      identityResolutionMode: result.identityPatch?.identityResolutionMode || 'auto_resolution',
      identityInferred: result.identityPatch?.identityInferred,
      identityConfidence: result.identityPatch?.identityConfidence
    };
    return {
      ...result,
      confirmed: true,
      intel: mergedIntel,
      identityPatch: result.identityPatch,
      intelPatch: result.intelPatch
    };
  }

  if (opts.persistNeedsResolution !== false && intel?.fingerprint) {
    try {
      const intelStore = require('./recruiting-intel-store');
      const snap = result.mergedSnapshot || {};
      await intelStore.saveNeedsResolution({
        ...intel,
        playerId: String(snap.on3Id || intel.playerId || intel.playerSlug || 'pending'),
        playerName: snap.playerName || playerName,
        playerSlug: snap.playerSlug || playerSlug,
        missingFields: result.missingFields || [],
        resolutionAttemptedAt: new Date().toISOString()
      });
    } catch {
      /* optional */
    }
  }

  logNeedsResolution({
    missingFields: result.missingFields,
    playerName: result.mergedSnapshot?.playerName || playerName,
    playerSlug: result.mergedSnapshot?.playerSlug || playerSlug,
    fingerprint: intel?.fingerprint,
    source: intel?.source,
    detail: phrase,
    subsystem
  });

  return {
    ...result,
    confirmed: false,
    needs_resolution: true,
    reason: 'needs_resolution'
  };
}

module.exports = {
  REQUIRED_FIELD_KEYS,
  listMissingRequiredFields,
  resolveEventTypeFromText,
  buildRecruitingContext,
  autoResolveRecruitingIntel,
  autoResolveIntel,
  logNeedsResolution
};
