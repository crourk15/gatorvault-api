/**
 * Post Studio Intel Inbox — persistent beat intel + pipeline visibility for operators.
 */
const intelStore = require('./recruiting-intel-store');
const store = require('./x-autoposter-store');
const cadence = require('./x-autoposter-cadence');
const { listComposeSkips } = require('./autoposter/compose-skip-log');
const { getDetectivesDashboard } = require('./autoposter/detectives-dashboard');
const { composeProbe, deriveComposeRouting } = require('./autoposter/compose-observability');

const BEAT_INTEL_SOURCES =
  /beat-writer|program-news|team-event|auto:beat|auto:program|auto:team|auto:on3-team-news|on3-team-news|auto:detectives/i;

const DEFAULT_INBOX_AGE_MS = parseInt(process.env.POST_STUDIO_INBOX_AGE_MS || String(14 * 86400000), 10);

function isBeatIntel(row = {}) {
  return BEAT_INTEL_SOURCES.test(String(row.source || ''));
}

function normalizeSlug(slug) {
  return String(slug || '').trim().toLowerCase();
}

function beatSnippet(row = {}, max = 200) {
  const text = String(row.detail || row.skinny || row.text || '').trim();
  if (!text) return '';
  return text.length > max ? text.slice(0, max - 1) + '...' : text;
}

function ageMs(row = {}) {
  const ts = new Date(row.reportedAt || row.createdAt || 0).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return null;
  return Date.now() - ts;
}

function formatAge(ms) {
  if (ms == null) return null;
  if (ms < 3600000) return Math.max(1, Math.round(ms / 60000)) + 'm';
  if (ms < 86400000) return Math.round(ms / 3600000) + 'h';
  return Math.round(ms / 86400000) + 'd';
}

function lastSkipBySlug(slugs = []) {
  const wanted = new Set(slugs.map(normalizeSlug).filter(Boolean));
  const map = new Map();
  for (const row of listComposeSkips({ limit: 200 })) {
    const slug = normalizeSlug(row.slug);
    if (!slug || !wanted.has(slug) || map.has(slug)) continue;
    map.set(slug, row);
  }
  return map;
}

function draftsBySlug(slugs = []) {
  const wanted = new Set(slugs.map(normalizeSlug).filter(Boolean));
  const map = new Map();
  for (const item of store.listPostStudioDrafts({ limit: 100 })) {
    const slug = normalizeSlug(item.playerSlug);
    if (!slug || !wanted.has(slug)) continue;
    if (!map.has(slug)) map.set(slug, []);
    map.get(slug).push({
      id: item.id,
      createdAt: item.createdAt,
      source: item.source,
      textPreview: String(item.text || '').slice(0, 220),
      charCount: String(item.text || '').length,
      composePath: item.validationMeta?.composePath || null,
      dominantAngle: item.validationMeta?.dominantAngle || null,
      detectivesPath: item.validationMeta?.detectivesPath || null,
      thin: store.isThinRecruitingPostText(item.text),
      validationMeta: item.validationMeta || null
    });
  }
  return map;
}

function detectivesBySlug(slugs = []) {
  const wanted = new Set(slugs.map(normalizeSlug).filter(Boolean));
  const map = new Map();
  try {
    const detStore = require('./autoposter/detectives-store');
    for (const caseItem of detStore.listCases({ limit: 100 })) {
      const slug = normalizeSlug(
        caseItem.hints?.playerSlug || caseItem.candidate?.playerSlug || caseItem.beatPost?.playerSlug
      );
      if (!slug || !wanted.has(slug)) continue;
      if (!map.has(slug)) map.set(slug, []);
      const log = (caseItem.investigationLog || []).slice(-6);
      map.get(slug).push({
        id: caseItem.id,
        status: caseItem.status,
        skipReason: caseItem.skipReason,
        attempts: caseItem.attempts,
        resolvedPath: caseItem.resolvedPath || null,
        resolvedPreview: caseItem.resolvedCandidate?.text
          ? String(caseItem.resolvedCandidate.text).slice(0, 220)
          : null,
        beatText: beatSnippet({ detail: caseItem.beatPost?.text || caseItem.hints?.beatText || '' }, 160),
        log: log.map((l) => ({ phase: l.phase, reason: l.reason || null, path: l.path || null, at: l.at || null }))
      });
    }
  } catch {
    /* optional */
  }
  return map;
}

