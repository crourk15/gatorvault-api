/**
 * Self-Runner v3 — Playbook registry (Issue -> governed fix).
 */
const { normalizeFixType } = require('./issue-model');

const PLAYBOOKS = [
  {
    id: 'data-uuid-integrity',
    label: 'UUID / Data Integrity',
    fixType: 'data',
    issueTypes: ['uuid_mismatch', 'invalid_uuid', 'slug_in_uuid_column'],
    subsystems: ['recruiting', 'portal', 'database'],
    riskLevel: 'low',
    reversible: true,
    autoHealMinConfidence: 85,
    steps: [
      'Validate UUID format on player rows',
      'Reject invalid IDs before DB write',
      'Resolve UUID by slug lookup',
      'Re-run affected ingest job',
      'Verify DB integrity check passes'
    ],
    patchTypes: ['schema-field-v2', 'uuid-guard'],
    opsJobs: ['recruiting-ingest', 'portal-ingest']
  },
  {
    id: 'cron-auth-resync',
    label: 'Cron / Auth Resync',
    fixType: 'cron',
    issueTypes: ['auth_mismatch', 'cron_401', 'cron_403', 'heartbeat_missing'],
    subsystems: ['cron', 'ops', 'ingest'],
    riskLevel: 'low',
    reversible: true,
    autoHealMinConfidence: 80,
    steps: [
      'Check cron secret env vars',
      'Detect 401/403 in cron logs',
      'Unify auth headers',
      'Verify cron heartbeat green'
    ],
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
    steps: [
      'Check beat-writer ingest logs',
      'Force-run beat ingest + queue processor',
      'Verify post created'
    ],
    patchTypes: ['autoposter-force-run'],
    opsJobs: ['beat-writer-ingest', 'beat-late-ingest', 'x-autoposter-run']
  },
  {
    id: 'feed-dedupe-repair',
    label: 'Feed Dedupe Repair',
    fixType: 'data',
    issueTypes: ['dedupe', 'feed_integrity', 'duplicate_hash'],
    subsystems: ['feed', 'live', 'autoposter'],
    riskLevel: 'low',
    reversible: true,
    autoHealMinConfidence: 90,
    steps: ['Run SHA-256 dedupe', 'Repair feed-items.json', 'Verify Live Feed API'],
    patchTypes: ['feed-dedup-v2'],
    opsJobs: ['feed-repair', 'post-deploy-feed-cleanup']
  },
  {
    id: 'recruiting-ingest-recover',
    label: 'Recruiting Ingest Recovery',
    fixType: 'ingest',
    issueTypes: ['ingest_failure', 'ingest_stuck', 'ingest_error'],
    subsystems: ['recruiting', 'on3', 'rivals'],
    riskLevel: 'low',
    reversible: true,
    autoHealMinConfidence: 70,
    steps: ['Check fetch status', 'Validate rows', 'Re-run ingest'],
    patchTypes: ['schema-field-v2'],
    opsJobs: ['recruiting-ingest']
  },
  {
    id: 'portal-sync-recover',
    label: 'Portal Sync Recovery',
    fixType: 'ingest',
    issueTypes: ['sync_stuck', 'sync_failure', 'portal_stale'],
    subsystems: ['portal', 'recruiting'],
    riskLevel: 'low',
    reversible: true,
    autoHealMinConfidence: 75,
    steps: ['Check portal fetch', 'Re-run portal sync'],
    patchTypes: ['schema-field-v2'],
    opsJobs: ['portal-ingest']
  },
  {
    id: 'war-room-refresh',
    label: 'War Room Data Refresh',
    fixType: 'data',
    issueTypes: ['stale_scouting', 'missing_card', 'war_room_stale'],
    subsystems: ['war-room', 'scouting'],
    riskLevel: 'low',
    reversible: true,
    autoHealMinConfidence: 70,
    steps: ['Validate schemas', 'Queue scouting refresh'],
    patchTypes: ['war-room-refresh', 'queue-scouting-refresh'],
    opsJobs: []
  },
  {
    id: 'film-source-repair',
    label: 'Film Room Source Repair',
    fixType: 'data',
    issueTypes: ['sources_broken', 'film_sources', 'broken_url'],
    subsystems: ['film-room', 'content'],
    riskLevel: 'low',
    reversible: true,
    autoHealMinConfidence: 85,
    steps: ['Scan broken URLs', 'Replace fallbacks', 'Verify catalog API'],
    patchTypes: ['film-source-url'],
    opsJobs: []
  },
  {
    id: 'cache-rebuild',
    label: 'Cache Rebuild',
    fixType: 'config',
    issueTypes: ['cache_stale', 'hub_stale'],
    subsystems: ['cache', 'hub', 'live'],
    riskLevel: 'low',
    reversible: true,
    autoHealMinConfidence: 65,
    steps: ['Trigger hub + live refresh'],
    patchTypes: [],
    opsJobs: ['hub-refresh', 'live-refresh']
  }
];

