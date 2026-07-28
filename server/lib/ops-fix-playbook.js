/**
 * Plain-English fix playbook for red/yellow ops tiles + App Store gate.
 * Used by Admin Hub top issues, ops strip, Full Ops cards, Coach panel.
 */
'use strict';

const PLAYBOOK = {
  'film-room': {
    why: 'Film Room catalog is stale — the public Film Room list is out of date.',
    howTo: 'Click Rebuild Film Room catalog. Wait 1–2 minutes, then Refresh.',
    fixLabel: 'Rebuild Film Room catalog',
    jobId: 'film-room-weekly',
    route: '#dashboard/ops-summary',
  },
  'recruiting-board': {
    why: 'Recruiting board data is stale or unhealthy.',
    howTo: 'Click Run recruiting ingest. Wait for it to finish, then Refresh.',
    fixLabel: 'Run recruiting ingest',
    jobId: 'recruiting-ingest',
    route: '#dashboard/ops-summary',
  },
  'portal-tracker': {
    why: 'Portal tracker has not refreshed recently.',
    howTo: 'Click Re-run portal ingest, wait, then Refresh.',
    fixLabel: 'Re-run portal ingest',
    jobId: 'portal-ingest',
    route: '#dashboard/ops-summary',
  },
  'nil-tracker': {
    why: 'NIL tracker is stale.',
    howTo: 'Click Re-run NIL refresh, wait, then Refresh.',
    fixLabel: 'Re-run NIL refresh',
    jobId: 'nil-refresh',
    route: '#dashboard/ops-summary',
  },
  'depth-gamezone': {
    why: 'Depth chart / Game Zone data is stale.',
    howTo: 'Click Re-run depth chart (and lines if still red). Wait, then Refresh.',
    fixLabel: 'Re-run depth chart',
    jobId: 'depth-chart-refresh',
    route: '#dashboard/ops-summary',
  },
  'insider-articles': {
    why: 'Insider article drafts need attention.',
    howTo: 'Open Insider Articles / generate drafts, then review pending drafts.',
    fixLabel: 'Generate article drafts',
    jobId: 'article-engine-weekly-draft',
    route: '#content/insider-articles',
  },
  'identity-patterns': {
    why: 'Identity patterns need a rebuild or review.',
    howTo: 'Open the Identity Patterns manager and rebuild if prompted.',
    fixLabel: 'Open Identity Patterns',
    jobId: null,
    route: '#gm2/identity',
  },
  'api-health': {
    why: 'The server looks unhealthy.',
    howTo: 'Wait 90 seconds, press Refresh. If still red after 2 tries, open Runbooks.',
    fixLabel: 'Refresh now',
    jobId: 'hub-refresh',
    route: '#dashboard/overview',
  },
  'db-health': {
    why: 'The database looks slow or erroring.',
    howTo: 'Wait 90 seconds and Refresh. Do not spam jobs. If still red, open Full Ops logs.',
    fixLabel: 'Refresh now',
    jobId: 'hub-refresh',
    route: '#dashboard/overview',
  },
  autoposter: {
    why: 'Autoposter has not posted or needs attention.',
    howTo: 'Open Beat Desk and post manually if needed.',
    fixLabel: 'Open Beat Desk',
    jobId: null,
    route: '#beat-desk/desk',
  },
};

/** Machine reason codes → Charles-language lines */
const GATE_REASON_COPY = {
  qa_crawl_failed: {
    plain: 'The automatic website check (QA crawl) did not pass today.',
    step: 'Click Run QA crawl. Wait for it to finish, then Refresh.',
  },
  health_not_ready: {
    plain: 'The server is still starting.',
    step: 'Wait 90 seconds and press Refresh.',
  },
  crawler_failures: {
    plain: 'The site crawler found page errors.',
    step: 'Open QA Monitor, note what failed, then Run QA crawl again after fixes.',
  },
  api_failures: {
    plain: 'Some API checks failed during the QA crawl.',
    step: 'Wait a minute, then Run QA crawl again.',
  },
};

function gateReasonPlain(reason, piMin) {
  const r = String(reason || '');
  if (GATE_REASON_COPY[r]) return GATE_REASON_COPY[r];
  const m = r.match(/^product_intel_below_(\d+)$/);
  if (m) {
    const need = Number(m[1]) || piMin || 90;
    return {
      plain: `Product Health score is below ${need}. That is a vault report card — not Apple rejecting the app.`,
      step: 'Only after red tiles are fixed: open Product Health → Recompute. Ignore Recompute while API Health is red.',
    };
  }
  return {
    plain: `Gate check failed: ${r}.`,
    step: 'Follow the Coach “Do this now” steps on Command Center.',
  };
}

function parseApiSummary(summary) {
  const s = String(summary || '');
  const ms = s.match(/(\d+)\s*ms\s*avg/i);
  const five = s.match(/(\d+)\s*%\s*5xx/i);
  return {
    avgMs: ms ? Number(ms[1]) : null,
    fivePct: five ? Number(five[1]) : null,
  };
}

