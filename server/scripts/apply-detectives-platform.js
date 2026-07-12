/**
 * Writes UTF-8 detectives.js + detectives-platform.js (OneDrive-safe).
 * Run: node server/scripts/apply-detectives-platform.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'lib', 'autoposter');

const platformJs = `/** Detectives platform provisioning — ensure beat-picked prospects exist before queue compose. */
const { SITE_URL } = require('./discovery-core');
const { intelFingerprint } = require('../commit-fingerprint');
const { slugify } = require('../slug');

function playerHasFutureCastContext(player, intelRows = []) {
  if (!player) return false;
  if (player.on3Id && (player.stars || player.natlRank || player.ufRpmPct || player.ufProbability)) {
    return true;
  }
  if (Number(player.ufRpmPct) > 0 || Number(player.ufProbability) > 0) return true;
  if (player.natlRank && Number(player.natlRank) > 0) return true;
  if (player.breakdown?.recruitingStory || player.scoutingSummary) return true;
  for (const row of intelRows) {
    const type = String(row?.eventType || '');
    if (
      type === 'prediction' ||
      type === 'prediction_change' ||
      type === 'rivals_futurecast' ||
      type === 'official_visit' ||
      type === 'unofficial_visit'
    ) {
      return true;
    }
  }
  if (player.slug) {
    try {
      const entry = require('../scouting-database').getEntryBySlug(player.slug);
      if (entry?.scoutingSummary) return true;
    } catch {}
    try {
      const breakdown = require('../war-room-store').getBreakdownBySlug(player.slug);
      if (breakdown?.verified && breakdown.recruitingStory) return true;
    } catch {}
  }
  return false;
}

function inferBeatEventType(beatText) {
  const text = String(beatText || '');
  if (/official\\s+visit|\\bov\\b/i.test(text) && !/unofficial/i.test(text)) return 'official_visit';
  if (/unofficial\\s+visit|\\buv\\b|on\\s+campus|the\\s+swamp|in\\s+gainesville/i.test(text)) {
    return 'unofficial_visit';
  }
  return 'target_update';
}

