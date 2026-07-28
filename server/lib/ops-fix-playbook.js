/**
 * Plain-English fix playbook for red/yellow ops tiles.
 * Used by Admin Hub top issues, ops strip, Full Ops cards.
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
  };
}

module.exports = {
  PLAYBOOK,
  forTile,
  enrichIssueFromTile,
};