const PROPOSE_ONLY_PLAYBOOKS = [
  {
    id: 'layout-ux-guarded',
    label: 'Layout / UX (Manual Only)',
    fixType: 'layout',
    issueTypes: ['overflow', 'clipping', 'modal_layering'],
    subsystems: ['ux', 'visual-integrity'],
    riskLevel: 'high',
    proposeOnly: true,
    autoHealMinConfidence: 100,
    steps: ['QA + Product Health must agree', 'CSS/props only — no React structure'],
    patchTypes: ['react-css'],
    opsJobs: []
  }
];

function allPlaybooks() {
  return [...PLAYBOOKS, ...PROPOSE_ONLY_PLAYBOOKS];
}

function findPlaybookForIssue(issue) {
  const subsystem = String(issue.subsystem || '').toLowerCase();
  const type = String(issue.type || '').toLowerCase();
  const checkId = String(issue.checkId || '').toLowerCase();

  for (const pb of allPlaybooks()) {
    const subsystemMatch =
      !pb.subsystems?.length || pb.subsystems.some((s) => subsystem.includes(s) || checkId.includes(s));
    const typeMatch =
      !pb.issueTypes?.length || pb.issueTypes.some((t) => type.includes(t) || checkId.includes(t.replace(/_/g, '-')));
    if (subsystemMatch && typeMatch) return pb;
  }

  if (/feed-dedup|autoposter-dedup/.test(checkId)) return getPlaybook('feed-dedupe-repair');
  if (/film-sources/.test(checkId)) return getPlaybook('film-source-repair');
  if (/uuid|invalid.input.syntax/.test(checkId + type)) return getPlaybook('data-uuid-integrity');
  if (/autoposter|stale|no_posts/.test(checkId + type + subsystem)) return getPlaybook('autoposter-stale-force');
  if (/cron|401|403|auth/.test(checkId + type)) return getPlaybook('cron-auth-resync');
  if (/portal|sync/.test(checkId + subsystem)) return getPlaybook('portal-sync-recover');
  if (/recruiting|on3|rivals|ingest/.test(checkId + subsystem)) return getPlaybook('recruiting-ingest-recover');
  if (/war-room|scouting/.test(checkId + subsystem)) return getPlaybook('war-room-refresh');
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

function listTrustedPlaybooks(confidenceMap = {}) {
  return PLAYBOOKS.map((pb) => ({
    ...pb,
    confidence: confidenceMap[pb.id] ?? 50,
    autoHealEligible: isAutoHealEligible(pb, confidenceMap[pb.id] ?? 50)
  }));
}

module.exports = {
  PLAYBOOKS,
  PROPOSE_ONLY_PLAYBOOKS,
  allPlaybooks,
  findPlaybookForIssue,
  getPlaybook,
  isAutoHealEligible,
  listTrustedPlaybooks
};
