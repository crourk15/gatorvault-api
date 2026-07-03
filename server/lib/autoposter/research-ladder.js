/** Phase 3/5 — dig deeper when gates block enqueue (beat skip → research → scouting → article → evergreen). */
const { SITE_URL } = require('./discovery-core');
const { intelFingerprint } = require('../commit-fingerprint');

const LADDER_REASONS = new Set([
  'gm2_filter',
  'quality_gate',
  'policy',
  'topic_angle',
  'beat_skip',
  'generic_phrase',
  'no_identifiable_player',
  'identity_not_confirmed',
  'identity_skip',
  'non_player_intel',
  'stale_intel',
  'rewrite_failed',
  'no_player_match',
  'needs_resolution'
]);

const SKIP_TO_LADDER = {
  generic_phrase: 'quality_gate',
  no_identifiable_player: 'quality_gate',
  identity_not_confirmed: 'quality_gate',
  identity_skip: 'quality_gate',
  non_player_intel: 'quality_gate',
  beat_skip: 'quality_gate',
  stale_intel: 'policy',
  no_player_match: 'quality_gate',
  needs_resolution: 'quality_gate',
  rewrite_failed: 'quality_gate'
};

function ladderEnabled() {
  return process.env.X_AUTOPOST_RESEARCH_LADDER !== 'false';
}

function digOnFilterSkipEnabled() {
  return process.env.X_AUTOPOST_DIG_ON_FILTER_SKIP !== 'false';
}

function normalizeLadderReason(reason) {
  const key = String(reason || 'quality_gate');
  return SKIP_TO_LADDER[key] || key;
}

function logLadderEvent(details = {}) {
  try {
    require('../ops-monitor').logEvent({
      subsystem: 'autoposter:research-ladder',
      status: details.ok ? 'success' : 'skipped',
      message: details.ok ? 'research_ladder:candidate' : 'research_ladder:miss',
      details
    });
  } catch {
    /* optional */
  }
}

const ANGLES = ['fit_analysis', 'visit_intel', 'competition', 'scheme_fit', 'momentum'];

function pickAngle(used) {
  const set = new Set((used || []).map(String));
  for (const a of ANGLES) {
    if (!set.has(a)) return a;
  }
  return ANGLES[0];
}

function composeLadderPost(raw, { identity, contextLine, insider, url, angle, sourceTag }) {
  const copy = require('../x-autoposter-copy');
  const text = [identity, contextLine, insider, url].join('\n');
  const slug = raw.playerSlug || null;
  const name = raw.playerName || identity;
  const candidate = Object.assign({}, raw, {
    text,
    topic: 'recruiting',
    playerName: copy.isValidPlayerName(name) ? name : raw.playerName || null,
    playerSlug: slug,
    source: sourceTag || 'auto:research-ladder',
    intelFingerprint: intelFingerprint(
      slug || name,
      'ladder_' + (angle || 'research'),
      new Date().toISOString().slice(0, 10)
    ),
    validationMeta: Object.assign({}, raw.validationMeta || {}, {
      eliteCompose: true,
      ladderAngle: angle || 'research',
      researchLadder: true
    }),
    templateBlocks: { identity, context: contextLine, insider }
  });
  try {
    const qa = require('./recruiting-post-qa');
    if (qa.isRecruitingPlayerCandidate(candidate) && !qa.passesPublishGate(candidate)) return null;
  } catch {
    /* optional */
  }
  return candidate;
}

async function buildScoutingLadderCandidate(raw) {
  const slug = raw && raw.playerSlug;
  if (!slug) return null;
  try {
    const entry = require('../scouting-database').getEntryBySlug(slug);
    if (!entry || !entry.scoutingSummary) return null;
    const identity = raw.playerName || entry.playerName || 'Florida target';
    const contextLine = 'GV Scout read — verified evaluation on the Florida board.';
    const insider = String(entry.scoutingSummary).trim().slice(0, 140);
    const url = SITE_URL + '/vault/scouting';
    return composeLadderPost(raw, {
      identity,
      contextLine,
      insider,
      url,
      angle: 'scouting'
    });
  } catch {
    return null;
  }
}

