/** Detectives platform provisioning — lightweight Hub row + beat intel (no full enterPlayerIntel pipeline). */
const { SITE_URL } = require('./discovery-core');
const { intelFingerprint } = require('../commit-fingerprint');
const { slugify } = require('../slug');

function playerHasFutureCastContext(player, intelRows = []) {
  if (!player) return false;
  if (player.on3Id && (player.stars || player.natlRank || player.ufRpmPct || player.ufProbability)) return true;
  if (Number(player.ufRpmPct) > 0 || Number(player.ufProbability) > 0) return true;
  if (player.natlRank && Number(player.natlRank) > 0) return true;
  if (player.breakdown?.recruitingStory || player.scoutingSummary) return true;
  for (const row of intelRows) {
    const type = String(row?.eventType || '');
    const source = String(row?.source || '');
    if (source.includes('detectives-beat')) continue;
    if (['prediction', 'prediction_change', 'rivals_futurecast'].includes(type)) return true;
  }
  if (player.slug) {
    try { if (require('../scouting-database').getEntryBySlug(player.slug)?.scoutingSummary) return true; } catch {}
    try { const b = require('../war-room-store').getBreakdownBySlug(player.slug); if (b?.verified && b.recruitingStory) return true; } catch {}
  }
  return false;
}

function inferBeatEventType(beatText) {
  const text = String(beatText || '');
  if (/official\s+visit|\bov\b/i.test(text) && !/unofficial/i.test(text)) return 'official_visit';
  if (/unofficial\s+visit|\buv\b|on\s+campus|the\s+swamp|in\s+gainesville|friday night lights|\bfnl\b/i.test(text)) return 'unofficial_visit';
  return 'target_update';
}

function resolvePlayerPlatformUrl(slug, hasFutureCastContext) {
  if (!slug) return `${SITE_URL}/vault/recruiting`;
  if (hasFutureCastContext) return `${SITE_URL}/vault/futurecast/player/${slug}`;
  return `${SITE_URL}/vault/recruiting/player/${slug}`;
}

async function loadPlayerContext(slug) {
  if (!slug) return { player: null, intelRows: [], hasFutureCastContext: false };
  try {
    const store = require('../recruiting-store');
    const intelStore = require('../recruiting-intel-store');
    const player = await store.getPlayerBySlug(slug);
    const intelRows = player ? intelStore.getIntelForPlayer({ playerId: player.on3Id || player.id, playerSlug: slug, playerName: player.name }) || [] : [];
    return { player, intelRows, hasFutureCastContext: playerHasFutureCastContext(player, intelRows) };
  } catch {
    return { player: null, intelRows: [], hasFutureCastContext: false };
  }
}

const BEAT_ONLY_CONTEXT = {
  visit_intel: 'Campus visit window confirmed — Florida had real face time with the prospect in Gainesville.',
  rpm_board: 'UF beat momentum on a prospect the staff is actively tracking in this class.',
  scouting_read: 'Scheme fit and frame check out — Florida remains engaged on the board.',
  competition: 'Other schools are involved, but UF is still in the mix for this target.',
  momentum: 'Quiet momentum building — staff contact has picked up on this recruitment.',
  program_signal: 'Beat intel puts Florida in play on a name the board is watching.'
};
const BEAT_ONLY_INSIDER = {
  visit_intel: 'Repeat campus time is building real momentum behind the scenes.',
  rpm_board: 'Staff confidence is growing as UF pushes for separation in the leader group.',
  scouting_read: 'The next campus touchpoint could clarify where UF stands in the race.',
  competition: 'Florida likes the fit — watch whether Gainesville gets another window soon.',
  momentum: 'Position coaches have stayed active — this one is trending up quietly.',
  program_signal: 'Not a done deal yet, but UF is firmly in the conversation.'
};

function beatOnlyCopyForAngle(angle) {
  return {
    context: BEAT_ONLY_CONTEXT[angle] || BEAT_ONLY_CONTEXT.program_signal,
    insider: BEAT_ONLY_INSIDER[angle] || BEAT_ONLY_INSIDER.program_signal
  };
}

