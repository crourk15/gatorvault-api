/**
 * Self-Runner v3 — Playbook registry.
 */
const { normalizeFixType } = require('./issue-model');

const PLAYBOOKS = [
  {
    id: 'data-uuid-integrity',
    label: 'UUID / Data Integrity',
    fixType: 'data',
    issueTypes: ['uuid_mismatch', 'invalid_uuid'],
    subsystems: ['recruiting', 'portal', 'database'],
    riskLevel: 'low',
    reversible: true,
    autoHealMinConfidence: 85,
    steps: ['Validate UUID', 'Resolve by slug', 'Re-run ingest', 'Verify DB'],
    patchTypes: ['schema-field-v2'],
    opsJobs: ['recruiting-ingest', 'portal-ingest']
  },
  {
    id: 'cron-auth-resync',
    label: 'Cron / Auth Resync',
    fixType: 'cron',
    issueTypes: ['auth_mismatch', 'cron_401', 'heartbeat_missing'],
    subsystems: ['cron', 'ops'],
    riskLevel: 'low',
    reversible: true,
    autoHealMinConfidence: 80,
    steps: ['Check env vars', 'Unify auth headers', 'Verify heartbeat'],
    patchTypes: ['cron-resync'],
    opsJobs: ['ops-healthcheck']
  },
  {
    id: 'autoposter-stale-force',
    label: 'Autoposter Stale Recovery',
    fixType: 'cron',
    issueTypes: ['stale', 'no_posts_yet', 'queue_empty'],
    subsystems: ['autoposter'],
    riskLevel: 'low',
    reversible: true,
    autoHealMinConfidence: 75,
    steps: ['Check ingest', 'Force beat + queue run', 'Verify post'],
    patchTypes: ['autoposter-force-run'],
    opsJobs: ['beat-writer-ingest', 'x-autoposter-run']
  },
  {
    id: 'feed-dedupe-repair',
    label: 'Feed Dedupe Repair',
    fixType: 'data',
    issueTypes: ['dedupe', 'feed_integrity'],
    subsystems: ['feed', 'live'],
    riskLevel: 'low',
    reversible: true,
    autoHealMinConfidence: 90,
    steps: ['SHA-256 dedupe', 'Repair feed-items.json', 'Verify API'],
    patchTypes: ['feed-dedup-v2'],
    opsJobs: ['feed-repair']
  },
  {
    id: 'recruiting-ingest-recover',
    label: 'Recruiting Ingest Recovery',
    fixType: 'ingest',
    issueTypes: ['ingest_failure', 'ingest_stuck'],
    subsystems: ['recruiting', 'on3'],
    riskLevel: 'low',
    reversible: true,
    autoHealMinConfidence: 70,
    steps: ['Check fetch', 'Validate rows', 'Re-run ingest'],
    patchTypes: ['schema-field-v2'],
    opsJobs: ['recruiting-ingest']
  },
  {
    id: 'portal-sync-recover',
    label: 'Portal Sync Recovery',
    fixType: 'ingest',
    issueTypes: ['sync_stuck', 'sync_failure'],
    subsystems: ['portal'],
    riskLevel: 'low',
    reversible: true,
    autoHealMinConfidence: 75,
    steps: ['Check portal fetch', 'Re-run sync'],
    patchTypes: ['schema-field-v2'],
    opsJobs: ['portal-ingest']
  },
  {
    id: 'war-room-refresh',
    label: 'War Room Refresh',
    fixType: 'data',
    issueTypes: ['stale_scouting', 'missing_card'],
    subsystems: ['war-room'],
    riskLevel: 'low',
    reversible: true,
    autoHealMinConfidence: 70,
    steps: ['Validate JSON', 'Queue scouting refresh'],
    patchTypes: ['war-room-refresh', 'queue-scouting-refresh'],
    opsJobs: []
  },
  {
    id: 'film-source-repair',
    label: 'Film Source Repair',
    fixType: 'data',
    issueTypes: ['sources_broken', 'film_sources'],
    subsystems: ['film-room'],
    riskLevel: 'low',
    reversible: true,
    autoHealMinConfidence: 85,
    steps: ['Find broken URLs', 'Replace fallbacks'],
    patchTypes: ['film-source-url'],
    opsJobs: []
  },
  {
    id: 'cache-rebuild',
    label: 'Cache Rebuild',
    fixType: 'config',
    issueTypes: ['cache_stale', 'hub_stale'],
    subsystems: ['hub', 'live'],
    riskLevel: 'low',
    reversible: true,
    autoHealMinConfidence: 65,
    steps: ['Hub refresh', 'Live refresh'],
    patchTypes: [],
    opsJobs: ['hub-refresh', 'live-refresh']
  }
];

const PROPOSE_ONLY = [
  {
    id: 'layout-ux-guarded',
    label: 'Layout / UX (Manual Only)',
    fixType: 'layout',
    issueTypes: ['overflow', 'clipping'],
    subsystems: ['ux', 'visual-integrity'],
    proposeOnly: true,
    autoHealMinConfidence: 100,
    patchTypes: ['react-css'],
    opsJobs: []
  }
];

function allPlaybooks() {
  return [...PLAYBOOKS, ...PROPOSE_ONLY];
}

function findPlaybookForIssue(issue) {
  const subsystem = String(issue.subsystem || '').toLowerCase();
  const type = String(issue.type || '').toLowerCase();
  const checkId = String(issue.checkId || '').toLowerCase();
  for (const pb of allPlaybooks()) {
    const subOk = !pb.subsystems?.length || pb.subsystems.some((s) => subsystem.includes(s) || checkId.includes(s));
    const typeOk = !pb.issueTypes?.length || pb.issueTypes.some((t) => type.includes(t) || checkId.includes(t));
    if (subOk && typeOk) return pb;
  }
  if (/feed-dedup|autoposter-dedup/.test(checkId)) return getPlaybook('feed-dedupe-repair');
  if (/film-sources/.test(checkId)) return getPlaybook('film-source-repair');
  if (/uuid/.test(checkId + type)) return getPlaybook('data-uuid-integrity');
  if (/autoposter|stale|no_posts/.test(checkId + type + subsystem)) return getPlaybook('autoposter-stale-force');
  if (/portal/.test(checkId + subsystem)) return getPlaybook('portal-sync-recover');
  if (/recruiting|ingest/.test(checkId + subsystem)) return getPlaybook('recruiting-ingest-recover');
  return null;
}

function getPlaybook(id) {
  return allPlaybooks().find((p) => p.id === id) || null;
}

function isAutoHealEligible(playbook, confidence) {
  if (!playbook || playbook.proposeOnly) return false;
  if (['layout', 'code'].includes(normalizeFixType(playbook.fixType))) return false;
  return confidence >= (playbook.autoHealMinConfidence ?? 90);
}

module.exports = { PLAYBOOKS, allPlaybooks, findPlaybookForIssue, getPlaybook, isAutoHealEligible };
