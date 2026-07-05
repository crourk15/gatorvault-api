/**
 * GatorVault Autoposter Voice Engine v1.1.1
 * INTEL → CONTEXT → STRATEGY → HOOK → CTA
 */
const template = require('../x-autoposter-template');
const phraseMemory = require('./voice-phrase-memory');
const paraphrase = require('./voice-paraphrase');
const signalAdapter = require('./voice-signal-adapter');
const voiceQa = require('./voice-qa');
const { blocksHaveTruncation } = require('./strategy/strategy-guard');
const { isCompleteSentence } = require('./strategy/strategy-sentences');
const pr6Rewrite = require('./rewrite');
const { appendRankingTokensToIdentity } = require('./on3-ranking-tokens');
const { getTweetCharLimit } = require('./tweet-char-limit');
const { rpmTopFromOn3TopTeams, rpmTopFromSources } = require('./rewrite/comp-sourcing');

const MAX_ATTEMPTS = parseInt(process.env.VOICE_COMPOSE_MAX_ATTEMPTS || '2', 10);

const DETECTIVE_HOOK_FALLBACKS = [
  'Circle this one.',
  'Watch this name.',
  'Keep an eye here.',
  'Worth tracking closely.',
  'Momentum can flip fast.'
];

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

function isV2Blocks(blocks) {
  return blocks?.strategyTrace?.engine === 'v2';
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
    if (player.rankingTokens) {
      line = appendRankingTokensToIdentity(line, player.rankingTokens, player.pos);
    } else if (player.ranking) {
      line += ` · On3 #${player.ranking}`;
    }
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
  const strategyPack = paraphrase.buildStrategyPack(signal);
  const isV2 = !!strategyPack?.trace?.engine;

  const intel = isV2
    ? paraphrase.buildIntelLine(signal) || paraphrase.paraphraseIntel(signal)
    : paraphrase.paraphraseIntel(signal);
  if (!intel) throw new Error('intel_missing');

  const context = paraphrase.paraphraseUFContext(signal);
  const strategy = paraphrase.buildStrategyLine(signal);
  const hook = isV2 ? null : buildHookLine(signal);
  const cta = buildCtaLine(signal, mode);

  const identityLine =
    mode === 'recruiting' ? buildIdentityLine(signal.player, { compact: isV2 }) : null;

  return {
    identity: identityLine ? { line: identityLine } : null,
    intel,
    context,
    strategy,
    hook,
    cta,
    strategyTrace: strategyPack?.trace || null
  };
}

function shortStrategyLine(strategy) {
  const s = String(strategy || '').trim();
  const rpm = s.match(/(\d+(?:\.\d+)?)%/);
  if (rpm) return `UF leads On3 RPM at ${rpm[1]}%.`;
  return template.hardTrimLine(s, 52, { sport: 'football' }) || s;
}