function forTile(tile) {
  const id = String(tile?.id || '').toLowerCase();
  const base = PLAYBOOK[id] || {
    why: `${tile?.label || 'This module'} needs attention.`,
    howTo: 'Open Ops Summary and use the Fix button, or follow Coach on Command Center.',
    fixLabel: 'Open Ops Summary',
    jobId: null,
    route: '#dashboard/ops-summary',
  };
  return {
    ...base,
    tileId: id,
    status: tile?.status || null,
    summary: tile?.summary || null,
  };
}

function coachFromParts({ title, why, howTo, dontWorry, steps, doThisNow, autoWaitSec, mode }) {
  return {
    title: title || 'Coach',
    plain: why || '',
    howTo: howTo || '',
    doThisNow: doThisNow || howTo || '',
    steps: Array.isArray(steps) ? steps : [],
    dontWorry: dontWorry || '',
    autoWaitSec: autoWaitSec || null,
    mode: mode || null,
  };
}

function specializeApiHealth(tile, pb) {
  const { avgMs, fivePct } = parseApiSummary(tile.summary);
  const slowOnly = (fivePct === 0 || fivePct == null) && avgMs != null && avgMs >= 800;
  const hasServerErrors = fivePct != null && fivePct > 0;

  if (slowOnly && !hasServerErrors) {
    return {
      why: `The server is waking up (slow replies, ${avgMs}ms). Error rate is 0% — that is normal after sleep.`,
      howTo: 'Sit tight. Do not run Deploy recovery yet. This screen will refresh itself.',
      fixLabel: 'I’m waiting — refresh for me',
      jobId: 'hub-auto-wait',
      route: '#dashboard/overview',
      doThisNow: 'Do nothing. Sit tight ~90 seconds. Do NOT press Deploy recovery.',
      autoWaitSec: 90,
      mode: 'auto-wait',
      steps: [
        'Do nothing — the hub will refresh itself.',
        'Do not run Deploy recovery while the top banner says the server is waking.',
        'When API Health leaves red, go to Beat Desk and post.',
      ],
      dontWorry: 'Those Deploy recovery “Waking kitchen” fails are expected if you click early. Ignore Recompute too.',
    };
  }

  if (hasServerErrors) {
    return {
      why: `The server returned real errors (${fivePct}% of recent requests).`,
      howTo: 'Wait 90 seconds and Refresh once. If still red, open Runbooks → Deploy recovery.',
      fixLabel: 'Refresh now',
      jobId: 'hub-refresh',
      route: '#dashboard/runbooks',
      doThisNow: 'Refresh once. If still red after 2 minutes, open Runbooks.',
      steps: [
        'Press Refresh now once.',
        'Wait up to 2 minutes.',
        'Refresh again.',
        'If still red, open Runbooks and run Deploy recovery (or ping support).',
      ],
      dontWorry: 'Finish or pause Beat Desk posts until green if Open/Check API keeps failing.',
    };
  }

  return {
    why: pb.why,
    howTo: pb.howTo,
    fixLabel: 'Refresh now',
    jobId: 'hub-refresh',
    route: pb.route || '#dashboard/overview',
    doThisNow: 'Wait 90 seconds, then press Refresh now.',
    steps: [
      'Wait about 90 seconds.',
      'Press Refresh now.',
      'If still red after 2 tries, open Runbooks.',
    ],
    dontWorry: 'Not an App Store Connect emergency.',
  };
}

function enrichIssueFromTile(tile) {
  const pb = forTile(tile);
  let specialized = null;
  if (pb.tileId === 'api-health') specialized = specializeApiHealth(tile, pb);
  if (pb.tileId === 'db-health') {
    specialized = {
      why: 'The database looks slow or busy.',
      howTo: 'Wait 90 seconds and press Refresh. Do not spam jobs.',
      fixLabel: 'Refresh now',
      jobId: 'hub-refresh',
      route: '#dashboard/overview',
      doThisNow: 'Wait 90 seconds, then press Refresh now.',
      steps: [
        'Wait about 90 seconds.',
        'Press Refresh now.',
        'If still red, open Full Ops → Logs (do not re-run many jobs).',
      ],
      dontWorry: 'Not an App Store Connect emergency.',
    };
  }

  const pack = specialized || {
    why: pb.why,
    howTo: pb.howTo,
    fixLabel: pb.fixLabel,
    jobId: pb.jobId,
    route: pb.route,
    doThisNow: pb.howTo,
    steps: [pb.howTo],
    dontWorry: 'Follow the orange button. Not an App Store Connect emergency unless Coach says otherwise.',
    autoWaitSec: null,
    mode: null,
  };

  return {
    severity: tile.status === 'red' ? 'red' : 'yellow',
    title: tile.label || tile.id,
    detail: tile.summary || 'Needs attention',
    why: pack.why,
    fixHowTo: pack.howTo,
    action: pack.fixLabel,
    actionType: pack.jobId || null,
    route: pack.route,
    tileId: pb.tileId,
    coach: coachFromParts({
      title: tile.label || tile.id,
      why: pack.why,
      howTo: pack.howTo,
      doThisNow: pack.doThisNow,
      steps: pack.steps,
      dontWorry: pack.dontWorry,
      autoWaitSec: pack.autoWaitSec,
      mode: pack.mode,
    }),
    autoWaitSec: pack.autoWaitSec || null,
    mode: pack.mode || null,
  };
}

