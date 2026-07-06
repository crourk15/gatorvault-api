/**
 * Hard publish gate for recruiting player posts — blocks generic / no-identity copy.
 */
const copy = require('../x-autoposter-copy');
const template = require('../x-autoposter-template');
const validation = require('../x-autoposter-validation');
const { validateBannedPhrases } = require('./rewrite/fact-gates');

const GENERIC_PROSPECT_COPY_RE = [
  /the prospect is on uf's board/i,
  /quietly gaining traction here as the staff keeps the relationship active/i,
  /staff is tracking this 20\d{2} target/i,
  /staff is tracking this target/i,
  /florida is quietly gaining traction here/i,
  /face time with the prospect in gainesville/i,
  /campus visit window confirmed — florida had real face time with (?:the prospect|this target)/i,
  /beat intel confirmed uf football context/i,
  /failed first-pass filters/i,
  /beat trail and player profile on recruiting hub/i,
  /board analysis and futurecast breakdown rebuilt from beat signal/i,
  /gatorvault detectives/i,
  /signal verified on a florida recruiting target/i,
  /logged a campus visit window/i,
  /^florida recruiting intel$/im,
  /full rpm, visit intel, and predictions on futurecast/i,
  /florida is actively tracking — more clarity expected soon/i,
  /repeat campus time is building real momentum behind the scenes/i,
  /staff face time at camp visits is building real momentum/i,
  /position coaches are staying active — this one is trending up quietly/i,
  /repeat face time is building real momentum behind the scenes/i,
  /another campus touch could clarify where uf stands in the race/i,
  /^uf is active with .+ in this cycle\.?$/im,
  /per multiple reports,.+monitoring/i,
  /florida program update:.+monitoring/i,
  /staff contact has picked up/i,
  /florida scout file on .* matches the beat momentum/i
];

const BEAT_STOPWORDS = new Set([
  'florida', 'gators', 'gator', 'staff', 'coaches', 'coach', 'visit', 'campus', 'recruiting',
  'target', 'prospect', 'class', 'school', 'high', 'academy', 'along', 'with', 'also', 'their',
  'about', 'after', 'before', 'being', 'between', 'during', 'through', 'where', 'which', 'while'
]);

const BEAT_ANCHOR_RE =
  /\b(swamp|gainesville|fnl|friday night lights|official visit|unofficial visit|rpm|decision day|on campus|the swamp|woodward|ballinger|sumrall|offer(?:ed|s)?|commit(?:ted|ment)?|flip(?:ped)?)\b/i;

const YEAR_ONLY_IDENTITY_RE = /^20\d{2}\.?$/;
const YEAR_LEAD_NO_NAME_RE = /^20\d{2}(?:\s+(?:DL|QB|RB|WR|TE|OL|OT|OG|C|EDGE|LB|CB|S|ATH|K|P))?\s*$/i;

function firstLine(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)[0] || '';
}

function isRecruitingPlayerCandidate(raw) {
  if (!raw) return false;
  if (raw.triggerType === 'program_news' || raw.triggerType === 'team_event') return false;
  if (raw.topic && raw.topic !== 'recruiting') return false;
  const src = String(raw.source || '');
  if (/program-news|team-event|uf-official|heat-pulse|evergreen|article/.test(src)) return false;
  return (
    raw.topic === 'recruiting' ||
    src.includes('detectives') ||
    src.includes('beat-intel') ||
    src.includes('research-ladder') ||
    !!raw.playerSlug ||
    !!raw.playerName ||
    raw.validationMeta?.detectivesResolved ||
    raw.validationMeta?.researchLadder
  );
}