async function buildArticleLadderCandidate(raw) {
  try {
    const fill = require('../x-autoposter-fill');
    const slug = raw && raw.playerSlug;
    const name = raw && raw.playerName;
    for (const row of fill.collectArticlePostCandidates({ limit: 8, forcePost: true })) {
      if (slug && row.playerSlug && row.playerSlug !== slug) continue;
      if (!slug && name && row.playerName && row.playerName !== name) continue;
      if (row && row.text) {
        return Object.assign({}, raw, row, {
          source: 'auto:research-ladder',
          validationMeta: Object.assign({}, row.validationMeta || {}, {
            researchLadder: true,
            ladderAngle: 'article'
          })
        });
      }
    }
  } catch {
    /* optional */
  }
  return null;
}

async function buildEliteResearchCandidate(raw) {
  const slug = raw?.playerSlug || null;
  const name = raw?.playerName || null;
  const beatText = String(raw?.text || raw?.beatText || '').trim();
  if (!beatText && !slug && !name) return null;
  try {
    const detectives = require('./detectives');
    const research = require('../x-autoposter-elite-research');
    const hints = {
      writerName: raw?.sourceLabel || raw?.sources?.[0]?.label || 'Beat intel',
      beatText
    };
    const pack = await research.researchUpdate({
      playerSlug: slug,
      playerName: name,
      beatText: beatText || null,
      sourceLabel: hints.writerName,
      eventType: raw?.sourceEventType || 'recruiting'
    });
    const resolvedName = pack?.playerName || name || null;
    const resolvedSlug = pack?.playerSlug || slug || null;
    const insider = detectives.formatResearchInsiderLine(
      pack?.breakdown?.recruitingStory,
      beatText,
      hints
    );
    if (!insider) return null;
    const contextLine = detectives.formatResearchContextLine(pack?.ufPosition, beatText, hints);
    const identity = resolvedName || 'Florida football intel';
    const url = resolvedSlug
      ? `${SITE_URL}/vault/futurecast/player/${resolvedSlug}`
      : SITE_URL;
    return composeLadderPost(
      Object.assign({}, raw, {
        playerName: resolvedName,
        playerSlug: resolvedSlug
      }),
      {
        identity,
        contextLine,
        insider,
        url,
        angle: 'elite_research'
      }
    );
  } catch {
    return null;
  }
}

async function buildDiscoveryBackfillCandidate(raw) {
  try {
    const discovery = require('./discovery-index');
    if (!discovery.discoveryEnabled || !discovery.discoveryEnabled()) return null;
    const rows = await discovery.collectAllDiscoveryCandidates({ forcePost: true, digDeeper: true });
    return rows && rows[0] ? rows[0] : null;
  } catch {
    try {
      const rows = require('./evergreen-library').collectEvergreenCandidates({ limit: 1, forcePost: true });
      return rows[0] || null;
    } catch {
      return null;
    }
  }
}