function deriveInboxStatus({ intel, draft, skip, detectives }) {
  const reasons = [];
  if (draft && draft.length) {
    const primary = draft[0];
    if (primary.thin) {
      reasons.push('thin_draft');
      return { status: 'needs_you', label: 'Thin draft', reasons, draftId: primary.id };
    }
    return { status: 'draft_ready', label: 'Draft ready', reasons, draftId: primary.id };
  }
  if (skip) {
    reasons.push(skip.reason || 'compose_skip');
    if (skip.lastReason) reasons.push(skip.lastReason);
    return { status: 'compose_failed', label: 'Compose failed', reasons };
  }
  const activeDet = (detectives || []).find((c) => c.status === 'pending' || c.status === 'investigating');
  if (activeDet) {
    reasons.push('detectives_' + activeDet.status);
    return { status: 'detectives', label: 'Detectives working', reasons, caseId: activeDet.id };
  }
  if (!intel) {
    return { status: 'no_intel', label: 'No beat intel', reasons: ['no_intel'] };
  }
  return { status: 'ready_to_compose', label: 'Ready to compose', reasons };
}

function groupInboxRows(rows = []) {
  const bySlug = new Map();
  for (const row of rows) {
    const slug = normalizeSlug(row.playerSlug);
    if (!slug) continue;
    const existing = bySlug.get(slug);
    if (!existing) {
      bySlug.set(slug, row);
      continue;
    }
    const a = new Date(row.reportedAt || row.createdAt || 0).getTime();
    const b = new Date(existing.reportedAt || existing.createdAt || 0).getTime();
    if (a > b) bySlug.set(slug, row);
  }
  return [...bySlug.values()].sort(
    (a, b) => new Date(b.reportedAt || b.createdAt) - new Date(a.reportedAt || a.createdAt)
  );
}

/**
 * Map live beat-cache posts → inbox rows (matched to a player).
 * Desk mode uses this so today's writer posts surface even before intel DB ingest.
 */
