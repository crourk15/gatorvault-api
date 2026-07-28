/**
 * Plain-English fix playbook for red/yellow ops tiles + App Store gate.
 * Used by Admin Hub top issues, ops strip, Full Ops cards, Coach panel.
 */
'use strict';

const PLAYBOOK = {
  'film-room': {
    why: 'Film Room catalog is stale — the public Film Room list is out of date.',
    howTo: 'Click Rebuild Film Room catalog. Wait 1–2 minutes, then Refresh. It should leave red.',
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
    why: 'API is returning elevated errors.',
    howTo: 'Wait 1–2 minutes (kitchen may be waking). If still red, open Runbooks → Deploy recovery.',
    fixLabel: 'Open Runbooks',
    jobId: null,
    route: '#dashboard/runbooks',
  },
  'db-health': {
    why: 'Database errors or slow queries spiked.',
    howTo: 'Open Runbooks / Full Ops logs. Do not spam jobs — check errors first.',
    fixLabel: 'Open Full Ops',
    jobId: null,
    route: '#dashboard/ops',
  },
  autoposter: {
    why: 'Autoposter has not posted or needs attention.',
    howTo: 'Open Beat Desk / Post Studio and post manually if needed. Check autoposter logs in Full Ops.',
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
    plain: 'The kitchen (API) is not ready yet.',
    step: 'Wait 1–2 minutes and Refresh. If it stays bad, open Runbooks → Deploy recovery.',
  },
  crawler_failures: {
    plain: 'The site crawler found page errors.',
    step: 'Open QA Monitor, note what failed, then Run QA crawl again after fixes.',
  },
  api_failures: {
    plain: 'Some API checks failed during the QA crawl.',
    step: 'Wait a minute (kitchen may be waking), then Run QA crawl again.',
  },
};

function gateReasonPlain(reason, piMin) {
  const r = String(reason || '');
  if (GATE_REASON_COPY[r]) return GATE_REASON_COPY[r];
  const m = r.match(/^product_intel_below_(\d+)$/);
  if (m) {
    const need = Number(m[1]) || piMin || 90;
    return {
      plain: `Product Health score is below ${need}. That score is a report card for the vault site — not Apple rejecting the app.`,
      step: 'Open Product Health, click Recompute product scores. If red ops tiles exist (Film Room, recruiting, etc.), fix those first — they pull the score down.',
    };
  }
  return {
    plain: `Gate check failed: ${r}.`,
    step: 'Open Command Center / Runbooks and follow the Fix buttons on red tiles.',
  };
}

function forTile(tile) {
  const id = String(tile?.id || '').toLowerCase();
  const base = PLAYBOOK[id] || {
    why: `${tile?.label || 'This module'} needs attention.`,
    howTo: 'Open Ops Summary and use the Fix button, or open Runbooks if you are unsure.',
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

function coachFromParts({ title, why, howTo, dontWorry, steps }) {
  return {
    title: title || 'Coach',
    plain: why || '',
    howTo: howTo || '',
    steps: Array.isArray(steps) ? steps : [],
    dontWorry: dontWorry || '',
  };
}

function enrichIssueFromTile(tile) {
  const pb = forTile(tile);
  return {
    severity: tile.status === 'red' ? 'red' : 'yellow',
    title: tile.label || tile.id,
    detail: tile.summary || 'Subsystem unhealthy',
    why: pb.why,
    fixHowTo: pb.howTo,
    action: pb.fixLabel,
    actionType: pb.jobId || null,
    route: pb.route,
    tileId: pb.tileId,
    coach: coachFromParts({
      title: tile.label || tile.id,
      why: pb.why,
      howTo: pb.howTo,
      steps: [pb.howTo],
      dontWorry: 'This is a kitchen / data refresh — not an App Store Connect emergency.',
    }),
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
      fixHowTo: 'Nothing urgent. Keep posting on Beat Desk. If something turns red later today, fix that — one red day resets the streak.',
      action: 'Open Product Health',
      actionType: null,
      route: '#product-intel/summary',
      coach: coachFromParts({
        title: 'App Store gate (in progress)',
        why: `You are on day ${days} of ${need}. Green means the site checks passed that day.`,
        howTo: 'No button to mash. Keep the kitchen healthy. Finish today’s Beat Desk posts.',
        steps: [
          'Do today’s Beat Desk posts as usual.',
          'If Top Issue turns red later, fix that red thing the same day.',
          `After ${need} green days in a row, the gate turns ready — then we talk App Store Connect.`,
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

  let action = 'Open Product Health';
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
    why: `${reasonPlain}${scoreBit} This is an internal “ready for a calm App Store week” checklist — not a message from Apple.`,
    fixHowTo: steps[0] || 'Open Product Health and Recompute. Fix any red ops tiles first.',
    action,
    actionType,
    route,
    coach: coachFromParts({
      title: 'App Store gate',
      why: `${reasonPlain}${scoreBit}`,
      howTo: steps[0] || 'Open Product Health.',
      steps: [
        ...steps,
        'Refresh Command Center when jobs finish.',
        'A green day only counts after the daily sample records — one bad day resets the 7-day streak.',
      ],
      dontWorry: 'You do NOT need to open App Store Connect for this. Fix kitchen health / Product Health first. Keep posting on Beat Desk.',
    }),
  };
}

function enrichQaIssue(qa) {
  if (!qa || qa.pass !== false) return null;
  const detail = `${qa.failed || 0} failed checks`;
  const howTo = 'Click Run QA crawl (or open QA Monitor). Wait for results. Fix red ops tiles if the crawl points at them.';
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
};