async function buildResearchLadderCandidate(raw, reason) {
  if (!ladderEnabled() || !raw) return null;
  const ladderReason = normalizeLadderReason(reason);
  if (!LADDER_REASONS.has(ladderReason) && !LADDER_REASONS.has(String(reason || ''))) return null;

  const slug = raw.playerSlug;
  const name = raw.playerName;

  if (slug || name || String(raw.text || '').length > 40) {
    const scout = await buildScoutingLadderCandidate(raw);
    if (scout) {
      logLadderEvent({ ok: true, path: 'scouting', reason, playerSlug: slug });
      return scout;
    }
    const article = await buildArticleLadderCandidate(raw);
    if (article) {
      logLadderEvent({ ok: true, path: 'article', reason, playerSlug: slug });
      return article;
    }
    const elite = await buildEliteResearchCandidate(raw);
    if (elite?.text) {
      logLadderEvent({ ok: true, path: 'elite_research', reason, playerSlug: elite.playerSlug });
      return elite;
    }
    const topicMemory = require('./topic-memory');
    const story = require('./story-memory');
    const angle = pickAngle(topicMemory.listRecentAnglesForPlayer(slug || name, story.normalizeStoryArc(raw)));
    if (!name || !slug) return null;
    const copyMod = require('../x-autoposter-copy');
    if (!copyMod.isValidPlayerName(name)) return null;
    const contextLine = 'GatorVault dig-deeper — ' + angle.replace(/_/g, ' ') + ' on the Florida board.';
    const url = `${SITE_URL}/vault/futurecast/player/${slug}`;
    const beatText = String(raw?.text || raw?.beatText || '').trim();
    const detectives = require('./detectives');
    const insider =
      detectives.formatBeatDrivenInsiderLine(
        beatText,
        { writerName: raw?.sourceLabel || raw?.sources?.[0]?.label || 'Beat intel', beatText, playerName: name },
        { playerName: name, playerSlug: slug, classYear: raw.classYear, pos: raw.pos }
      ) || null;
    if (!insider) return null;
    const idLine = ((raw.classYear ? raw.classYear + ' ' : '') + name + (raw.pos ? ' ' + raw.pos : '')).trim();
    const fallback = composeLadderPost(raw, {
      identity: idLine,
      contextLine,
      insider,
      url,
      angle
    });
    if (!fallback) return null;
    logLadderEvent({ ok: true, path: 'angle_fallback', reason, playerSlug: slug });
    return fallback;
  }

  if (ladderReason === 'quality_gate' || ladderReason === 'gm2_filter' || ladderReason === 'policy') {
    const rows = require('./evergreen-library').collectEvergreenCandidates({ limit: 1, forcePost: true });
    if (rows[0]) {
      logLadderEvent({ ok: true, path: 'evergreen', reason });
      return rows[0];
    }
  }
  return null;
}

/** When beat prefilter rejects a post, research an alternate post from beat text + vault data. */
async function buildFromBeatPostSkip(post, skipReason) {
  if (!ladderEnabled() || !digOnFilterSkipEnabled() || !post) return null;
  const text = String(post.text || post.summary || '').trim();
  if (!text) return null;
  let playerName = null;
  let playerSlug = null;
  try {
    const copy = require('../x-autoposter-copy');
    playerName = copy.extractPlayerFromText(text);
    if (playerName) playerSlug = require('../slug').slugify(playerName);
  } catch {
    /* optional */
  }
  const raw = {
    text,
    beatText: text,
    playerName,
    playerSlug,
    source: 'auto:beat-intel',
    sourceEventType: 'beat_intel',
    sourceLabel: post.writerName || post.handle || post.outlet || 'Beat',
    sources: [{ label: post.writerName || post.handle || 'Beat', url: post.url || SITE_URL }],
    sourceEventCreatedAt: post.publishedAt || new Date().toISOString(),
    sourcePublishedAt: post.publishedAt,
    validationMeta: { beatSkipReason: skipReason, researchLadder: true, eliteCompose: true }
  };
  const candidate =
    (await buildResearchLadderCandidate(raw, skipReason || 'beat_skip')) ||
    (await buildEliteResearchCandidate(raw)) ||
    (await buildDiscoveryBackfillCandidate(raw));
  if (candidate?.text) {
    logLadderEvent({
      ok: true,
      path: 'beat_post_skip',
      skipReason,
      handle: post.handle,
      playerSlug: candidate.playerSlug || playerSlug
    });
  } else {
    logLadderEvent({ ok: false, path: 'beat_post_skip', skipReason, handle: post.handle });
  }
  return candidate?.text ? candidate : null;
}

async function buildAlternateFromResearch(item) {
  return buildResearchLadderCandidate(item, 'quality_gate');
}

module.exports = {
  ladderEnabled,
  digOnFilterSkipEnabled,
  buildResearchLadderCandidate,
  buildAlternateFromResearch,
  buildScoutingLadderCandidate,
  buildArticleLadderCandidate,
  buildFromBeatPostSkip,
  buildEliteResearchCandidate
};
