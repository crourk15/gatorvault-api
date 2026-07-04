/**
 * Detectives PR2 — pull rpm/visit/comp into case metrics before strategies.
 */
const signalAdapter = require('./voice-signal-adapter');
const platform = require('./detectives-platform');
const store = require('./detectives-store');
const { loadRankingTokensForSlug } = require('./on3-ranking-tokens');

function nowIso() {
  return new Date().toISOString();
}

function buildRepairAction(action, success, details) {
  return {
    action,
    success: success !== false,
    details: details || null,
    timestamp: nowIso()
  };
}

function metricsGaps(metrics = {}) {
  const gaps = [];
  if (metrics.rpm == null || Number(metrics.rpm) <= 0) gaps.push('no_rpm');
  if (!metrics.visitDate && !metrics.visitStart) gaps.push('no_visit');
  if (!Array.isArray(metrics.compSchools) || !metrics.compSchools.length) gaps.push('no_comp');
  return gaps;
}

function latestIntelVisit(intelRows = []) {
  for (const row of intelRows) {
    if (row?.visitStart) return row.visitStart;
    if (/visit/i.test(String(row?.eventType || ''))) {
      const parsed = signalAdapter.extractVisitDateFromBeat(row.detail || row.text || '', row.timestamp);
      if (parsed) return parsed;
    }
  }
  return null;
}

function latestIntelRpm(intelRows = []) {
  for (const row of intelRows) {
    const pct = row?.ufRpmPct ?? row?.confidencePct;
    if (pct != null && Number(pct) > 0) return Number(pct);
  }
  return null;
}

async function enrichCaseMetrics({ caseItem, hints, identity, platformContext }) {
  const repairActions = [];
  const slug = identity?.playerSlug || platformContext?.slug || hints?.playerSlug || null;
  const beatText = hints?.beatText || '';
  const metricsBefore = { ...(hints?.metrics || {}) };
  const metrics = { ...metricsBefore };

  let player = platformContext?.player || null;
  let intelRows = platformContext?.intelRows || [];
  if (slug && (!player || !intelRows.length)) {
    try {
      const ctx = await platform.loadPlayerContext(slug);
      player = player || ctx.player;
      intelRows = intelRows.length ? intelRows : ctx.intelRows || [];
    } catch (e) {
      repairActions.push(buildRepairAction('load_player_context', false, e.message));
    }
  }

  let research = null;
  try {
    const researchEngine = require('../x-autoposter-elite-research');
    research = await researchEngine.researchUpdate({
      playerSlug: slug,
      playerName: identity?.playerName || hints?.playerName,
      beatText,
      sourceLabel: hints?.writerName || 'Beat',
      intel: {
        playerSlug: slug,
        playerName: identity?.playerName || hints?.playerName,
        detail: beatText,
        classYear: identity?.classYear || hints?.classYear || null
      }
    });
    repairActions.push(buildRepairAction('pull_research', true, slug || 'no-slug'));
  } catch (e) {
    repairActions.push(buildRepairAction('pull_research', false, e.message));
  }

  if (metrics.rpm == null || Number(metrics.rpm) <= 0) {
    let rpm =
      signalAdapter.parseUfRpm(research, { ufRpmPct: identity?.ufRpmPct }) ??
      (player?.ufRpmPct != null ? Number(player.ufRpmPct) : null) ??
      (identity?.ufRpmPct != null ? Number(identity.ufRpmPct) : null) ??
      latestIntelRpm(intelRows);
    if (rpm != null && rpm > 0) {
      metrics.rpm = rpm;
      repairActions.push(buildRepairAction('pull_board_rpm', true, String(rpm)));
    } else {
      repairActions.push(buildRepairAction('pull_board_rpm', false, 'missing'));
    }
  }

  if (!metrics.visitDate && !metrics.visitStart) {
    const visit =
      research?.intel?.visitStart ||
      research?.timing?.visitStart ||
      latestIntelVisit(intelRows) ||
      signalAdapter.extractVisitDateFromBeat(beatText, hints?.publishedAt);
    if (visit) {
      metrics.visitDate = visit;
      repairActions.push(buildRepairAction('pull_intel_visit', true, visit));
    } else {
      repairActions.push(buildRepairAction('parse_beat_visit', false, 'missing'));
    }
  }

  if (!Array.isArray(metrics.compSchools) || !metrics.compSchools.length) {
    const comp = signalAdapter.compSchoolsFromResearch(research || {});
    if (comp.length) {
      metrics.compSchools = comp;
      repairActions.push(buildRepairAction('pull_fc_comp', true, comp.join(', ')));
    } else {
      repairActions.push(buildRepairAction('pull_fc_comp', false, 'missing'));
    }
  }

  const rankingSource = {
    ...(player || {}),
    ...(identity || {}),
    ...(research?.player || {})
  };
  const rankingTokens = await loadRankingTokensForSlug(slug, rankingSource);
  if (rankingTokens) {
    metrics.rankingTokens = rankingTokens;
    repairActions.push(buildRepairAction('pull_on3_rankings', true, JSON.stringify(rankingTokens)));
  } else {
    repairActions.push(buildRepairAction('pull_on3_rankings', false, 'incomplete_on3_metadata'));
  }

  const gapsBefore = metricsGaps(metricsBefore);
  const gapsAfter = metricsGaps(metrics);

  return {
    metrics,
    research,
    repairActions,
    gapsBefore,
    gapsAfter,
    gapsFilled: gapsBefore.filter((g) => !gapsAfter.includes(g)),
    caseId: caseItem?.id || null
  };
}

function persistMetricsRepair(caseId, pack) {
  if (!caseId || !pack) return null;
  const caseRow = store.getCase(caseId);
  if (!caseRow) return null;

  const mergedHints = { ...(caseRow.hints || {}), metrics: pack.metrics };
  const mergedRepair = [...(caseRow.repairActions || []), ...(pack.repairActions || [])].slice(-40);

  store.updateCase(caseId, { hints: mergedHints, repairActions: mergedRepair });
  store.appendLog(caseId, {
    phase: 'repair',
    gapsBefore: pack.gapsBefore,
    gapsAfter: pack.gapsAfter,
    gapsFilled: pack.gapsFilled,
    metrics: pack.metrics,
    actionCount: pack.repairActions?.length || 0
  });

  return store.getCase(caseId);
}

module.exports = {
  enrichCaseMetrics,
  persistMetricsRepair,
  metricsGaps,
  buildRepairAction
};