async function liveBeatInboxRows({ maxAgeMs = DEFAULT_INBOX_AGE_MS, limit = 80 } = {}) {
  let posts = [];
  let fetchedAt = null;
  try {
    const liveBeat = require('./live-beat');
    const result = liveBeat.getBeatPosts(Math.max(limit, 80));
    posts = Array.isArray(result) ? result : result?.posts || [];
    fetchedAt = result?.fetchedAt || null;
  } catch {
    return { rows: [], fetchedAt: null, postCount: 0 };
  }

  let gate = null;
  try {
    gate = require('./beat-recruiting-ingest-gate');
  } catch {
    gate = null;
  }

  let prefilter = null;
  try {
    prefilter = require('./beat-intel-prefilter');
  } catch {
    prefilter = null;
  }

  const cutoff = Date.now() - maxAgeMs;
  const rows = [];
  for (const p of posts) {
    const text = String(p.text || '').trim();
    if (text.length < 24) continue;
    // Soft-sell only — team/staff/camp/program beats stay on the desk as hub topics.
    if (prefilter?.isSubscribePromoIntel?.(text)) continue;

    const reportedAt = p.publishedAt || p.fetchedAt || fetchedAt || null;
    const ts = new Date(reportedAt || 0).getTime();
    if (Number.isFinite(ts) && ts > 0 && ts < cutoff) continue;

    // Resolve recruit teasers (nameless Bender On3+ posts) BEFORE hub Team/Program
    // classification — otherwise "top EDGE prospect… Florida visit" collapses to Team news.
    let hit = null;
    let articleUrl = p.url || p.link || null;
    try {
      const teaser = require('./beat-teaser-resolve');
      const enriched = await teaser.enrichBeatPostIdentity(p);
      if (enriched?.resolved?.playerSlug) {
        hit = enriched.resolved;
        if (enriched.resolved.on3ArticleUrl) articleUrl = enriched.resolved.on3ArticleUrl;
      } else {
        hit = teaser.resolvePlayerFromBeatPostSync(p);
      }
    } catch {
      hit = null;
    }
    if (!hit?.playerSlug && gate?.resolvePlayerFromTextSync) {
      try {
        hit = gate.resolvePlayerFromTextSync(text);
      } catch {
        hit = null;
      }
    }
    if (hit?.playerSlug) {
      const playerSlug = normalizeSlug(hit.playerSlug);
      // Current UF roster names are Florida football coverage — not HS recruiting.
      let deskKind = 'recruit';
      let eventType = 'beat_live';
      try {
        const rosterStore = require('./roster-store');
        const onRoster = rosterStore.getRosterPlayerBySlug(playerSlug);
        const recruitingCue =
          /\b(offer(?:ed)?|official visit|\bov\b|unofficial visit|commits? to|commitment|class of 202[7-9]|4-star|5-star|\brpm\b|top ?100)\b/i.test(
            text
          );
        if (onRoster && !recruitingCue) {
          deskKind = 'roster';
          eventType = 'team_event';
        }
      } catch {
        /* optional */
      }
      rows.push({
        playerSlug,
        playerName: hit.playerName || null,
        source: `beat-writer:${String(p.handle || p.writerName || 'live').replace(/^@/, '')}`,
        eventType,
        deskKind,
        detail: text,
        skinny: text.slice(0, 200),
        reportedAt,
        createdAt: reportedAt,
        articleUrl,
        ufRelevant: true,
        liveBeat: true,
        teaserResolved: !!hit.matchMode && String(hit.matchMode).includes('on3'),
        writerName: p.writerName || p.handle || null,
        outlet: p.outlet || null
      });
      continue;
    }

    let hub = null;
    try {
      hub = require('./hub-desk-topics').classifyHubDeskBeat(text, p);
    } catch {
      hub = null;
    }
    if (hub?.playerSlug) {
      rows.push({
        playerSlug: normalizeSlug(hub.playerSlug),
        playerName: hub.playerName,
        source: `beat-writer:${String(p.handle || p.writerName || 'live').replace(/^@/, '')}`,
        eventType: hub.eventType,
        deskKind: hub.deskKind,
        topicType: hub.topicType,
        detail: text,
        skinny: text.slice(0, 200),
        reportedAt,
        createdAt: reportedAt,
        articleUrl: p.url || p.link || null,
        ufRelevant: true,
        liveBeat: true,
        teaserResolved: false,
        writerName: p.writerName || p.handle || null,
        outlet: p.outlet || null
      });
    }
  }
  return { rows, fetchedAt, postCount: posts.length };
}

function recentBeatIntelRows({ maxAgeMs = DEFAULT_INBOX_AGE_MS } = {}) {
  const cutoffIso = new Date(Date.now() - maxAgeMs).toISOString();
  const recent = intelStore.listIntel({ limit: 400, since: cutoffIso }) || [];
  let hubTopics = null;
  try {
    hubTopics = require('./hub-desk-topics');
  } catch {
    hubTopics = null;
  }
  return recent
    .filter((row) => isBeatIntel(row) || row.ufRelevant === true)
    .map((row) => {
      if (row.playerSlug) return row;
      if (!hubTopics) return row;
      const et = String(row.eventType || row.triggerType || '');
      if (et === 'team_event') {
        const type = row.teamEventType || row.status || 'general';
        return {
          ...row,
          playerSlug: hubTopics.hubDeskSlug('team', type),
          playerName: hubTopics.hubDeskLabel('team', type),
          deskKind: 'team',
          topicType: type
        };
      }
      if (et === 'program_news') {
        const type = row.programNewsType || row.status || 'general';
        return {
          ...row,
          playerSlug: hubTopics.hubDeskSlug('program', type),
          playerName: hubTopics.hubDeskLabel('program', type),
          deskKind: 'program',
          topicType: type
        };
      }
      return row;
    });
}