function resolvePlayerPlatformUrl(slug, hasFutureCastContext) {
  if (!slug) return \`\${SITE_URL}/vault/recruiting\`;
  if (hasFutureCastContext) return \`\${SITE_URL}/vault/futurecast/player/\${slug}\`;
  return \`\${SITE_URL}/vault/recruiting/player/\${slug}\`;
}

async function loadPlayerContext(slug) {
  if (!slug) return { player: null, intelRows: [], hasFutureCastContext: false };
  try {
    const store = require('../recruiting-store');
    const intelStore = require('../recruiting-intel-store');
    const player = await store.getPlayerBySlug(slug);
    const intelRows = player
      ? intelStore.getIntelForPlayer({
          playerId: player.on3Id || player.id,
          playerSlug: slug,
          playerName: player.name
        }) || []
      : [];
    return {
      player,
      intelRows,
      hasFutureCastContext: playerHasFutureCastContext(player, intelRows)
    };
  } catch {
    return { player: null, intelRows: [], hasFutureCastContext: false };
  }
}

const BEAT_ONLY_CONTEXT = {
  visit_intel: 'GatorVault Detectives — beat visit signal confirmed for this Florida target.',
  rpm_board: 'GatorVault Detectives — UF beat signal on a prospect we are tracking.',
  scouting_read: 'GatorVault Detectives — beat cross-check logged on Recruiting Hub.',
  competition: 'GatorVault Detectives — competing schools noted; Florida remains in play.',
  momentum: 'GatorVault Detectives — momentum signal from trusted UF beat intel.',
  program_signal: 'GatorVault Detectives — beat signal verified as UF recruiting intel.'
};

const BEAT_ONLY_INSIDER = {
  visit_intel: 'Visit trail and beat notes on Recruiting Hub — board build in progress.',
  rpm_board: 'Beat intel logged — FutureCast board populates once profile syncs.',
  scouting_read: 'Scout file and beat trail tracked on Recruiting Hub.',
  competition: 'School list and beat context on Recruiting Hub.',
  momentum: 'Heat check starts from beat signal on Recruiting Hub.',
  program_signal: 'Player profile and beat intel on Recruiting Hub.'
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
    url: \`\${SITE_URL}/vault/recruiting\`,
    slug
  };
  if (!name || !slug) return { ...out, reason: 'missing_identity' };

  const before = await loadPlayerContext(slug);
  out.wasAlreadyInPlatform = !!before.player;
  out.hasFutureCastContext = before.hasFutureCastContext;

  try {
    const identityLookup = require('../player-identity-lookup');
    await identityLookup.persistIdentityToPlayer({
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
  if (Number.isFinite(year) && year >= 2027 && year <= 2030) {
    try {
      const { enterPlayerIntel } = require('../player-intel-entry');
      await enterPlayerIntel({ name, classYear: year, offer: false, rebuildSnapshots: false });
      out.provisioned = true;
    } catch {}
  }

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
  } catch {}

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
          \`detectives_beat_\${caseItem?.id || slug}\`,
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
        try {
          require('../recruiting-intel-cache').invalidateRecruitingIntelCaches();
        } catch {}
      }
    } catch {}
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
`;

const detectivesJs = `/** GatorVault Detectives — research filter-failed beat intel and re-queue. */
const { SITE_URL } = require('./discovery-core');
const { intelFingerprint } = require('../commit-fingerprint');
const store = require('./detectives-store');
const platform = require('./detectives-platform');

const DEDUPE_SKIP_REASONS = new Set([
  'duplicate_fingerprint',
  'duplicate_commit',
  'duplicate_text',
  'similar_post',
  'ladder_cycle',
  'invalid_candidate'
]);

const ANGLES = [
  'visit_intel',
  'rpm_board',
  'scouting_read',
  'competition',
  'momentum',
  'program_signal'
];

function detectivesEnabled() {
  return process.env.X_AUTOPOST_DETECTIVES_ENABLED !== 'false';
}

function logDetectives(d = {}) {
  try {
    require('../ops-monitor').logEvent({
      subsystem: 'autoposter:detectives',
      status: d.ok ? 'success' : d.status || 'skipped',
      message: d.ok ? 'detectives:resolved' : 'detectives:' + (d.phase || 'event'),
      details: d
    });
  } catch {}
}

function beatTextFromCase(c) {
  const beat = c?.beatPost || {};
  const cand = c?.candidate || {};
  return String(beat.text || beat.summary || cand.beatText || cand.text || cand.triggerPhrase || '').trim();
}

function extractHints(caseItem) {
  const beat = caseItem?.beatPost || {};
  const cand = caseItem?.candidate || {};
  const text = beatTextFromCase(caseItem);
  let playerName = cand.playerName || caseItem?.hints?.playerName || null;
  let playerSlug = cand.playerSlug || caseItem?.hints?.playerSlug || null;
  let classYear = cand.classYear || caseItem?.hints?.classYear || null;
  try {
    const copy = require('../x-autoposter-copy');
    if (!playerName && text) playerName = copy.extractPlayerFromText(text);
    if (playerName && !playerSlug) playerSlug = require('../slug').slugify(playerName);
  } catch {}
  const m = text.match(/\\b(20(?:2[6-9]|3[0-2]))\\b/);
  if (!classYear && m) classYear = parseInt(m[1], 10);
  return {
    beatText: text,
    playerName,
    playerSlug,
    classYear,
    handle: beat.handle || caseItem?.hints?.handle || null,
    writerName: beat.writerName || beat.outlet || caseItem?.hints?.writerName || null,
    url: beat.url || cand.sources?.[0]?.url || null,
    publishedAt: beat.publishedAt || cand.sourcePublishedAt || null,
    skipReason: caseItem?.skipReason || null,
    triggerPhrase: cand.triggerPhrase || text.slice(0, 160),
    pos: cand.pos || caseItem?.hints?.pos || null
  };
}

async function resolveIdentity(hints) {
  const out = {
    playerName: hints.playerName,
    playerSlug: hints.playerSlug,
    classYear: hints.classYear,
    sources: []
  };
  try {
    const lookup = require('../player-identity-lookup');
    const resolved = await lookup.enrichAndConfirmIntelIdentity({
      playerName: hints.playerName,
      beatText: hints.beatText,
      classYear: hints.classYear,
      intel: { detail: hints.beatText, playerName: hints.playerName }
    });
    if (resolved?.confirmed && resolved.mergedSnapshot) {
      out.playerName = resolved.mergedSnapshot.playerName || out.playerName;
      out.playerSlug = resolved.mergedSnapshot.playerSlug || out.playerSlug;
      out.classYear = resolved.mergedSnapshot.classYear || out.classYear;
      out.pos = resolved.mergedSnapshot.pos || hints.pos;
      out.on3Id = resolved.mergedSnapshot.on3Id;
      out.stars = resolved.mergedSnapshot.stars;
      out.natlRank = resolved.mergedSnapshot.natlRank;
      out.ufRpmPct = resolved.mergedSnapshot.ufRpmPct;
      out.sources.push('intel-identity-lookup');
    } else if (resolved?.mergedSnapshot?.playerName) {
      out.playerName = resolved.mergedSnapshot.playerName;
      out.playerSlug = resolved.mergedSnapshot.playerSlug || out.playerSlug;
    }
  } catch {}
  if (!out.playerSlug && out.playerName) {
    try {
      const auto = require('../recruiting-auto-resolution');
      const pack = await auto.autoResolveRecruitingIntel({
        playerName: out.playerName,
        beatText: hints.beatText,
        classYear: hints.classYear
      });
      if (pack?.resolved && pack.mergedSnapshot) {
        out.playerSlug = pack.mergedSnapshot.playerSlug || pack.playerSlug;
        out.playerName = pack.mergedSnapshot.playerName || out.playerName;
        out.sources.push('auto-resolution');
      }
    } catch {}
  }
  return out;
}

function finalizeDetectivesText(text) {
  try {
    const template = require('../x-autoposter-template');
    return (
      template.enforceTweetLimit(String(text || ''), 280, { eliteMode: true, postKind: 'detectives' }) ||
      String(text || '').slice(0, 280)
    );
  } catch {
    return String(text || '').slice(0, 280);
  }
}

function markDetectivesCandidate(raw, caseItem, pathTag, hints, platformContext) {
  const ts = new Date().toISOString();
  const slug = raw.playerSlug || hints.playerSlug || null;
  const name = raw.playerName || hints.playerName || null;
  const fp = intelFingerprint(caseItem.id, 'detectives_' + (pathTag || 'resolved'), ts.slice(0, 10));
  const text = finalizeDetectivesText(raw.text);
  const beatDrivenOnly = !!(platformContext && !platformContext.hasFutureCastContext);
  return Object.assign({}, raw, {
    text,
    playerName: name,
    playerSlug: slug,
    intelFingerprint: raw.intelFingerprint || fp,
    identityConfirmed: raw.identityConfirmed !== false,
    sourceEventCreatedAt: raw.sourceEventCreatedAt || ts,
    sourcePublishedAt: raw.sourcePublishedAt || ts,
    qualityScore: Math.max(raw.qualityScore ?? 0, 88),
    sourceConfidence: Math.max(raw.sourceConfidence ?? 0, 85),
    source: raw.source || 'auto:detectives',
    validationMeta: Object.assign({}, raw.validationMeta || {}, {
      detectivesResolved: true,
      detectivesCaseId: caseItem.id,
      detectivesPath: pathTag,
      eliteCompose: true,
      beatText: hints.beatText,
      beatSkipReason: caseItem.skipReason,
      platformPlayerReady: !!platformContext?.hasFutureCastContext,
      beatDrivenOnly,
      platformUrl: platformContext?.url || null,
      platformProvisioned: !!(platformContext?.provisioned || platformContext?.intelCreated),
      beatWriterTracked: true
    })
  });
}

function buildBeatDrivenCandidate(caseItem, hints, identity, platformContext) {
  const name = identity.playerName;
  const slug = identity.playerSlug;
  const cy = identity.classYear ? identity.classYear + ' ' : '';
  const pos = identity.pos ? ' ' + identity.pos : '';
  const idLine = (cy + name + pos).trim() || 'Florida recruiting intel';
  const writer = hints.writerName || 'UF beat';
  const contextLine = \`GatorVault Detectives — \${writer} signal verified on a Florida recruiting target.\`;
  const snippet = String(hints.beatText || '')
    .replace(/\\s+/g, ' ')
    .trim()
    .slice(0, 120);
  const insiderLine =
    snippet.length >= 40
      ? \`Beat read: \${snippet}\${snippet.length >= 120 ? '…' : ''}\`
      : 'Player profile and beat intel on Recruiting Hub.';
  const url = platformContext?.url || platform.resolvePlayerPlatformUrl(slug, false);
  return markDetectivesCandidate(
    {
      text: [idLine, contextLine, insiderLine, url].join('\\n'),
      category: 'news',
      topic: 'recruiting',
      urgencyLabel: 'major_beat',
      sourceEventType: 'detectives_beat_driven',
      sources: [
        { label: 'On3', url: SITE_URL },
        { label: hints.writerName || 'Beat', url: hints.url || SITE_URL }
      ],
      templateBlocks: { identity: idLine, context: contextLine, insider: insiderLine }
    },
    caseItem,
    'beat_driven',
    hints,
    platformContext
  );
}

function buildGuaranteeCandidate(caseItem, hints, identity, angleIndex = 0, platformContext) {
  const angle = ANGLES[angleIndex % ANGLES.length];
  const name = identity.playerName;
  const slug = identity.playerSlug;
  const cy = identity.classYear ? identity.classYear + ' ' : '';
  const pos = identity.pos ? ' ' + identity.pos : '';
  const beatDrivenOnly = !!(platformContext && !platformContext.hasFutureCastContext);

  if (name && slug) {
    const idLine = (cy + name + pos).trim();
    let contextLine;
    let insiderLine;
    let url;

    if (beatDrivenOnly) {
      const copy = platform.beatOnlyCopyForAngle(angle);
      contextLine = copy.context;
      insiderLine = copy.insider;
      url = platformContext.url || platform.resolvePlayerPlatformUrl(slug, false);
    } else {
      const ctx = {
        visit_intel: 'GatorVault Detectives — visit window confirmed for this Florida target.',
        rpm_board: 'GatorVault Detectives — RPM board read shows Florida in the mix.',
        scouting_read: 'GatorVault Detectives — scout cross-check aligns with FutureCast.',
        competition: 'GatorVault Detectives — competing schools tracked; Florida remains active.',
        momentum: 'GatorVault Detectives — momentum building on the Florida board.',
        program_signal: 'GatorVault Detectives — beat signal verified as UF recruiting intel.'
      };
      const ins = {
        visit_intel: 'OV timing and prediction shift live on FutureCast.',
        rpm_board: 'Full RPM percentages updated on FutureCast.',
        scouting_read: 'GV scout evaluation posted on the board.',
        competition: 'Leaderboard and flip risk tracked on FutureCast.',
        momentum: 'Heat check and staff priority read on FutureCast.',
        program_signal: 'Player profile and visit log on FutureCast.'
      };
      contextLine = ctx[angle] || ctx.program_signal;
      insiderLine = ins[angle] || ins.program_signal;
      url = SITE_URL + '/vault/futurecast/player/' + slug;
    }

    return markDetectivesCandidate(
      {
        text: [idLine, contextLine, insiderLine, url].join('\\n'),
        category: 'news',
        topic: 'recruiting',
        urgencyLabel: 'major_beat',
        sourceEventType: 'detectives_intel',
        sources: [
          { label: 'On3', url: SITE_URL },
          { label: hints.writerName || 'Beat', url: hints.url || SITE_URL }
        ],
        templateBlocks: { identity: idLine, context: contextLine, insider: insiderLine }
      },
      caseItem,
      'guarantee_player_' + angle,
      hints,
      platformContext
    );
  }

  const idLine = 'Florida recruiting intel';
  const contextLine =
    'GatorVault Detectives verified UF football context on beat intel that failed first-pass filters.';
  const insiderLine = beatDrivenOnly
    ? 'Beat trail and player profile on Recruiting Hub.'
    : 'Board analysis and FutureCast breakdown rebuilt from beat signal.';
  const url = beatDrivenOnly ? platformContext?.url || SITE_URL + '/vault/recruiting' : SITE_URL + '/vault/futurecast';
  return markDetectivesCandidate(
    {
      text: [idLine, contextLine, insiderLine, url].join('\\n'),
      category: 'news',
      topic: 'program',
      urgencyLabel: 'breaking',
      postUrgency: 'breaking',
      triggerType: 'program_news',
      programNewsType: 'program_update',
      sourceEventType: 'program_news',
      sources: [
        { label: 'On3', url: SITE_URL },
        { label: 'GatorVault Detectives', url: SITE_URL }
      ],
      templateBlocks: { identity: idLine, context: contextLine, insider: insiderLine }
    },
    caseItem,
    'guarantee_program',
    hints,
    platformContext
  );
}

async function buildStrategyCandidates(caseItem, hints, identity, platformContext) {
  const strategies = [];
  const beatText = hints.beatText;
  const slug = identity.playerSlug;
  const name = identity.playerName;
  const beatDrivenOnly = !!(platformContext && !platformContext.hasFutureCastContext);

  if (beatDrivenOnly && beatText) {
    strategies.push(buildBeatDrivenCandidate(caseItem, hints, identity, platformContext));
  }

  if (!beatDrivenOnly && (slug || name)) {
    try {
      const eliteCaption = require('../x-autoposter-elite-caption');
      const built = await eliteCaption.buildElitePlayerPost({
        playerName: name,
        playerSlug: slug,
        beatText,
        intel: {
          playerName: name,
          playerSlug: slug,
          eventType: 'recruiting',
          detail: beatText,
          classYear: identity.classYear
        },
        sourceLabel: hints.writerName || 'Beat intel'
      });
      if (built?.ok && built.text) {
        strategies.push(
          markDetectivesCandidate(
            {
              text: built.text,
              category: 'news',
              topic: 'recruiting',
              urgencyLabel: 'major_beat',
              sourceEventType: 'detectives_elite_caption',
              sources: [
                { label: 'On3', url: SITE_URL },
                { label: hints.writerName || 'Beat', url: hints.url || SITE_URL }
              ],
              playerName: built.playerName || name,
              playerSlug: built.playerSlug || slug,
              templateBlocks: built.templateBlocks
            },
            caseItem,
            'elite_caption',
            hints,
            platformContext
          )
        );
      }
    } catch {}
  }

  if (!beatDrivenOnly) {
    try {
      const research = require('../x-autoposter-elite-research');
      const pack = await research.researchUpdate({
        playerSlug: slug,
        playerName: name,
        beatText,
        sourceLabel: hints.writerName || 'Beat',
        eventType: 'recruiting'
      });
      if (pack?.hasUsableSignal && platformContext?.hasFutureCastContext) {
        let insiderLine = 'Full RPM, visit intel, and predictions on FutureCast.';
        if (pack.breakdown?.recruitingStory) {
          insiderLine = String(pack.breakdown.recruitingStory).trim().slice(0, 140);
        }
        const contextLine = pack.ufPosition || 'GatorVault Detectives expanded beat signal with verified board context.';
        const idLine = name
          ? ((identity.classYear ? identity.classYear + ' ' : '') + name + (identity.pos ? ' ' + identity.pos : '')).trim()
          : 'Florida recruiting target';
        const url = slug ? SITE_URL + '/vault/futurecast/player/' + slug : SITE_URL + '/vault/futurecast';
        strategies.push(
          markDetectivesCandidate(
            {
              text: [idLine, contextLine, insiderLine, url].join('\\n'),
              category: 'news',
              topic: slug ? 'recruiting' : 'program',
              urgencyLabel: 'major_beat',
              sourceEventType: 'detectives_elite_research',
              sources: [{ label: 'On3', url: SITE_URL }],
              playerName: pack.playerName || name,
              playerSlug: pack.playerSlug || slug,
              templateBlocks: { identity: idLine, context: contextLine, insider: insiderLine }
            },
            caseItem,
            'elite_research',
            hints,
            platformContext
          )
        );
      }
    } catch {}
  }

  if (!beatDrivenOnly) {
    try {
      const ladder = require('./research-ladder');
      const raw = {
        text: beatText,
        beatText,
        playerName: name,
        playerSlug: slug,
        source: 'auto:beat-intel',
        sourceEventType: 'beat_intel',
        sourceLabel: hints.writerName || 'Beat',
        sources: [{ label: 'On3', url: SITE_URL }],
        sourceEventCreatedAt: hints.publishedAt || new Date().toISOString()
      };
      const ladderCand = await ladder.buildResearchLadderCandidate(raw, caseItem.skipReason || 'beat_skip');
      if (ladderCand?.text) {
        strategies.push(markDetectivesCandidate(ladderCand, caseItem, 'research_ladder', hints, platformContext));
      }
    } catch {}
  }

  if (slug) {
    try {
      const entry = require('../scouting-database').getEntryBySlug(slug);
      if (entry?.scoutingSummary) {
        const idLine = (
          (identity.classYear ? identity.classYear + ' ' : '') +
          (entry.playerName || name) +
          (entry.pos ? ' ' + entry.pos : '')
        ).trim();
        const contextLine = 'GatorVault Detectives — scout file confirms Florida board relevance.';
        const insiderLine = String(entry.scoutingSummary).trim().slice(0, 140);
        const url = beatDrivenOnly
          ? platformContext?.url || platform.resolvePlayerPlatformUrl(slug, false)
          : SITE_URL + '/vault/futurecast/player/' + slug;
        strategies.push(
          markDetectivesCandidate(
            {
              text: [idLine, contextLine, insiderLine, url].join('\\n'),
              category: 'news',
              topic: 'recruiting',
              urgencyLabel: 'analysis',
              sourceEventType: 'detectives_scouting',
              sources: [{ label: 'GatorVault Scout', url: SITE_URL }],
              playerName: entry.playerName || name,
              playerSlug: slug,
              templateBlocks: { identity: idLine, context: contextLine, insider: insiderLine }
            },
            caseItem,
            'scouting_db',
            hints,
            platformContext
          )
        );
      }
    } catch {}
  }

  for (let i = 0; i < ANGLES.length; i += 1) {
    strategies.push(buildGuaranteeCandidate(caseItem, hints, identity, i, platformContext));
  }
  return strategies;
}

async function tryEnqueueDetectivesCandidate(candidate, doc) {
  const fill = require('../x-autoposter-fill');
  return fill.attemptEnqueueCandidate(candidate, doc, { skipDetectives: true, ladderDepth: 99 });
}

async function investigateCase(caseItem, doc) {
  if (!caseItem || caseItem.status === 'resolved') return { ok: false, reason: 'already_resolved' };
  const attempts = (caseItem.attempts || 0) + 1;
  store.updateCase(caseItem.id, { status: 'investigating', attempts });
  store.appendLog(caseItem.id, { phase: 'start', attempt: attempts, skipReason: caseItem.skipReason });

  const hints = extractHints(caseItem);
  const identity = await resolveIdentity(hints);
  store.appendLog(caseItem.id, {
    phase: 'identity',
    playerName: identity.playerName,
    playerSlug: identity.playerSlug,
    sources: identity.sources
  });

  const platformContext = await platform.ensureBeatProspectOnPlatform({ identity, hints, caseItem });
  if (platformContext.slug) identity.playerSlug = platformContext.slug;
  store.appendLog(caseItem.id, {
    phase: 'platform',
    ok: platformContext.ok,
    slug: platformContext.slug,
    hasFutureCastContext: platformContext.hasFutureCastContext,
    intelCreated: platformContext.intelCreated,
    provisioned: platformContext.provisioned,
    url: platformContext.url
  });

  const strategies = await buildStrategyCandidates(caseItem, hints, identity, platformContext);
  store.appendLog(caseItem.id, { phase: 'strategies', count: strategies.length, beatDrivenOnly: !platformContext.hasFutureCastContext });

  for (let i = 0; i < strategies.length; i += 1) {
    const candidate = strategies[i];
    const pathTag = candidate.validationMeta?.detectivesPath || 'strategy_' + i;
    const result = await tryEnqueueDetectivesCandidate(candidate, doc);
    if (result?.queued) {
      store.updateCase(caseItem.id, {
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        resolvedPath: pathTag,
        resolvedCandidate: { text: candidate.text?.slice(0, 280), playerSlug: candidate.playerSlug },
        queueItemId: result.item?.id || null
      });
      store.appendLog(caseItem.id, { phase: 'resolved', path: pathTag, queueItemId: result.item?.id });
      logDetectives({
        ok: true,
        caseId: caseItem.id,
        path: pathTag,
        playerSlug: candidate.playerSlug,
        skipReason: caseItem.skipReason,
        beatDrivenOnly: !platformContext.hasFutureCastContext
      });
      return { ok: true, queued: true, path: pathTag, item: result.item };
    }
    store.appendLog(caseItem.id, { phase: 'reject', path: pathTag, reason: result?.reason });
  }

  if (attempts >= (caseItem.maxAttempts || 8)) {
    store.updateCase(caseItem.id, { status: 'failed' });
    logDetectives({ ok: false, caseId: caseItem.id, phase: 'exhausted', attempts });
    return { ok: false, reason: 'exhausted' };
  }
  store.updateCase(caseItem.id, { status: 'pending' });
  return { ok: false, reason: 'no_pass_yet', attempts };
}

function shouldHandoff(reason) {
  return reason && !DEDUPE_SKIP_REASONS.has(String(reason));
}

async function handoffToDetectives(payload = {}) {
  if (!detectivesEnabled()) return { ok: false, reason: 'detectives_disabled' };
  if (!shouldHandoff(payload.skipReason)) return { ok: false, reason: 'skip_dedupe' };
  const added = store.addCase(payload);
  logDetectives({
    ok: false,
    phase: 'handoff',
    caseId: added.case?.id,
    created: added.created,
    skipReason: payload.skipReason,
    skipStage: payload.skipStage
  });
  return Object.assign({ ok: true }, added);
}

async function processDetectivesPile({ limit = 3, doc = null } = {}) {
  if (!detectivesEnabled()) return { ok: true, skipped: true, reason: 'detectives_disabled' };
  const queueDoc = doc || require('../x-autoposter-store').loadQueue();
  const pending = store.listCases({ status: 'pending', limit });
  const results = [];
  for (const caseItem of pending) {
    const out = await investigateCase(caseItem, queueDoc);
    results.push(Object.assign({ caseId: caseItem.id }, out));
    if (out?.queued) break;
  }
  return { ok: true, processed: results.length, results, counts: store.countByStatus() };
}

async function tryImmediateResolve(handoffResult, doc) {
  if (!handoffResult?.case?.id) return null;
  const caseItem = store.getCase(handoffResult.case.id);
  if (!caseItem || caseItem.status === 'resolved') return null;
  return investigateCase(caseItem, doc);
}

module.exports = {
  detectivesEnabled,
  handoffToDetectives,
  processDetectivesPile,
  investigateCase,
  tryImmediateResolve,
  shouldHandoff,
  extractHints,
  resolveIdentity,
  buildStrategyCandidates,
  markDetectivesCandidate,
  buildBeatDrivenCandidate,
  countByStatus: store.countByStatus,
  listCases: store.listCases
};
`;

function writeUtf8(rel, content) {
  const target = path.join(ROOT, rel);
  fs.writeFileSync(target, content, { encoding: 'utf8' });
  const head = fs.readFileSync(target);
  if (head[1] === 0) {
    throw new Error('UTF-16 corruption detected after write: ' + rel);
  }
  console.log('wrote', target, head.length, 'bytes');
}

writeUtf8('detectives-platform.js', platformJs);
writeUtf8('detectives.js', detectivesJs);
console.log('done');