function shrinkBlocksForLimit(blocks, signal, mode, attempt) {
  if (isV2Blocks(blocks)) {
    const shrunk = {
      ...blocks,
      hook: null,
      identity: blocks.identity ? { line: blocks.identity.line } : null
    };
    if (attempt >= 2 && mode === 'recruiting' && signal?.player) {
      shrunk.identity = { line: buildIdentityLine(signal.player, { compact: true }) };
    }
    return shrunk;
  }

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
  if (attempt >= 2 && blocks.strategy && !blocks.strategyTrace) {
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

function compressBlocksToTextV2(blocks) {
  const lines = [];
  if (blocks.identity?.line) lines.push(blocks.identity.line);
  if (blocks.intel) lines.push(blocks.intel);
  if (blocks.context) lines.push(blocks.context);
  if (blocks.strategy) lines.push(blocks.strategy);
  if (blocks.cta) lines.push(blocks.cta);
  return lines.filter(Boolean).join('\n');
}

function compressBlocksToText(blocks, mode) {
  if (mode === 'recruiting' && isV2Blocks(blocks)) {
    return compressBlocksToTextV2(blocks);
  }

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
  if (mode === 'recruiting' && isV2Blocks(blocks)) {
    return compressBlocksToTextV2(blocks);
  }

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
  if (text.length > getTweetCharLimit()) {
    text = template.enforceTweetLimit(text, getTweetCharLimit(), { sport: 'football', voiceEngine: true }) || text;
  }
  return text;
}

function withinCharLimit(text) {
  return String(text || '').length <= getTweetCharLimit();
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

function attachPr6Shadow(signal, blocks, text, metadata = {}) {
  const runRewrite =
    pr6Rewrite.isPr6ShadowMode() ||
    pr6Rewrite.isPr6Enabled() ||
    pr6Rewrite.isPr789ShadowMode() ||
    pr6Rewrite.isPr789Enabled() ||
    pr6Rewrite.isPr789AngleShadowMode();
  if (!runRewrite) {
    return metadata;
  }

  const pr5Pack = pr6Rewrite.buildPr5PackFromBlocks(blocks, signal);
  const pr6 = pr6Rewrite.rewriteStrategyPack(pr5Pack, signal, {
    cta: blocks.cta,
    mode: pr6Rewrite.isPr6Enabled() ? 'live' : 'shadow'
  });

  const goldenBeatId = pr6Rewrite.resolveGoldenBeatId(signal);
  const pr6OnlyTweet = pr6.pr6OnlyTweet || pr6.rewrittenTweet;
  const pr6OnlyCharCount = pr6.pr6OnlyCharCount || pr6.charCount;

  const next = {
    ...metadata,
    pr6Shadow: {
      ok: pr6.ok,
      reason: pr6.reason,
      charCount: pr6OnlyCharCount,
      rewrittenTweet: pr6OnlyTweet,
      trace: pr6.trace
    }
  };

  if (pr6.pr789) {
    next.pr789Shadow = {
      ok: pr6.pr789.ok,
      reason: pr6.pr789.reason || null,
      fallback: pr6.pr789.fallback === true,
      charCount: pr6.pr789.charCount || pr6.charCount,
      rewrittenTweet: pr6.pr789.ok ? pr6.pr789.rewrittenTweet : pr6OnlyTweet,
      trace: pr6.pr789.trace || null,
      violations: pr6.pr789.violations || null
    };
  }

  if (pr6.pr789Angle) {
    next.pr789AngleShadow = {
      ok: pr6.pr789Angle.ok,
      reason: pr6.pr789Angle.reason || null,
      fallback: pr6.pr789Angle.fallback === true,
      dominantAngle: pr6.pr789Angle.dominantAngle || null,
      takeaway: pr6.pr789Angle.takeaway || null,
      charCount: pr6.pr789Angle.charCount || null,
      rewrittenTweet: pr6.pr789Angle.ok ? pr6.pr789Angle.rewrittenTweet : null,
      trace: pr6.pr789Angle.trace || null,
      violations: pr6.pr789Angle.violations || null
    };
  }

  if (pr6Rewrite.shouldUsePr6Live(signal, next.pr6Shadow)) {
    next.pr6Live = true;
    next.pr5Text = text;
    next.pr6GoldenBeat = goldenBeatId;
    if (pr6.pr789Live && pr6.pr789?.ok) {
      next.pr789Live = true;
      next.pr789GoldenBeat = goldenBeatId;
      next.pr6Text = pr6OnlyTweet;
      next.pr789Text = pr6.pr789.rewrittenTweet;
    }
    if (pr6.pr789AngleLive && pr6.pr789Angle?.ok) {
      next.pr789AngleLive = true;
      next.pr789AngleText = pr6.pr789Angle.rewrittenTweet;
    }
  }

  return next;
}

function applyPr6LiveText(signal, text, metadata = {}) {
  if (!pr6Rewrite.shouldUsePr6Live(signal, metadata.pr6Shadow)) {
    return { text, metadata };
  }
  const publishText =
    metadata.pr789AngleLive && metadata.pr789AngleText
      ? metadata.pr789AngleText
      : metadata.pr789Live && metadata.pr789Text
        ? metadata.pr789Text
        : metadata.pr6Shadow.rewrittenTweet;
  return {
    text: publishText,
    metadata: {
      ...metadata,
      pr6Live: true,
      pr5Text: text,
      pr6GoldenBeat: metadata.pr6GoldenBeat || pr6Rewrite.resolveGoldenBeatId(signal),
      ...(metadata.pr789Live
        ? {
            pr789Live: true,
            pr789GoldenBeat: metadata.pr789GoldenBeat || metadata.pr6GoldenBeat,
            pr6Text: metadata.pr6Text || metadata.pr6Shadow?.rewrittenTweet,
            pr789Text: metadata.pr789Text || metadata.pr789Shadow?.rewrittenTweet
          }
        : {}),
      ...(metadata.pr789AngleLive
        ? {
            pr789AngleLive: true,
            pr789AngleText: publishText
          }
        : {})
    }
  };
}

function autoposterCompose(signal, opts = {}) {
  if (!signal?.event?.description && !signal?.beatText) {
    return { ok: false, skipped: true, reason: 'missing_signal' };
  }

  const mode = signalAdapter.resolveMode(signal);
  if (signal?.player && signal?.beatText) {
    signal.player.pos =
      signalAdapter.resolvePlayerPos({
        beatText: signal.beatText,
        playerName: signal.player.name,
        pos: signal.player.pos
      }) || signal.player.pos;
  }
  let lastQa = null;
  const qaOpts = {
    skipHookMemory: opts.skipHookMemory === true,
    detectiveMode: opts.detectiveMode === true,
    requireFullLayers: opts.requireFullLayers === true,
    skipTemplateOverlap: opts.skipTemplateOverlap === true
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      let blocks = composeBlocks(signal, mode);
      if (opts.forcedHook) {
        blocks = { ...blocks, hook: opts.forcedHook };
      }
      if (attempt > 1) {
        blocks = shrinkBlocksForLimit(blocks, signal, mode, attempt);
      }
      let text = compressBlocksToText(blocks, mode);
      if (!withinCharLimit(text)) {
        text = aggressiveCompress(blocks, mode);
      }
      if (!withinCharLimit(text) && attempt >= 2 && !isV2Blocks(blocks)) {
        text =
          template.enforceTweetLimit(text, getTweetCharLimit(), { sport: 'football', voiceEngine: true }) || text;
      }
      if (!withinCharLimit(text)) {
        lastQa = { passed: false, reason: 'char_limit' };
        continue;
      }
      if (blocksHaveTruncation(blocks, text)) {
        lastQa = { passed: false, reason: 'truncated_copy' };
        continue;
      }
      if (
        isV2Blocks(blocks) &&
        (!isCompleteSentence(blocks.intel) ||
          !isCompleteSentence(blocks.context) ||
          !isCompleteSentence(blocks.strategy))
      ) {
        lastQa = { passed: false, reason: 'incomplete_sentence' };
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
          mode,
          strategyTrace: blocks.strategyTrace || null
        }
      };

      lastQa = voiceQa.runQualityGate(signal, blocks, text, candidate, qaOpts);
      if (lastQa.passed) {
        if (blocks.hook && !String(blocks.cta || '').startsWith('http')) {
          phraseMemory.recordHook(blocks.hook);
        } else if (blocks.hook) {
          phraseMemory.recordHook(blocks.hook);
        }
        if (blocks.cta && !String(blocks.cta).startsWith('http')) {
          phraseMemory.recordCta(blocks.cta);
        }

        const metadata = attachPr6Shadow(signal, blocks, text, {
          charCount: text.length,
          attempts: attempt,
          skipped: false
        });
        const live = applyPr6LiveText(signal, text, metadata);

        return {
          ok: true,
          text: live.text,
          mode,
          blocks,
          templateBlocks: legacyBlocks,
          validationMeta: candidate.validationMeta,
          metadata: live.metadata
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
    metadata: { attempts: MAX_ATTEMPTS, skipped: true, qaReasons: lastQa?.reasons || [] }
  };
}

function composeWithDetectiveHookRetry(signal, opts = {}) {
  let out = autoposterCompose(signal, {
    requireFullLayers: true,
    detectiveMode: true,
    skipTemplateOverlap: opts.skipTemplateOverlap === true
  });
  if (out.ok) return out;

  const hookFailure =
    out.reason === 'invalid_hook' ||
    (Array.isArray(out.metadata?.qaReasons) && out.metadata.qaReasons.includes('invalid_hook'));
  if (!hookFailure) return out;

  for (const hook of DETECTIVE_HOOK_FALLBACKS) {
    out = autoposterCompose(signal, {
      forcedHook: hook,
      skipHookMemory: true,
      detectiveMode: true,
      requireFullLayers: true,
      skipTemplateOverlap: opts.skipTemplateOverlap === true
    });
    if (out.ok) {
      return {
        ...out,
        metadata: { ...(out.metadata || {}), hookRetry: hook }
      };
    }
  }
  return out;
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
  if (Array.isArray(override.rpmTop) && override.rpmTop.length) {
    signal.metrics.rpmTop = override.rpmTop;
  }
  if (override.beatFacts) signal.metrics.beatFacts = override.beatFacts;
  if (override.intelligence) signal.metrics.intelligence = override.intelligence;
  if (override.rankingTokens && signal.player) {
    signal.player.rankingTokens = override.rankingTokens;
    signal.player.ranking = override.rankingTokens.on3NationalRank;
    signal.player.stars = signal.player.stars || override.rankingTokens.on3Stars;
  }
  return signal;
}

async function hydrateRpmTopMetrics(signal, { research, playerData, override, input } = {}) {
  if (Array.isArray(signal.metrics?.rpmTop) && signal.metrics.rpmTop.length >= 2) return;

  const classYear =
    signal.player?.classYear || playerData?.data?.classYear || research?.player?.classYear || 2028;
  const player = playerData?.data || research?.player || {};
  const intel = override?.intelligence || input?.intel || signal.metrics?.intelligence || null;

  if (Array.isArray(override?.rpmTop) && override.rpmTop.length) {
    signal.metrics.rpmTop = override.rpmTop;
    return;
  }

  const fromOn3 = rpmTopFromOn3TopTeams(
    research?.on3TopTeams || player.on3TopTeams || player.topTeams || [],
    classYear
  );
  if (fromOn3.length >= 2) {
    signal.metrics.rpmTop = fromOn3;
    return;
  }

  const fromStore = rpmTopFromSources({}, { competitors: player.competitors || research?.player?.competitors });
  if (fromStore.length >= 2) {
    signal.metrics.rpmTop = fromStore;
    return;
  }

  const fromIntel = rpmTopFromSources(signal.metrics, intel);
  if (fromIntel.length >= 2) {
    signal.metrics.rpmTop = fromIntel;
    return;
  }

  const slug = signal.playerSlug || player.playerSlug || research?.playerSlug;
  try {
    const golden = require('../player-intelligence/golden-four-on3');
    if (!golden.isGoldenProdSlug(slug)) return;
    const store = require('../recruiting-store');
    const row = await store.getPlayerBySlug(slug);
    const fromPlayer = rpmTopFromSources({}, { competitors: row?.competitors });
    if (fromPlayer.length >= 2) {
      signal.metrics.rpmTop = fromPlayer;
      return;
    }
    const recruitSlug = golden.on3RecruitSlugFor(slug);
    if (!recruitSlug) return;
    const on3Recruit = require('../on3-recruit-client');
    const profile = await on3Recruit.fetchRecruitProfile(recruitSlug, classYear);
    const rpmTop = rpmTopFromOn3TopTeams(profile?.topTeams || [], classYear);
    if (rpmTop.length >= 2) signal.metrics.rpmTop = rpmTop;
  } catch {
    /* optional golden-four On3 pull */
  }
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
      stars: identity?.stars || null,
      natlRank: identity?.natlRank || null,
      posRank: identity?.posRank || null,
      stateRank: identity?.stateRank || null,
      rankingTokens: override.rankingTokens || identity?.rankingTokens || null
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
  await hydrateRpmTopMetrics(signal, { research, playerData, override, input: { intel: { detail: hints?.beatText } } });

  if (signal.player) {
    signal.player.pos =
      signalAdapter.resolvePlayerPos({
        beatText: hints?.beatText,
        playerName: signal.player.name,
        pos: signal.player.pos || identity?.pos
      }) || signal.player.pos;
    const yearMatch = String(hints?.beatText || '').match(/\b(20(?:2[6-9]|3[0-2]))\b/);
    if (yearMatch && !signal.player.classYear) {
      signal.player.classYear = parseInt(yearMatch[1], 10);
    }
  }

  if (platformContext?.url) {
    signal.links.playerUrl = platformContext.url;
  } else if (signal.playerSlug) {
    signal.links.playerUrl = signalAdapter.buildPlayerUrl(signal.playerSlug, {
      playerSlug: signal.playerSlug,
      eventType: research?.eventType || 'recruiting'
    });
  }

  const out = composeWithDetectiveHookRetry(signal);
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
      voiceMetrics: {
        ...signal.metrics,
        rankingTokens: override.rankingTokens || signal.player?.rankingTokens || null
      }
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
  await hydrateRpmTopMetrics(signal, { research, playerData, input });

  const out = voiceRequiredForRecruiting()
    ? composeWithDetectiveHookRetry(signal)
    : autoposterCompose(signal);
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

function voiceRequiredForRecruiting() {
  return voiceEngineEnabled() && process.env.X_AUTOPOST_VOICE_REQUIRED !== 'false';
}

module.exports = {
  voiceEngineEnabled,
  voiceRequiredForRecruiting,
  autoposterCompose,
  composeWithDetectiveHookRetry,
  composeFromEliteInput,
  composeFromDetectiveCase,
  applyDetectiveOverride,
  composeBlocks,
  compressBlocksToText,
  toLegacyTemplateBlocks,
  buildIdentityLine,
  get CHAR_LIMIT() {
    return getTweetCharLimit();
  },
  MAX_ATTEMPTS
};