/**
 * @param {object|null} appStoreGate summarizeAppStoreGate() shape
 */
function enrichAppStoreGateIssue(appStoreGate) {
  if (!appStoreGate) return null;
  const evaln = appStoreGate.evaluation || {};
  const reasons = Array.isArray(evaln.reasons) ? evaln.reasons : [];
  const piMin = appStoreGate.piMin || 90;
  const score = evaln.productIntelOverall != null
    ? evaln.productIntelOverall
    : (appStoreGate.sample && appStoreGate.sample.productIntelOverall);
  const days = appStoreGate.consecutiveGreenDays || 0;
  const need = appStoreGate.requiredDays || 7;

  if (evaln.green) {
    if (appStoreGate.readyForSubmission) return null;
    return {
      severity: 'yellow',
      title: 'App Store gate — building a green streak',
      detail: `Day ${days}/${need} green`,
      why: `Today looks OK. You need ${need} green days in a row before the stability gate says ready.`,
      fixHowTo: 'Nothing urgent. Keep posting on Beat Desk.',
      action: 'Go to Beat Desk',
      actionType: null,
      route: '#beat-desk/desk',
      coach: coachFromParts({
        title: 'App Store gate (in progress)',
        why: `You are on day ${days} of ${need}. Green means the site checks passed that day.`,
        howTo: 'No button to mash. Keep the server healthy and finish today’s posts.',
        doThisNow: 'Go make today’s Beat Desk posts.',
        steps: [
          'Do today’s Beat Desk posts as usual.',
          'If Top Issue turns red later, fix that red thing the same day.',
          `After ${need} green days in a row, the gate turns ready.`,
        ],
        dontWorry: 'Yellow here is patience, not a fire.',
      }),
    };
  }

  const copies = reasons.map((r) => gateReasonPlain(r, piMin));
  const onlyPi = reasons.length === 1 && /^product_intel_below_/.test(reasons[0]);
  const hasQa = reasons.includes('qa_crawl_failed') || reasons.includes('crawler_failures') || reasons.includes('api_failures');
  const scoreBit = score != null ? ` Product Health score right now: ${score} (need ${piMin}+).` : '';
  const reasonPlain = copies.map((c) => c.plain).join(' ');
  const steps = copies.map((c) => c.step);

  let action = 'Recompute product scores';
  let actionType = 'pi-recompute';
  let route = '#product-intel/summary';
  if (hasQa) {
    action = 'Run QA crawl';
    actionType = 'qa-run';
    route = '#qa/monitor';
  }

  return {
    severity: onlyPi ? 'yellow' : 'red',
    title: 'App Store gate — today not green',
    detail: score != null
      ? `Score ${score}/${piMin}+ · ${reasons.join(', ') || 'criteria not met'}`
      : (reasons.join(', ') || 'criteria not met'),
    why: `${reasonPlain}${scoreBit} Internal checklist — not a message from Apple.`,
    fixHowTo: steps[0] || 'Open Product Health and Recompute after red tiles are fixed.',
    action,
    actionType,
    route,
    coach: coachFromParts({
      title: 'App Store gate',
      why: `${reasonPlain}${scoreBit}`,
      howTo: steps[0] || 'Open Product Health.',
      doThisNow: hasQa ? 'Run QA crawl.' : 'Fix red tiles first, then Recompute product scores.',
      steps: [
        'If any ops tile is red (API, Film Room, etc.), fix that first.',
        ...steps,
        'Refresh Command Center when jobs finish.',
      ],
      dontWorry: 'Do NOT open App Store Connect for this. Keep posting on Beat Desk.',
    }),
  };
}

function enrichQaIssue(qa) {
  if (!qa || qa.pass !== false) return null;
  const detail = `${qa.failed || 0} failed checks`;
  const howTo = 'Click Run QA crawl. Wait for results.';
  return {
    severity: 'red',
    title: 'QA crawl failing',
    detail,
    why: 'The automatic site check found failures.',
    fixHowTo: howTo,
    action: 'Run crawl',
    actionType: 'qa-run',
    route: '#qa/monitor',
    coach: coachFromParts({
      title: 'QA crawl',
      why: 'QA is a robot that clicks through the vault site looking for broken pages.',
      howTo,
      doThisNow: 'Press Run crawl.',
      steps: [howTo, 'If the same pages keep failing, open Runbooks → “QA is red”.'],
      dontWorry: 'This is site health — not your X posting workflow.',
    }),
  };
}

module.exports = {
  PLAYBOOK,
  GATE_REASON_COPY,
  forTile,
  enrichIssueFromTile,
  enrichAppStoreGateIssue,
  enrichQaIssue,
  gateReasonPlain,
  coachFromParts,
  parseApiSummary,
  specializeApiHealth,
};
