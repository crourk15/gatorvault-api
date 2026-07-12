const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function patch(file, edits) {
  const p = path.join(ROOT, file);
  let s = fs.readFileSync(p, 'utf8');
  for (const [oldStr, newStr] of edits) {
    if (!s.includes(oldStr)) throw new Error('patch miss in ' + file + ': ' + oldStr.slice(0, 80));
    s = s.replace(oldStr, newStr);
  }
  fs.writeFileSync(p, s, 'utf8');
  console.log('patched', file);
}

patch('lib/autoposter/detectives.js', [
  ["const DEDUPE_SKIP_REASONS = new Set(['duplicate_fingerprint','duplicate_commit','duplicate_text','similar_post','ladder_cycle','invalid_candidate']);", "const handoff = require('./detectives-handoff');"],
  ['function shouldHandoff(reason){return reason&&!DEDUPE_SKIP_REASONS.has(String(reason));}', 'function shouldHandoff(reason,payload){return handoff.shouldHandoff(reason,payload);}'],
  ["if(!shouldHandoff(payload.skipReason))return{ok:false,reason:'skip_dedupe'};", "if(!shouldHandoff(payload.skipReason,payload))return{ok:false,reason:'skip_not_eligible'};"],
  ["const pending=store.listCases({status:'pending',limit});", "function dismissJunkPending(){const junk=store.listCases({status:'pending',limit:100}).filter((c)=>handoff.isDismissibleCase(c));for(const row of junk){store.updateCase(row.id,{status:'expired',resolvedPath:'auto_dismissed'});store.appendLog(row.id,{phase:'dismiss',reason:'not_eligible'});}return junk.length;}const pending=handoff.sortCasesForProcessing(store.listCases({status:'pending',limit:Math.max(limit,50)}).filter((c)=>!handoff.isDismissibleCase(c))).slice(0,limit);dismissJunkPending();"]
]);

patch('lib/autoposter/detectives-store.js', [[`function listCases({ status = null, limit = 50 } = {}) {
  const doc = loadPile();
  let rows = [...doc.cases];
  if (status) rows = rows.filter((c) => c.status === status);
  rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return rows.slice(0, limit);
}`, `function listCases({ status = null, limit = 50, priority = false } = {}) {
  const doc = loadPile();
  let rows = [...doc.cases];
  if (status) rows = rows.filter((c) => c.status === status);
  if (status === 'pending' && priority) {
    try {
      const handoff = require('./detectives-handoff');
      rows = handoff.sortCasesForProcessing(rows);
    } catch {
      rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
  } else {
    rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  return rows.slice(0, limit);
}`]]);

const dashboard = `/** Detectives pile dashboard — admin visibility for beat intel research queue. */
const store = require('./detectives-store');
const handoff = require('./detectives-handoff');
const { detectivesEnabled } = require('./detectives');

function lastLogPhase(log, phase) {
  const rows = (log || []).filter((l) => l.phase === phase);
  return rows.length ? rows[rows.length - 1] : null;
}

function formatCaseForDashboard(caseItem) {
  const beat = caseItem?.beatPost || {};
  const cand = caseItem?.candidate || {};
  const hints = caseItem?.hints || {};
  const beatText = String(beat.text || beat.summary || cand.beatText || cand.text || hints.beatText || '').trim();
  const log = caseItem.investigationLog || [];
  const identityLog = lastLogPhase(log, 'identity');
  const platformLog = lastLogPhase(log, 'platform');
  const rejectLog = lastLogPhase(log, 'reject');
  const lastEntry = log.length ? log[log.length - 1] : null;
  return {
    id: caseItem.id,
    status: caseItem.status,
    skipReason: caseItem.skipReason,
    skipStage: caseItem.skipStage,
    createdAt: caseItem.createdAt,
    updatedAt: caseItem.updatedAt,
    attempts: caseItem.attempts,
    maxAttempts: caseItem.maxAttempts,
    priority: handoff.casePriority(caseItem),
    lastPhase: lastEntry?.phase || null,
    lastReject: rejectLog?.reason || null,
    playerName: identityLog?.playerName || cand.playerName || hints.playerName || null,
    playerSlug: identityLog?.playerSlug || cand.playerSlug || hints.playerSlug || null,
    writerName: beat.writerName || hints.writerName || null,
    beatHandle: beat.handle || hints.handle || null,
    beatText: beatText.slice(0, 280),
    beatUrl: beat.url || null,
    hasFutureCastContext: platformLog?.hasFutureCastContext ?? null,
    platformUrl: platformLog?.url || null,
    resolvedPath: caseItem.resolvedPath || null,
    queueItemId: caseItem.queueItemId || null,
    resolvedAt: caseItem.resolvedAt || null,
    resolvedPreview: caseItem.resolvedCandidate?.text || null,
    log: log.slice(-8),
  };
}

function getDetectivesDashboard({ status = null, limit = 50 } = {}) {
  const doc = store.loadPile();
  const counts = store.countByStatus();
  const usePriority = !status || status === 'pending';
  const rows = store.listCases({
    status,
    limit: Math.min(100, limit || 50),
    priority: usePriority,
  });
  return {
    enabled: detectivesEnabled(),
    updatedAt: doc.updatedAt,
    counts,
    cases: rows.map(formatCaseForDashboard),
  };
}

module.exports = { getDetectivesDashboard, formatCaseForDashboard };
`;
fs.writeFileSync(path.join(ROOT, 'lib/autoposter/detectives-dashboard.js'), dashboard, 'utf8');
console.log('patched lib/autoposter/detectives-dashboard.js');

