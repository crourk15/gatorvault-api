/**
 * GatorVault Autoposter Voice Engine v1.1.1
 * INTEL → CONTEXT → STRATEGY → HOOK → CTA
 */
const template = require('../x-autoposter-template');
const phraseMemory = require('./voice-phrase-memory');
const paraphrase = require('./voice-paraphrase');
const signalAdapter = require('./voice-signal-adapter');
const voiceQa = require('./voice-qa');

const CHAR_LIMIT = parseInt(process.env.VOICE_CHAR_LIMIT || '280', 10);
const MAX_ATTEMPTS = parseInt(process.env.VOICE_COMPOSE_MAX_ATTEMPTS || '2', 10);

const HOOK_FALLBACK = [
  'Circle this one.',
  'Watch this name.',
  'Momentum can flip fast.',
  'Keep an eye here.',
  'Worth tracking closely.'
];

const CTA_PORTAL = [
  'Portal tracker updated on GatorVault.',
  'Portal board is live on GatorVault.'
];

const CTA_OPPONENT = [
  'Opponent scouting is live on GatorVault.',
  'Matchup notes are live on GatorVault.'
];

const CTA_BOARD = ['Full board movement is live on GatorVault.'];

function voiceEngineEnabled() {
  return process.env.X_AUTOPOST_VOICE_ENGINE !== 'false';
}

function buildIdentityLine(player, { compact = false } = {}) {
  if (!player?.name) return null;
  const parts = [];
  if (player.classYear) parts.push(String(player.classYear));
  if (player.pos) parts.push(String(player.pos).toUpperCase());
  parts.push(player.name);
  let line = parts.join(' ');
  if (!compact) {
    if (player.school) line += ` (${player.school})`;
    if (player.ranking) line += ` · On3 #${player.ranking}`;
  }
  return line.trim();
}

