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

async function getIntelInbox({ limit = 40, maxAgeMs = DEFAULT_INBOX_AGE_MS } = {}) {
  await intelStore.initIntelStore().catch(() => {});

  const unqueued = intelStore.getUnqueuedIntel({ maxAgeMs, limit: null }) || [];
  const beatRows = unqueued.filter((row) => isBeatIntel(row) || row.ufRelevant === true);
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
      reportedAt: intel.reportedAt || intel.createdAt || null,
      ageLabel: formatAge(age),
      ageMs: age,
      beatText: beatSnippet(intel),
      articleUrl: intel.articleUrl || intel.url || null,
      fingerprint: intel.fingerprint || null,
      ufRelevant: intel.ufRelevant === true,
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
    totalUnqueued: unqueued.length,
    beatUnqueued: beatRows.length,
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
  BEAT_INTEL_SOURCES
};