patch('lib/beat-writer-ingest.js', [[`const DETECTIVES_NO_HANDOFF = new Set([
  'other_program_without_uf',
  'disallowed_account',
  'no_football_signal',
  'duplicate',
  'intel_duplicate',
  'snapshot',
  'stale',
  'stale_intel'
]);`, `const DETECTIVES_NO_HANDOFF = new Set([
  'missing_uf_context',
  'no_player_name',
  'other_program_without_uf',
  'disallowed_account',
  'no_football_signal',
  'duplicate',
  'intel_duplicate',
  'snapshot',
  'stale',
  'stale_intel'
]);`], ['if (!det.detectivesEnabled() || !det.shouldHandoff(reason)) return;', `if (!det.detectivesEnabled() || !det.shouldHandoff(reason, {
      beatPost: post,
      skipReason: reason,
      skipStage,
      hints: {
        handle: post?.handle,
        writerName: post?.writerName || post?.outlet,
        url: post?.url
      }
    })) return;`]]);

patch('lib/x-autoposter-fill.js', [[`    if (!det.detectivesEnabled() || !det.shouldHandoff(result.reason)) return result;
    const handoff = await det.handoffToDetectives({
      candidate: rawCandidate,
      beatPost: opts.beatPost || null,
      skipReason: result.reason,
      skipStage: opts.skipStage || 'enqueue',
      hints: {
        playerName: rawCandidate?.playerName,
        playerSlug: rawCandidate?.playerSlug,
        handle: opts.beatPost?.handle,`, `    const detectivesPayload = {
      candidate: rawCandidate,
      beatPost: opts.beatPost || null,
      skipReason: result.reason,
      skipStage: opts.skipStage || 'enqueue',
      hints: {
        playerName: rawCandidate?.playerName,
        playerSlug: rawCandidate?.playerSlug,
        handle: opts.beatPost?.handle,`], [`        url: opts.beatPost?.url
      }
    });
    if (handoff?.ok && !handoff.duplicate) {`, `        url: opts.beatPost?.url
      }
    };
    if (!det.detectivesEnabled() || !det.shouldHandoff(result.reason, detectivesPayload)) return result;
    const handoff = await det.handoffToDetectives(detectivesPayload);
    if (handoff?.ok && !handoff.duplicate) {`]]);

const adminPath = path.join(ROOT, 'admin-ops.html');
let admin = fs.readFileSync(adminPath, 'utf8');
const adminOld = "            return '<div style=\"margin-bottom:.85rem;padding-bottom:.65rem;border-bottom:1px solid #334155\">'+\n              '<strong>'+statusBadge(row.status)+'</strong> · '+esc(fmtTime(row.updatedAt||row.createdAt))+\n              ' · skip: '+esc(row.skipReason||'—')+'<br>'+";
const adminNew = "            return '<div style=\"margin-bottom:.85rem;padding-bottom:.65rem;border-bottom:1px solid #334155\">'+\n              '<strong>'+statusBadge(row.status)+'</strong> · '+esc(fmtTime(row.updatedAt||row.createdAt))+\n              (row.priority!=null?' · priority '+esc(row.priority):'')+\n              (row.attempts!=null?' · attempts '+esc(row.attempts)+'/'+esc(row.maxAttempts||'—'):'')+\n              (row.lastPhase?' · phase '+esc(row.lastPhase):'')+\n              ' · skip: '+esc(row.skipReason||'—')+\n              (row.lastReject?' · last reject: '+esc(row.lastReject):'')+'<br>'+";
if (!admin.includes(adminOld)) throw new Error('admin-ops patch miss');
admin = admin.replace(adminOld, adminNew);
fs.writeFileSync(adminPath, admin, 'utf8');
console.log('patched admin-ops.html');

require(path.join(ROOT, 'lib/autoposter/detectives.js'));
require(path.join(ROOT, 'lib/autoposter/detectives-handoff.js'));
require(path.join(ROOT, 'lib/autoposter/detectives-dashboard.js'));
console.log('all modules load OK');