async function ensureBeatProspectOnPlatform({ identity, hints, caseItem }) {
  const name = identity?.playerName;
  const slug = identity?.playerSlug || (name ? slugify(name) : null);
  const out = {
    ok: false,
    player: null,
    intelCreated: false,
    hasFutureCastContext: false,
    wasAlreadyInPlatform: false,
    provisioned: false,
    url: `${SITE_URL}/vault/recruiting`,
    slug
  };
  if (!name || !slug) return { ...out, reason: 'missing_identity' };

  const before = await loadPlayerContext(slug);
  out.wasAlreadyInPlatform = !!before.player;
  out.hasFutureCastContext = before.hasFutureCastContext;

  try {
    await require('../player-identity-lookup').persistIdentityToPlayer({
      playerName: name,
      playerSlug: slug,
      classYear: identity.classYear || hints.classYear,
      pos: identity.pos || hints.pos,
      on3Id: identity.on3Id,
      stars: identity.stars,
      natlRank: identity.natlRank,
      ufRpmPct: identity.ufRpmPct
    });
  } catch {}

  const year = parseInt(identity.classYear || hints.classYear, 10);
  // Detectives provisions Hub directly — skip enterPlayerIntel (On3 rebuild can hang 10+ min).
  try {
    const store = require('../recruiting-store');
    const existing = await store.getPlayerBySlug(slug);
    const patch = {
      slug,
      name,
      classYear: year || existing?.classYear || identity.classYear || hints.classYear,
      pos: identity.pos || hints.pos || existing?.pos,
      category: 'target',
      status: existing?.status || 'uncommitted',
      beatWriterTracked: true,
      beatWriterSource: hints.writerName || hints.handle || 'detectives',
      detectivesCaseId: caseItem?.id || null,
      lastBeatIntelAt: new Date().toISOString()
    };
    if (existing) {
      Object.assign(patch, {
        on3Id: existing.on3Id,
        stars: existing.stars,
        natlRank: existing.natlRank,
        ufRpmPct: existing.ufRpmPct
      });
    }
    out.player = await store.upsertPlayer(patch, { subsystem: 'detectives-platform' });
    out.provisioned = true;
  } catch (err) {
    out.provisionError = err.message;
  }

  const beatText = String(hints.beatText || '').trim();
  if (beatText.length >= 20) {
    try {
      const intelStore = require('../recruiting-intel-store');
      const store = require('../recruiting-store');
      const player = (await store.getPlayerBySlug(slug)) || out.player;
      if (player) {
        const eventType = inferBeatEventType(beatText);
        const fp = intelFingerprint(
          player.on3Id || player.id || slug,
          `detectives_beat_${caseItem?.id || slug}`,
          (hints.publishedAt || new Date().toISOString()).slice(0, 10)
        );
        const intelResult = await intelStore.addIntel({
          playerId: String(player.on3Id || player.id || slug),
          playerSlug: slug,
          playerName: name,
          classYear: player.classYear || year,
          pos: identity.pos || hints.pos || player.pos,
          eventType,
          status: eventType.includes('visit') ? 'reported' : 'intel',
          timestamp: hints.publishedAt || new Date().toISOString(),
          source: 'auto:detectives-beat',
          analystName: hints.writerName || hints.handle,
          sourceHandle: hints.handle,
          sourceType: 'beat',
          detail: beatText,
          text: beatText,
          ufRelevant: true,
          fingerprint: fp,
          articleUrl: hints.url || null,
          identityConfirmed: true,
          identityConfirmationMode: 'detectives'
        });
        out.intelCreated = !!(intelResult?.created && !intelResult?.duplicate);
        try { require('../recruiting-intel-cache').invalidateRecruitingIntelCaches(); } catch {}
      }
    } catch (err) {
      out.intelError = err.message;
    }
  }

  const after = await loadPlayerContext(slug);
  out.player = after.player || out.player;
  out.hasFutureCastContext = after.hasFutureCastContext;
  out.url = resolvePlayerPlatformUrl(slug, out.hasFutureCastContext);
  out.ok = !!out.player;
  return out;
}

module.exports = {
  playerHasFutureCastContext,
  ensureBeatProspectOnPlatform,
  resolvePlayerPlatformUrl,
  loadPlayerContext,
  inferBeatEventType,
  beatOnlyCopyForAngle,
  BEAT_ONLY_CONTEXT,
  BEAT_ONLY_INSIDER
};