async function getIntelInbox({
  limit = 40,
  maxAgeMs = DEFAULT_INBOX_AGE_MS,
  deskMode = false
} = {}) {
  await intelStore.initIntelStore().catch(() => {});

  const unqueued = intelStore.getUnqueuedIntel({ maxAgeMs, limit: null }) || [];
  let beatRows;
  let liveMeta = { rows: [], fetchedAt: null, postCount: 0 };

  if (deskMode) {
    // Desk = research surface: today's live beats + recent intel (including already posted).
    // Compose inbox still uses unqueued-only below.
    liveMeta = await liveBeatInboxRows({ maxAgeMs, limit: 100 });
    const recent = recentBeatIntelRows({ maxAgeMs });
    beatRows = [...liveMeta.rows, ...recent];
  } else {
    beatRows = unqueued.filter((row) => isBeatIntel(row) || row.ufRelevant === true);
  }

  const grouped = groupInboxRows(beatRows).slice(0, limit);
  const slugs = grouped.map((r) => normalizeSlug(r.playerSlug));

  const skipMap = lastSkipBySlug(slugs);
  const draftMap = draftsBySlug(slugs);
  const detMap = detectivesBySlug(slugs);

  const items = grouped.map((intel) => {
    const slug = normalizeSlug(intel.playerSlug);
    const drafts = draftMap.get(slug) || [];
    const detectives = detMap.get(slug) || [];
    const skip = skipMap.get(slug) || null;
    const status = deriveInboxStatus({ intel, draft: drafts, skip, detectives });
    const age = ageMs(intel);
    return {
      slug,
      playerName: intel.playerName || null,
      source: intel.source || null,
      eventType: intel.eventType || null,
      deskKind: intel.deskKind || (String(slug).startsWith('uf-team-') || String(slug).startsWith('uf-program-') ? 'team' : 'recruit'),
      topicType: intel.topicType || null,
      reportedAt: intel.reportedAt || intel.createdAt || null,
      ageLabel: formatAge(age),
      ageMs: age,
      beatText: beatSnippet(intel),
      articleUrl: intel.articleUrl || intel.url || null,
      fingerprint: intel.fingerprint || null,
      ufRelevant: intel.ufRelevant === true,
      liveBeat: !!intel.liveBeat,
      status,
      draftCount: drafts.length,
      detectivesCount: detectives.length,
      lastComposeSkip: skip
        ? {
            at: skip.at,
            reason: skip.reason,
            lastReason: skip.lastReason,
            enrichPassesTried: skip.enrichPassesTried || [],
            gaps: skip.gaps || []
          }
        : null
    };
  });

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    deskMode: !!deskMode,
    liveBeatFetchedAt: liveMeta.fetchedAt,
    liveBeatPostCount: liveMeta.postCount,
    liveBeatMatched: liveMeta.rows.length,
    totalUnqueued: unqueued.length,
    beatUnqueued: deskMode
      ? unqueued.filter((row) => isBeatIntel(row) || row.ufRelevant === true).length
      : beatRows.length,
    shown: items.length,
    items
  };
}

async function getPipelineDashboard() {
  const detectives = getDetectivesDashboard({ limit: 8 });
  const counts = store.getQueueCounts();
  const stats = cadence.getHubStats();
  const config = cadence.getHubConfig();
  const skips = listComposeSkips({ limit: 12 });
  let memory = null;
  try {
    memory = require('./pipeline-guards').memorySnapshot();
  } catch {
    /* optional */
  }

  const inbox = await getIntelInbox({ limit: 5 });

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    hub: {
      hubMode: stats.hubMode,
      schedulerEnabled: config.schedulerEnabled,
      dailySent: stats.dailySent || 0
    },
    queue: counts,
    detectives: {
      enabled: detectives.enabled,
      counts: detectives.counts,
      beatCache: detectives.beatCache,
      lastBackfill: detectives.lastBackfill,
      pileHint: detectives.pileHint,
      active: detectives.activeInvestigation
    },
    compose: {
      pr789Only: require('./autoposter/elite-recruiting-compose').isPr789OnlyRecruiting(),
      recentSkips: skips
    },
    inboxSummary: {
      totalUnqueued: inbox.totalUnqueued,
      beatUnqueued: inbox.beatUnqueued,
      top: inbox.items
    },
    memory
  };
}

