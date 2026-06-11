/**
 * Prediction Post Engine — full-context FutureCast/RPM posts only.
 * Skips if any identity field is missing. Never publishes bare analyst-only lines.
 */
const template = require('./x-autoposter-template');
const playerContext = require('./x-autoposter-player-context');

const CITY_STATE_RE = /^[A-Za-z .'-]+,\s*[A-Z]{2}\b/;

function looksLikeCityState(value) {
  return CITY_STATE_RE.test(String(value || '').trim());
}

function parseStars(value) {
  const n = parseInt(value, 10);
  return n >= 1 && n <= 5 ? n : null;
}

function parseRpm(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null;
}

function parseConfidence(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : null;
}

function resolvePredictionProduct(intel, row) {
  const source = String(intel?.source || row?.source || '').toLowerCase();
  const status = String(intel?.status || '').toLowerCase();
  if (
    row?.sourceType === 'rivals_pm' ||
    intel?.rivalsPickKey ||
    /rivals|futurecast|prediction machine/.test(`${source} ${status}`)
  ) {
    return 'Florida FutureCast';
  }
  if (/rpm|on3/.test(source)) return 'Florida RPM pick';
  return 'Florida prediction';
}

function splitSchoolLocation(player, row) {
  const rowSchool = String(row?.highSchool || row?.school || '').trim();
  const playerSchool = String(player?.school || '').trim();
  const fromSchool = String(player?.fromSchool || player?.highSchool || '').trim();
  const rowHometown = String(row?.hometownState || row?.hometown || '').trim();

  let highSchool = String(row?.highSchool || '').trim();
  let hometownState = rowHometown;

  if (!highSchool && rowSchool && !looksLikeCityState(rowSchool)) highSchool = rowSchool;
  if (!highSchool && fromSchool) highSchool = fromSchool;
  if (!highSchool && playerSchool && !looksLikeCityState(playerSchool)) highSchool = playerSchool;

  if (!hometownState && looksLikeCityState(playerSchool)) hometownState = playerSchool;
  if (!hometownState && looksLikeCityState(rowSchool)) hometownState = rowSchool;

  return { highSchool: highSchool || null, hometownState: hometownState || null };
}

function validatePredictionFields(fields) {
  const missing = [];
  if (!playerContext.isValidPlayerName(fields.playerName)) missing.push('playerName');
  if (!parseStars(fields.stars)) missing.push('rating');
  if (!String(fields.pos || '').trim()) missing.push('position');
  if (!fields.classYear || Number.isNaN(Number(fields.classYear))) missing.push('classYear');
  if (!String(fields.highSchool || '').trim()) missing.push('school');
  if (!String(fields.hometownState || '').trim()) missing.push('hometownState');
  if (parseRpm(fields.ufRpmPct) == null) missing.push('ufRpmPct');
  if (!String(fields.analystName || '').trim()) missing.push('analystName');
  if (parseConfidence(fields.confidencePct) == null) missing.push('confidencePct');
  return { ok: missing.length === 0, missing };
}

function buildWhyUfCare(fields, player) {
  const reasons = [];
  const rpm = parseRpm(fields.ufRpmPct);
  const natlRank = fields.natlRank != null ? Number(fields.natlRank) : null;

  if (player?.headliner) reasons.push('Priority target on Florida’s board.');
  if (player?.inState || /,\s*FL\b/i.test(String(fields.hometownState || ''))) {
    reasons.push('In-state prospect with local ties to the Gators.');
  }
  if (natlRank > 0 && natlRank <= 100) {
    reasons.push(`On3 ranks him No. ${natlRank} nationally — a name to watch in this class.`);
  }
  if (player?.classRank != null && Number(player.classRank) <= 10) {
    reasons.push(`Top-${player.classRank} priority in Florida’s ${fields.classYear} class.`);
  }
  if (rpm >= 50) reasons.push('Florida leads On3 RPM — a meaningful crystal-ball signal for UF fans.');
  else if (rpm >= 25) reasons.push('UF is firmly in the On3 RPM mix with real momentum building.');

  if (player?.ufOvStatus === 'scheduled' || player?.visitStart) {
    reasons.push('Recent Florida visit activity adds weight to this pick.');
  }

  if (!reasons.length) return null;
  return reasons.slice(0, 2).join(' ');
}

async function resolvePredictionFields({ intel = null, row = null, playerSlug = null, playerName = null, patch = null } = {}) {
  const ctx = await playerContext.resolvePlayerContext({
    playerSlug: playerSlug || intel?.playerSlug || row?.playerSlug,
    playerName: playerName || intel?.playerName || row?.playerName,
    patch,
    preferPatch: !!patch
  });

  let player = null;
  try {
    const store = require('./recruiting-store');
    if (playerSlug || intel?.playerSlug || row?.playerSlug) {
      player = await store.getPlayerBySlug(playerSlug || intel?.playerSlug || row?.playerSlug);
    }
  } catch {
    /* optional */
  }

  const { highSchool, hometownState } = splitSchoolLocation(player, row);

  const stars =
    parseStars(row?.stars) ||
    parseStars(intel?.stars) ||
    parseStars(patch?.stars) ||
    parseStars(ctx.starsLabel?.replace(/\D/g, '')) ||
    parseStars(player?.stars);

  const fields = {
    playerName: ctx.name || intel?.playerName || row?.playerName,
    pos: String(intel?.pos || row?.pos || patch?.pos || ctx.pos || '').trim() || null,
    classYear: intel?.classYear || row?.classYear || patch?.classYear || ctx.classYear || player?.classYear || null,
    highSchool,
    hometownState,
    stars,
    natlRank: row?.natlRank ?? intel?.natlRank ?? patch?.natlRank ?? ctx.natlRank ?? player?.natlRank ?? null,
    ufRpmPct: parseRpm(row?.ufRpmPct ?? intel?.ufRpmPct ?? patch?.ufRpmPct ?? player?.ufRpmPct),
    analystName: String(intel?.analystName || row?.analystName || '').trim() || null,
    confidencePct: parseConfidence(
      intel?.confidencePct ?? intel?.confidence ?? row?.confidence ?? row?.confidencePct ?? player?.rivalsConfidence
    ),
    product: resolvePredictionProduct(intel, row)
  };

  return { fields, ctx, player };
}

function buildPredictionIdentityLine(fields) {
  const starsLabel = template.formatStarsLabel(fields.stars);
  const rankBit = fields.natlRank > 0 ? ` · On3 #${fields.natlRank}` : ' · On3';
  return `${fields.classYear} ${starsLabel} ${fields.pos} ${fields.playerName} (${fields.highSchool}, ${fields.hometownState})${rankBit}`;
}

function buildPredictionContextBlock(fields) {
  const conf = `${fields.confidencePct}%`;
  return `${fields.analystName} has logged a ${fields.product} · ${conf} · UF RPM: ${fields.ufRpmPct}%`;
}

function isBarePredictionLine(text) {
  const t = template.stripEmojisHashtags(text || '').trim();
  return /^[A-Za-z .'-]{3,40} logged a florida (?:futurecast|prediction|rpm pick)(?:\s*\(\d{1,3}%\))?\.?$/i.test(t);
}

async function buildPredictionPost(opts = {}) {
  const result = await buildPredictionPostInner(opts);
  try {
    const ops = require('./ops-monitor');
    const name = result.fields?.playerName || opts.playerName;
    if (result.skipped) {
      ops.logEvent({
        subsystem: 'autoposter:predictions',
        status: 'skipped',
        message: result.reason || 'prediction_skipped',
        details: {
          playerName: name,
          reason: result.reason,
          stars: result.fields?.stars,
          eventType: 'prediction',
          missing: result.missing || result.missingAfter || null
        }
      });
    } else if (result.ok) {
      ops.logEvent({
        subsystem: 'autoposter:predictions',
        status: 'success',
        message: `Prediction copy built: ${name}`,
        details: { playerName: name, eventType: 'prediction' }
      });
    }
  } catch {
    /* ops optional */
  }
  return result;
}

async function buildPredictionPostInner({
  intel = null,
  row = null,
  playerSlug = null,
  playerName = null,
  patch = null,
  sourceLabel = null,
  intelId = null,
  skipIdentityLookup = false
} = {}) {
  let workingIntel = intel;
  let workingPatch = patch ? { ...patch } : null;
  let workingRow = row;
  let identityConfirmation = null;

  if (!skipIdentityLookup) {
    const preliminary = await resolvePredictionFields({
      intel: workingIntel,
      row: workingRow,
      playerSlug,
      playerName,
      patch: workingPatch
    });

    const autoResolver = require('./recruiting-auto-resolution');
    const resolution = await autoResolver.autoResolveIntel(
      workingIntel || {
        playerName,
        playerSlug,
        eventType: 'prediction',
        detail: workingIntel?.detail || workingRow?.detail
      },
      {
        row: workingRow,
        player: preliminary.player,
        fields: preliminary.fields,
        playerName: playerName || preliminary.fields?.playerName,
        classYear: preliminary.fields?.classYear,
        beatText: workingIntel?.detail || workingRow?.detail,
        persistNeedsResolution: Boolean(workingIntel?.fingerprint)
      }
    );

    if (resolution.nonPlayerIntel) {
      return { ok: false, skipped: true, reason: 'non_player_intel' };
    }
    if (!resolution.resolved) {
      return {
        ok: false,
        skipped: true,
        reason: 'needs_resolution',
        needs_resolution: true,
        missingAfter: resolution.missingFields || [],
        fields: preliminary.fields
      };
    }

    identityConfirmation = resolution.confirmation || null;
    workingPatch = { ...(workingPatch || {}), ...resolution.identityPatch };
    if (workingIntel && resolution.intelPatch) {
      workingIntel = { ...workingIntel, ...resolution.intelPatch, identityConfirmed: true };
    }
    if (workingRow && resolution.identityPatch) {
      workingRow = { ...workingRow, ...resolution.identityPatch };
    }
  }

  const { fields, ctx, player } = await resolvePredictionFields({
    intel: workingIntel,
    row: workingRow,
    playerSlug: playerSlug || workingPatch?.playerSlug,
    playerName,
    patch: workingPatch
  });

  const gate = validatePredictionFields(fields);
  if (!gate.ok) {
    return {
      ok: false,
      skipped: true,
      reason: 'needs_resolution',
      needs_resolution: true,
      missingAfter: gate.missing,
      fields
    };
  }

  const whyCare = buildWhyUfCare(fields, player);
  if (!whyCare) {
    return { ok: false, skipped: true, reason: 'missing_why_uf_care', fields };
  }

  const identity = buildPredictionIdentityLine(fields);
  const context = buildPredictionContextBlock(fields);
  const insider = whyCare;

  const raw = template.composeInsiderReport({ identity, context, insider });
  if (!raw || !template.hasTemplateStructure(raw)) {
    return { ok: false, skipped: true, reason: 'invalid_template', fields };
  }

  const text = template.enforceTweetLimit(raw, 280, { postKind: 'prediction', beatText: fields?.detail || null });
  if (!text || isBarePredictionLine(text)) {
    return { ok: false, skipped: true, reason: 'bare_prediction_line', fields };
  }

  return {
    ok: true,
    text,
    playerName: fields.playerName,
    context: ctx,
    postKind: 'recruiting',
    predictionFields: fields,
    templateBlocks: { identity, context, insider },
    validationMeta: {
      playerContext: ctx,
      predictionPost: true,
      insiderFromAnalyst: true,
      contextFromIntel: !!workingIntel?.detail,
      intelDetail: workingIntel?.detail || null,
      analystName: fields.analystName,
      confidencePct: fields.confidencePct,
      ufRpmPct: fields.ufRpmPct,
      identityConfirmed: !!identityConfirmation?.confirmed,
      identityConfirmationMode: identityConfirmation?.mode || null,
      identityLookupRan: !skipIdentityLookup,
      identitySources: (identityConfirmation?.matchedSources || []).map((s) => ({
        provider: s.provider,
        label: s.label,
        confidence: s.confidence
      }))
    },
    sources: [
      {
        label: fields.analystName,
        url: intel?.articleUrl || row?.articleUrl || null
      }
    ],
    sourceLabel: sourceLabel || fields.analystName
  };
}

module.exports = {
  looksLikeCityState,
  validatePredictionFields,
  resolvePredictionFields,
  buildWhyUfCare,
  buildPredictionIdentityLine,
  buildPredictionContextBlock,
  isBarePredictionLine,
  buildPredictionPost
};
