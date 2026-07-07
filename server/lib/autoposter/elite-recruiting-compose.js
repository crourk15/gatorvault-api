/**
 * G1 - Elite recruiting compose: enrich intel until PR-789 passes QA. No thin fallback.
 */
const qa = require('./recruiting-post-qa');
const { validateBannedPhrases } = require('./rewrite/fact-gates');
const { THIN_FALLBACK_RE } = require('./rewrite/compose-synonym-rotation');
const { PR6_FALLBACK_RE } = require('../player-intelligence/golden-four-compose');
const {
  fusePlayerIntel,
  clusterIntelRows,
  buildBeatTextFromCluster
} = require('../player-intelligence/fuse-player-intel');
const { composeFromFusedIntel } = require('../player-intelligence/compose-from-fused-intel');
const { buildEliteRepublishPost } = require('../player-intelligence/elite-republish-compose');
const { logComposeSkip } = require('./compose-skip-log');

const COMPOSE_ENGINE = 'pr789_fused';

function eliteRecruitingComposeEnabled() {
  return process.env.X_AUTOPOST_ELITE_RECRUITING_COMPOSE !== 'false';
}

function isPr789OnlyRecruiting() {
  if (process.env.X_AUTOPOST_PR789_ONLY_RECRUITING === 'false') return false;
  if (process.env.X_AUTOPOST_PR789_ONLY_RECRUITING === 'true') return true;
  return process.env.X_AUTOPOST_ELITE_MODE === 'true';
}

function rowText(row) {
  return String(row?.detail || row?.skinny || row?.text || '').trim();
}

function mergeBeatParts(parts = []) {
  const seen = new Set();
  const out = [];
  for (const raw of parts) {
    const chunk = String(raw || '').trim();
    if (!chunk || chunk.length < 12) continue;
    const key = chunk.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(chunk);
  }
  return out.join(' ').trim();
}

function visitBeatFragment(slug) {
  try {
    const visitStore = require('../recruiting-visit-log-store');
    const logs = visitStore.listVisitLogs({ playerSlug: slug, limit: 8 }) || [];
    const uf = logs.find((v) => /florida|gators|\buf\b/i.test(String(v.school || v.name || '')));
    if (!uf) return '';
    const date = uf.date || uf.reportedAt;
    if (date) {
      const d = new Date(date);
      if (Number.isFinite(d.getTime())) {
        const month = d.toLocaleString('en-US', { month: 'long' });
        const year = d.getFullYear();
        const type = String(uf.visitType || 'unofficial').toLowerCase();
        return month + ' ' + year + ' ' + type + ' visit to Gainesville for Florida football recruiting';
      }
    }
    return 'unofficial visit to Gainesville for Florida football recruiting';
  } catch {
    return '';
  }
}

function scoutingBeatFragment(slug) {
  try {
    const entry = require('../scouting-database').getEntryBySlug(slug);
    const summary = String(entry?.scoutingSummary || '').trim();
    if (!summary || summary.length < 40) return '';
    if (/\b(rumor|might|could|sources say|unconfirmed)\b/i.test(summary)) return '';
    return summary.slice(0, 220);
  } catch {
    return '';
  }
}

async function researchBeatFragment(slug, hints = {}) {
  try {
    const researchEngine = require('../x-autoposter-elite-research');
    const pack = await researchEngine.researchUpdate({
      playerSlug: slug,
      playerName: hints.playerName,
      beatText: hints.beatText,
      sourceLabel: hints.writerName || 'Beat',
      intel: {
        playerSlug: slug,
        playerName: hints.playerName,
        detail: hints.beatText,
        classYear: hints.classYear || null
      }
    });
    const snippets = Array.isArray(pack?.beatSnippets) ? pack.beatSnippets : [];
    const combined = String(pack?.combinedText || '').trim();
    const parts = [...snippets, combined].filter((s) => String(s || '').trim().length >= 24);
    return mergeBeatParts(parts);
  } catch {
    return '';
  }
}

function metricsBeatFragment(metrics = {}) {
  const parts = [];
  if (metrics.visitDate || metrics.visitStart) {
    parts.push('Florida campus visit window ' + (metrics.visitDate || metrics.visitStart));
  }
  if (metrics.rpm != null && Number(metrics.rpm) > 0) {
    parts.push('On3 RPM shows Florida at ' + Number(metrics.rpm) + ' percent');
  }
  if (Array.isArray(metrics.rpmTop) && metrics.rpmTop.length >= 2) {
    parts.push(
      metrics.rpmTop[0].school + ' and ' + metrics.rpmTop[1].school + ' lead his RPM board with Florida in the mix'
    );
  }
  return mergeBeatParts(parts);
}