function identityLineValid(identityLine, playerName) {
  const line = String(identityLine || '').trim();
  if (!line || line.length < 8) return false;
  if (YEAR_ONLY_IDENTITY_RE.test(line)) return false;
  if (YEAR_LEAD_NO_NAME_RE.test(line)) return false;
  if (!copy.isValidPlayerName(playerName)) return false;
  const last = String(playerName).trim().split(/\s+/).pop();
  if (!last || !new RegExp(`\\b${last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(line)) {
    return false;
  }
  return true;
}

function hasGenericProspectCopy(text) {
  const t = String(text || '');
  return GENERIC_PROSPECT_COPY_RE.some((re) => re.test(t));
}

function beatTokens(beatText) {
  const beat = String(beatText || '').toLowerCase();
  const tokens = new Set();
  for (const m of beat.matchAll(/\b[a-z][a-z'-]{3,}\b/g)) {
    const w = m[0];
    if (!BEAT_STOPWORDS.has(w)) tokens.add(w);
  }
  return [...tokens];
}

/** Beat-sourced posts must anchor to beat facts — not template filler. */
function hasBeatAnchoredCopy(context, insider, beatText, meta = {}) {
  if (!beatText || !String(beatText).trim()) return true;
  if (meta.eliteBeatIntel || meta.eliteDigest || meta.beatIntelAngle) return true;
  const combined = `${context || ''} ${insider || ''}`.toLowerCase();
  if (BEAT_ANCHOR_RE.test(combined)) return true;
  let hits = 0;
  for (const token of beatTokens(beatText)) {
    if (combined.includes(token)) {
      hits += 1;
      if (hits >= 2) return true;
    }
  }
  return false;
}

function passesVoicePublishGate(raw) {
  if (!raw?.validationMeta?.voiceEngine) return false;
  const text = String(raw.text || '').trim();
  if (!text || text.length < 40) return false;
  if (copy.isBrokenCopy(text, raw)) return false;
  if (hasGenericProspectCopy(text)) return false;

  const blocks = raw.validationMeta?.voiceBlocks || {};
  const playerName = raw.playerName || raw.templateBlocks?.playerName || null;
  if (playerName && !copy.isValidPlayerName(playerName)) return false;
  if (playerName && !copy.postReferencesPlayerName(text, playerName)) return false;

  if (raw.topic === 'recruiting' && playerName) {
    const identity = raw.templateBlocks?.identity || blocks.identity?.line;
    if (identity && !identityLineValid(identity, playerName)) return false;
    if (!/\/player\/|futurecast\/player\//i.test(text)) return false;
  }

  const pr789AnglePost =
    raw.validationMeta?.pr789AngleLive === true ||
    raw.validationMeta?.eliteBeatIntel === true ||
    raw.validationMeta?.fusedIntelCompose === true ||
    raw.validationMeta?.goldenFourFactCompose === true ||
    String(raw.validationMeta?.publishTier || '').startsWith('pr789_angle');
  if (pr789AnglePost) return true;

  try {
    const voiceQa = require('./voice-qa');
    const signal = {
      type: raw.validationMeta?.signalType || 'recruiting',
      beatText: raw.validationMeta?.beatText,
      event: { description: raw.validationMeta?.beatText },
      metrics: raw.validationMeta?.voiceMetrics || {},
      player: playerName ? { name: playerName } : null
    };
    const pr789AnglePost =
      raw.validationMeta?.pr789AngleLive === true ||
      raw.validationMeta?.eliteBeatIntel === true ||
      raw.validationMeta?.fusedIntelCompose === true ||
      raw.validationMeta?.goldenFourFactCompose === true ||
      String(raw.validationMeta?.publishTier || '').startsWith('pr789_angle');
    const gate = voiceQa.runQualityGate(signal, blocks, text, raw, {
      requireFullLayers: !pr789AnglePost,
      // Compose already validated phrase memory and may have recorded hook/cta.
      skipHookMemory: true,
      skipCtaMemory: true,
      // Do not block send against sibling pending queue rows with shared boilerplate.
      overlapSentOnly: true
    });
    if (!gate.passed) return false;
  } catch {
    return false;
  }

  return true;
}

function voiceEngineRequired(raw) {
  if (process.env.X_AUTOPOST_VOICE_ENGINE === 'false') return false;
  if (process.env.X_AUTOPOST_VOICE_REQUIRED === 'false') return false;
  if (!isRecruitingPlayerCandidate(raw)) return false;
  if (raw.verifiedCommit || raw.validationMeta?.verifiedCommit) return false;
  if (raw.commitElite || raw.validationMeta?.commitElite) return false;
  if (raw.validationMeta?.voiceEngine) return false;
  return true;
}

function passesPublishGate(raw) {
  if (!raw?.text) return false;
  if (!validateBannedPhrases(raw.text).ok) return false;
  if (voiceEngineRequired(raw)) return passesVoicePublishGate(raw);
  if (raw?.validationMeta?.voiceEngine) return passesVoicePublishGate(raw);
  const text = String(raw.text || '').trim();
  if (!text || !template.hasTemplateStructure(text)) return false;
  if (copy.isBrokenCopy(text, raw)) return false;
  if (hasGenericProspectCopy(text)) return false;
  if (copy.isGenericRecruitingHubUrl(text)) return false;

  const playerName = raw.playerName || raw.templateBlocks?.playerName || null;
  if (!copy.isValidPlayerName(playerName)) return false;
  if (!copy.postReferencesPlayerName(text, playerName)) return false;

  const identity = raw.templateBlocks?.identity || firstLine(text);
  if (!identityLineValid(identity, playerName)) return false;

  if (!/\/player\/|futurecast\/player\//i.test(text)) return false;

  const blocks = raw.templateBlocks || validation.parseTemplateBlocks({ text }) || {};
  const context = String(blocks.context || '').trim();
  const insider = String(blocks.insider || '').trim();
  if (!context || context.length < 28) return false;
  if (!insider || insider.length < 24) return false;
  if (hasGenericProspectCopy(`${context}\n${insider}`)) return false;

  const beatText = raw.validationMeta?.beatText || raw.beatText || null;
  const meta = raw.validationMeta || {};
  if (
    beatText &&
    !hasBeatAnchoredCopy(context, insider, beatText, meta)
  ) {
    return false;
  }

  try {
    const brand = require('../x-autoposter-brand');
    if (brand.isMonitoringFallbackCopy(raw.text)) return false;
  } catch {
    /* optional */
  }

  return true;
}

function rejectReason(raw) {
  if (!raw?.text) return 'missing_text';
  if (voiceEngineRequired(raw) && !passesVoicePublishGate(raw)) {
    return 'voice_required';
  }
  if (raw?.validationMeta?.voiceEngine && !passesVoicePublishGate(raw)) {
    try {
      const voiceQa = require('./voice-qa');
      const blocks = raw.validationMeta?.voiceBlocks || {};
      const gate = voiceQa.runQualityGate(
        {
          type: raw.validationMeta?.signalType,
          beatText: raw.validationMeta?.beatText,
          event: { description: raw.validationMeta?.beatText },
          metrics: raw.validationMeta?.voiceMetrics || {}
        },
        blocks,
        raw.text,
        raw,
        { requireFullLayers: true, skipHookMemory: true, skipCtaMemory: true, overlapSentOnly: true }
      );
      return gate.reason || 'voice_qa';
    } catch {
      return 'voice_qa';
    }
  }
  if (hasGenericProspectCopy(raw.text)) return 'generic_prospect_copy';
  if (copy.isGenericRecruitingHubUrl(raw.text)) return 'generic_hub_url';
  if (!copy.isValidPlayerName(raw.playerName)) return 'invalid_player_name';
  if (!copy.postReferencesPlayerName(raw.text, raw.playerName)) return 'player_not_in_body';
  const identity = raw.templateBlocks?.identity || firstLine(raw.text);
  if (!identityLineValid(identity, raw.playerName)) return 'invalid_identity_line';
  if (copy.isBrokenCopy(raw.text, raw)) return 'broken_copy';
  const blocks = raw.templateBlocks || {};
  const beatText = raw.validationMeta?.beatText || raw.beatText || null;
  if (
    beatText &&
    !hasBeatAnchoredCopy(blocks.context, blocks.insider, beatText, raw.validationMeta || {})
  ) {
    return 'missing_beat_anchor';
  }
  return 'recruiting_qa';
}

module.exports = {
  GENERIC_PROSPECT_COPY_RE,
  isRecruitingPlayerCandidate,
  identityLineValid,
  hasGenericProspectCopy,
  hasBeatAnchoredCopy,
  passesPublishGate,
  passesVoicePublishGate,
  voiceEngineRequired,
  rejectReason
};