async function inspectPlayer(slug, opts = {}) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return { ok: false, error: 'missing_slug' };

  await intelStore.initIntelStore().catch(() => {});

  const intelRows = intelStore.getIntelForPlayer({ playerSlug: normalized }) || [];
  const unqueued = (intelStore.getUnqueuedIntel({ maxAgeMs: DEFAULT_INBOX_AGE_MS }) || []).filter(
    (r) => normalizeSlug(r.playerSlug) === normalized
  );
  const drafts = draftsBySlug([normalized]).get(normalized) || [];
  const detectives = detectivesBySlug([normalized]).get(normalized) || [];
  const skip = lastSkipBySlug([normalized]).get(normalized) || null;

  const primaryIntel =
    unqueued.find(isBeatIntel) ||
    intelRows.find((r) => isBeatIntel(r)) ||
    unqueued[0] ||
    intelRows[0] ||
    null;

  const probe = await composeProbe(normalized, opts);

  let fullCompose = null;
  try {
    const { buildEliteRepublishPost } = require('./player-intelligence/elite-republish-compose');
    const built = await buildEliteRepublishPost(normalized, {
      intelRow: primaryIntel,
      refreshOn3: false,
      _testSkipRefresh: true,
      persistFusion: false
    });
    fullCompose = {
      ok: !!built?.ok,
      reason: built?.reason || null,
      text: built?.text || null,
      charCount: built?.text ? String(built.text).length : 0,
      composePath: built?.validationMeta?.composePath || null,
      dominantAngle: built?.validationMeta?.dominantAngle || null,
      angleReason: built?.validationMeta?.angleReason || null,
      templateBlocks: built?.templateBlocks || null,
      validationMeta: built?.validationMeta || null,
      thin: built?.text ? store.isThinRecruitingPostText(built.text) : false
    };
  } catch (err) {
    fullCompose = { ok: false, reason: 'compose_error', error: err.message };
  }

  const routing = probe.routing || deriveComposeRouting(probe);
  const verdict = { ready: false, needsYou: true, reasons: [] };

  if (fullCompose?.ok && !fullCompose.thin) {
    verdict.ready = true;
    verdict.needsYou = false;
    verdict.reasons.push('elite_compose_ok');
  } else if (drafts[0] && !drafts[0].thin) {
    verdict.ready = true;
    verdict.needsYou = false;
    verdict.reasons.push('draft_exists');
  } else {
    if (fullCompose?.thin || drafts[0]?.thin) verdict.reasons.push('thin_copy');
    if (probe.publishGate === false) verdict.reasons.push(probe.publishGateReason || 'qa_blocked');
    if (probe.eliteBuild?.reason) verdict.reasons.push(probe.eliteBuild.reason);
    if ((probe.fuse?.gaps || []).length) verdict.reasons.push(...probe.fuse.gaps);
    if (!primaryIntel) verdict.reasons.push('no_beat_intel');
    if (detectives.some((c) => c.status === 'pending' || c.status === 'investigating')) {
      verdict.reasons.push('detectives_active');
    }
  }

  return {
    ok: true,
    slug: normalized,
    playerName: primaryIntel?.playerName || null,
    verdict,
    routing,
    intel: {
      primary: primaryIntel
        ? {
            id: primaryIntel.id,
            source: primaryIntel.source,
            beatText: beatSnippet(primaryIntel, 400),
            articleUrl: primaryIntel.articleUrl || null,
            reportedAt: primaryIntel.reportedAt || primaryIntel.createdAt,
            xPosted: !!primaryIntel.xPosted,
            xPostQueued: !!primaryIntel.xPostQueued,
            fingerprint: primaryIntel.fingerprint || null
          }
        : null,
      unqueuedCount: unqueued.length,
      totalCount: intelRows.length
    },
    drafts,
    detectives,
    lastComposeSkip: skip,
    probe,
    fullCompose
  };
}

module.exports = {
  getIntelInbox,
  getPipelineDashboard,
  inspectPlayer,
  isBeatIntel,
  BEAT_INTEL_SOURCES,
  liveBeatInboxRows
};