async function buildEnrichmentPasses(slug, opts = {}) {
  const hints = opts.hints || {};
  const trigger = String(opts.triggerBeatText || hints.beatText || rowText(opts.intelRow) || '').trim();
  const clusterBeat = buildBeatTextFromCluster(clusterIntelRows(slug));
  const visitFrag = visitBeatFragment(slug);
  const scoutFrag = scoutingBeatFragment(slug);
  const metricsFrag = metricsBeatFragment(opts.metrics || hints.metrics || {});
  const researchFrag = await researchBeatFragment(slug, {
    ...hints,
    beatText: mergeBeatParts([trigger, clusterBeat, visitFrag])
  });

  const base = mergeBeatParts([trigger, clusterBeat]);
  const withVisit = mergeBeatParts([base, visitFrag, metricsFrag]);
  const withResearch = mergeBeatParts([withVisit, researchFrag]);
  const full = mergeBeatParts([withResearch, scoutFrag]);

  const passes = [];
  if (trigger.length >= 20) {
    passes.push({ id: 'trigger_beat', beatText: trigger, sources: ['trigger'], refreshOn3: false });
  }
  if (base.length >= 20 && base !== trigger) {
    passes.push({ id: 'intel_cluster', beatText: base, sources: ['intel_cluster'], refreshOn3: false });
  }
  if (withVisit.length >= 20 && withVisit !== base) {
    passes.push({ id: 'visit_metrics', beatText: withVisit, sources: ['intel_cluster', 'visit_log', 'metrics'], refreshOn3: true });
  }
  if (withResearch.length >= 20 && withResearch !== withVisit) {
    passes.push({ id: 'research_enrich', beatText: withResearch, sources: ['research'], refreshOn3: true });
  }
  if (full.length >= 20 && full !== withResearch) {
    passes.push({ id: 'full_enrich', beatText: full, sources: ['scouting', 'research', 'visit_log'], refreshOn3: true });
  }
  if (!passes.length && base.length >= 12) {
    passes.push({ id: 'cluster_fallback', beatText: base, sources: ['intel_cluster'], refreshOn3: true });
  }
  return passes;
}

function toQueueCandidate(composed, slug, extras = {}) {
  if (!composed?.ok || !composed.text) return null;
  return {
    text: composed.text,
    category: 'news',
    topic: 'recruiting',
    playerName: composed.playerName,
    playerSlug: slug,
    templateBlocks: composed.templateBlocks,
    validationMeta: {
      ...(composed.validationMeta || {}),
      composeEngine: COMPOSE_ENGINE,
      detectivesPath: extras.detectivesPath || 'elite_fused_pr789',
      enrichmentPass: extras.enrichPass || null,
      enrichmentSources: extras.enrichmentSources || [],
      eliteRecruitingCompose: true
    }
  };
}

function passesEliteRecruitingGate(composed, slug) {
  if (!composed?.ok || !composed.text) return { ok: false, reason: composed?.reason || 'compose_failed' };
  const text = String(composed.text || '');
  if (PR6_FALLBACK_RE.test(text)) return { ok: false, reason: 'pr6_fallback_blocked' };
  if (THIN_FALLBACK_RE.test(text)) return { ok: false, reason: 'thin_fallback' };
  const banned = validateBannedPhrases(text);
  if (!banned.ok) return { ok: false, reason: 'banned_phrases', violations: banned.violations };
  const candidate = toQueueCandidate(composed, slug);
  if (!candidate) return { ok: false, reason: 'empty_compose' };
  if (!qa.passesPublishGate(candidate)) {
    return { ok: false, reason: qa.rejectReason(candidate) || 'recruiting_qa' };
  }
  return { ok: true };
}

async function attemptComposePass(slug, pass, opts = {}) {
  const fused = await fusePlayerIntel(slug, {
    persist: opts.persistFusion === true,
    beatTextOverride: pass.beatText
  });
  if (!fused?.beatText) {
    return { ok: false, reason: 'missing_fused_intel', pass: pass.id };
  }

  let composed = await buildEliteRepublishPost(slug, {
    intelRow: opts.intelRow || fused.primaryIntelRow || null,
    fused,
    refreshOn3: pass.refreshOn3 !== false,
    persistFusion: false
  });

  if (!composed?.ok && (composed?.reason === 'ranking_incomplete' || composed?.reason === 'compose_failed')) {
    const fallback = composeFromFusedIntel({
      ...fused,
      publishAction: fused.publishAction === 'archive' ? 'hold' : fused.publishAction
    });
    if (fallback?.ok && fallback.text) composed = fallback;
  }

  const gate = passesEliteRecruitingGate(composed, slug);
  if (!gate.ok) {
    return {
      ok: false,
      reason: gate.reason,
      pass: pass.id,
      composed,
      fused,
      violations: gate.violations || null
    };
  }

  return {
    ok: true,
    ...composed,
    enrichPass: pass.id,
    enrichmentSources: pass.sources,
    fused,
    composeEngine: COMPOSE_ENGINE
  };
}

async function buildEliteRecruitingPost(slug, opts = {}) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return { ok: false, reason: 'missing_slug' };

  const passes = await buildEnrichmentPasses(normalized, opts);
  if (!passes.length) {
    const out = { ok: false, reason: 'no_enrichment_sources', slug: normalized };
    logComposeSkip({ slug: normalized, reason: out.reason, trigger: opts.trigger || 'compose' });
    return out;
  }

  let last = null;
  for (const pass of passes) {
    const attempt = await attemptComposePass(normalized, pass, opts);
    if (attempt.ok) {
      return attempt;
    }
    last = attempt;
  }

  const out = {
    ok: false,
    reason: 'elite_enrich_exhausted',
    slug: normalized,
    lastReason: last?.reason || 'compose_failed',
    enrichPassesTried: passes.map((p) => p.id),
    gaps: last?.fused?.gaps || [],
    enrichmentSources: passes[passes.length - 1]?.sources || []
  };
  logComposeSkip({
    slug: normalized,
    reason: out.reason,
    lastReason: out.lastReason,
    enrichPassesTried: out.enrichPassesTried,
    gaps: out.gaps,
    trigger: opts.trigger || 'compose'
  });
  return out;
}

module.exports = {
  eliteRecruitingComposeEnabled,
  COMPOSE_ENGINE,
  isPr789OnlyRecruiting,
  buildEnrichmentPasses,
  buildEliteRecruitingPost,
  passesEliteRecruitingGate,
  toQueueCandidate,
  visitBeatFragment,
  mergeBeatParts
};