function formatRecruitingCta(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;
  return template.shortenUrlForDisplay(raw) || raw.replace(/^https?:\/\//i, '');
}

function buildHookLine(signal) {
  const m = signal?.metrics || {};
  const candidates = [];
  if (m.visitDate) candidates.push('Keep an eye on this window.');
  if (m.rpm != null && Number(m.rpm) >= 40) candidates.push('Circle this one.');
  if (signal.type === 'portal' || m.depthChartNote) candidates.push('Depth chart movement incoming.');
  if (signal.type === 'opponent') candidates.push('Circle this matchup.');
  candidates.push(...HOOK_FALLBACK);
  return phraseMemory.pickUniqueHook(candidates) || candidates[0];
}

function buildCtaLine(signal, mode) {
  if (mode === 'recruiting' && signal.links?.playerUrl) {
    return formatRecruitingCta(signal.links.playerUrl);
  }
  let pool = CTA_BOARD;
  if (signal.type === 'portal') pool = CTA_PORTAL;
  if (signal.type === 'opponent') pool = CTA_OPPONENT;
  return phraseMemory.pickUniqueCta(pool) || pool[0];
}

function composeBlocks(signal, mode) {
  const intel = paraphrase.paraphraseIntel(signal);
  if (!intel) throw new Error('intel_missing');

  const context = paraphrase.paraphraseUFContext(signal);
  const strategy = paraphrase.buildStrategyLine(signal);
  const hook = buildHookLine(signal);
  const cta = buildCtaLine(signal, mode);

  const identityLine = mode === 'recruiting' ? buildIdentityLine(signal.player) : null;

  return {
    identity: identityLine ? { line: identityLine } : null,
    intel,
    context,
    strategy,
    hook,
    cta
  };
}

function shortStrategyLine(strategy) {
  const s = String(strategy || '').trim();
  const rpm = s.match(/(\d+(?:\.\d+)?)%/);
  if (rpm) return `UF leads On3 RPM at ${rpm[1]}%.`;
  return template.hardTrimLine(s, 52, { sport: 'football' }) || s;
}

function shrinkBlocksForLimit(blocks, signal, mode, attempt) {
  const shrunk = {
    ...blocks,
    identity: blocks.identity ? { line: blocks.identity.line } : null
  };

  if (attempt >= 2 && mode === 'recruiting' && signal?.player) {
    shrunk.identity = { line: buildIdentityLine(signal.player, { compact: true }) };
  }
  if (attempt >= 2 && blocks.intel) {
    shrunk.intel = template.hardTrimLine(blocks.intel, 72, { sport: 'football' }) || blocks.intel;
  }
  if (attempt >= 2 && blocks.context) {
    shrunk.context = template.hardTrimLine(blocks.context, 64, { sport: 'football' }) || blocks.context;
  }
  if (attempt >= 2 && blocks.strategy) {
    shrunk.strategy = shortStrategyLine(blocks.strategy);
  }
  if (attempt >= 2) {
    shrunk.hook = 'Circle this one.';
  }
  if (String(shrunk.cta || '').startsWith('http')) {
    shrunk.cta = formatRecruitingCta(shrunk.cta);
  }
  return shrunk;
}

function joinParts(parts) {
  return parts
    .filter(Boolean)
    .map((p) => String(p).trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compressBlocksToText(blocks, mode) {
  const lines = [];
  if (mode === 'recruiting' && blocks.identity?.line) {
    lines.push(joinParts([blocks.identity.line, blocks.intel]));
  } else {
    lines.push(blocks.intel);
  }
  lines.push(blocks.context);
  lines.push(joinParts([blocks.strategy, blocks.hook, blocks.cta]));
  return lines.filter(Boolean).join('\n');
}

function aggressiveCompress(blocks, mode) {
  const lines = [];
  if (mode === 'recruiting' && blocks.identity?.line) {
    lines.push(joinParts([blocks.identity.line, blocks.intel]));
  } else {
    lines.push(blocks.intel);
  }
  lines.push(blocks.context);
  lines.push(joinParts([blocks.strategy, blocks.hook]));
  lines.push(blocks.cta);
  let text = lines.filter(Boolean).join('\n');
  if (text.length > CHAR_LIMIT) {
    text = template.enforceTweetLimit(text, CHAR_LIMIT, { sport: 'football', voiceEngine: true }) || text;
  }
  return text;
}

function withinCharLimit(text) {
  return String(text || '').length <= CHAR_LIMIT;
}

function toLegacyTemplateBlocks(blocks) {
  return {
    identity: blocks.identity?.line || null,
    context: joinParts([blocks.intel, blocks.context]),
    insider: joinParts([blocks.strategy, blocks.hook]),
    intel: blocks.intel,
    strategy: blocks.strategy,
    hook: blocks.hook,
    cta: blocks.cta
  };
}

function autoposterCompose(signal) {
  if (!signal?.event?.description && !signal?.beatText) {
    return { ok: false, skipped: true, reason: 'missing_signal' };
  }

  const mode = signalAdapter.resolveMode(signal);
  let lastQa = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      let blocks = composeBlocks(signal, mode);
      if (attempt > 1) {
        blocks = shrinkBlocksForLimit(blocks, signal, mode, attempt);
      }
      let text = compressBlocksToText(blocks, mode);
      if (!withinCharLimit(text)) {
        text = aggressiveCompress(blocks, mode);
      }
      if (!withinCharLimit(text) && attempt >= 2) {
        text =
          template.enforceTweetLimit(text, CHAR_LIMIT, { sport: 'football', voiceEngine: true }) || text;
      }
      if (!withinCharLimit(text)) {
        lastQa = { passed: false, reason: 'char_limit' };
        continue;
      }

      const legacyBlocks = toLegacyTemplateBlocks(blocks);
      const candidate = {
        text,
        playerName: signal.player?.name || null,
        playerSlug: signal.playerSlug || null,
        topic: signal.type === 'recruiting' ? 'recruiting' : signal.type,
        templateBlocks: legacyBlocks,
        validationMeta: {
          voiceEngine: true,
          voiceBlocks: blocks,
          voiceMetrics: signal.metrics,
          beatText: signal.beatText || signal.event?.description || null,
          signalType: signal.type,
          mode
        }
      };

      lastQa = voiceQa.runQualityGate(signal, blocks, text, candidate);
      if (lastQa.passed) {
        if (blocks.hook && !String(blocks.cta || '').startsWith('http')) {
          phraseMemory.recordHook(blocks.hook);
        } else if (blocks.hook) {
          phraseMemory.recordHook(blocks.hook);
        }
        if (blocks.cta && !String(blocks.cta).startsWith('http')) {
          phraseMemory.recordCta(blocks.cta);
        }

        return {
          ok: true,
          text,
          mode,
          blocks,
          templateBlocks: legacyBlocks,
          validationMeta: candidate.validationMeta,
          metadata: {
            charCount: text.length,
            attempts: attempt,
            skipped: false
          }
        };
      }
    } catch (err) {
      if (err.code === 'strategy_data_missing' || err.message === 'strategy_data_missing') {
        return { ok: false, skipped: true, reason: 'strategy_data_missing' };
      }
      if (err.message === 'intel_missing') {
        return { ok: false, skipped: true, reason: 'intel_missing' };
      }
      lastQa = { passed: false, reason: err.message };
    }
  }

  return {
    ok: false,
    skipped: true,
    reason: lastQa?.reason || 'qa_failed_after_max_attempts',
    metadata: { attempts: MAX_ATTEMPTS, skipped: true }
  };
}

function applyDetectiveOverride(signal, override = {}) {
  if (override.rpm != null && Number(override.rpm) > 0) {
    signal.metrics.rpm = Number(override.rpm);
  }
  if (override.visitDate || override.visitStart) {
    signal.metrics.visitDate = override.visitDate || override.visitStart;
  }
  if (Array.isArray(override.compSchools) && override.compSchools.length) {
    signal.metrics.compSchools = override.compSchools;
  }
  return signal;
}

async function composeFromDetectiveCase({ hints, identity, platformContext, research, detectiveOverride }) {
  if (!voiceEngineEnabled()) {
    return { ok: false, skipped: true, reason: 'voice_disabled' };
  }

  const override = detectiveOverride || hints?.metrics || {};
  const playerData = {
    ok: true,
    data: {
      name: identity?.playerName || hints?.playerName,
      playerSlug: identity?.playerSlug || hints?.playerSlug,
      pos: identity?.pos || hints?.pos,
      classYear: identity?.classYear || hints?.classYear,
      natlRank: identity?.natlRank || null
    }
  };

  const signal = signalAdapter.signalFromEliteInput(
    {
      beatText: hints?.beatText,
      intel: {
        playerName: identity?.playerName,
        playerSlug: identity?.playerSlug,
        detail: hints?.beatText,
        classYear: identity?.classYear,
        ufRpmPct: override.rpm,
        visitStart: override.visitDate || override.visitStart,
        timestamp: hints?.publishedAt
      },
      source: hints?.writerName || 'Beat'
    },
    research || {},
    playerData
  );

  applyDetectiveOverride(signal, override);

  if (platformContext?.url) {
    signal.links.playerUrl = platformContext.url;
  } else if (signal.playerSlug) {
    signal.links.playerUrl = signalAdapter.buildPlayerUrl(signal.playerSlug, {
      playerSlug: signal.playerSlug,
      eventType: research?.eventType || 'recruiting'
    });
  }

  const out = autoposterCompose(signal);
  if (!out.ok) return out;

  return {
    ok: true,
    text: out.text,
    playerName: signal.player?.name || identity?.playerName,
    playerSlug: signal.playerSlug || identity?.playerSlug,
    postKind: 'recruiting',
    templateBlocks: out.templateBlocks,
    validationMeta: {
      ...out.validationMeta,
      eliteCompose: true,
      voiceEngine: true,
      detectiveOverride: true,
      detectivesPromoted: true,
      voiceMetrics: signal.metrics
    },
    metadata: out.metadata
  };
}

async function composeFromEliteInput(input, research, playerData) {
  if (!voiceEngineEnabled()) return null;
  const signal = signalAdapter.signalFromEliteInput(input, research, playerData);

  if (research?.player?.ufRpmPct != null && signal.metrics.rpm == null) {
    signal.metrics.rpm = Number(research.player.ufRpmPct);
  }
  if (!signal.metrics.rpm && research?.on3TopTeams?.length) {
    signal.metrics.rpm = signalAdapter.parseUfRpm(research);
  }
  if (!signal.metrics.compSchools?.length) {
    signal.metrics.compSchools = signalAdapter.compSchoolsFromResearch(research);
  }

  const out = autoposterCompose(signal);
  if (!out.ok) return out;

  return {
    ok: true,
    text: out.text,
    playerName: signal.player?.name || playerData?.data?.name,
    playerSlug: signal.playerSlug || playerData?.data?.playerSlug,
    postKind: signal.type === 'recruiting' ? 'recruiting' : signal.type,
    templateBlocks: out.templateBlocks,
    validationMeta: {
      ...out.validationMeta,
      eliteCompose: true,
      voiceEngine: true,
      eliteBeatIntel: true,
      voiceMetrics: signal.metrics
    },
    metadata: out.metadata
  };
}

module.exports = {
  voiceEngineEnabled,
  autoposterCompose,
  composeFromEliteInput,
  composeFromDetectiveCase,
  applyDetectiveOverride,
  composeBlocks,
  compressBlocksToText,
  toLegacyTemplateBlocks,
  buildIdentityLine,
  CHAR_LIMIT,
  MAX_ATTEMPTS
};
