#!/usr/bin/env node
/**
 * Bulk-create FutureCast GitHub issues from the platform spec.
 *
 * Usage:
 *   node scripts/create-futurecast-github-issues.js
 *   node scripts/create-futurecast-github-issues.js --dry-run
 *
 * Requires: gh CLI authenticated (gh auth login)
 */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SPEC = 'server/docs/futurecast-platform-spec.md';
const DRY = process.argv.includes('--dry-run');

const LABELS = [
  'futurecast',
  'phase-0-scaffolding',
  'phase-1-data-model',
  'phase-2-engines',
  'phase-3-api',
  'phase-4-frontend'
];

const issues = [
  // Phase 0
  { phase: 'phase-0-scaffolding', title: 'FutureCast: adopt platform spec as source of truth', body: phaseBody('0', SPEC, 'Commit and link `server/docs/futurecast-platform-spec.md` in README.', [], ['Spec committed to main']) },
  { phase: 'phase-0-scaffolding', title: 'FutureCast: create server/models scaffolding', body: phaseBody('0', SPEC, 'Placeholder model files with types + stub CRUD.', ['server/models/*.ts', 'server/models/README.md'], ['All 6 model files exist', 'Interfaces match spec §1']) },
  { phase: 'phase-0-scaffolding', title: 'FutureCast: create engines/futurecast scaffolding', body: phaseBody('0', SPEC, 'Early discovery, portal-intel, uf-fit engine folders.', ['server/engines/futurecast/**'], ['index/pipeline/support files present', 'README per engine']) },
  { phase: 'phase-0-scaffolding', title: 'FutureCast: create api/v1 scaffolding', body: phaseBody('0', SPEC, 'API handler stubs for players, futurecast, admin.', ['server/api/v1/**'], ['501 handlers return TODO message', 'Spec §3 referenced in comments']) },
  { phase: 'phase-0-scaffolding', title: 'FutureCast: create client/ React scaffolding', body: phaseBody('0', SPEC, 'Routes + components for Big Board and Profiles 2.0.', ['client/routes/futurecast/**', 'client/components/futurecast/**'], ['Tab route files exist', 'PlayerCard + badges stubbed']) },
  { phase: 'phase-0-scaffolding', title: 'FutureCast: extend tsconfig for TS scaffolding', body: phaseBody('0', SPEC, 'Include server/**/*.ts and client/**/*.tsx in tsconfig.', ['tsconfig.json'], ['Typecheck includes new paths']) },
  { phase: 'phase-0-scaffolding', title: 'FutureCast: add engine config JSON', body: phaseBody('0', SPEC, 'Weights, priority positions, thresholds.', ['server/data/futurecast/config.json'], ['UF fit weights match spec §2.3']) },
  { phase: 'phase-0-scaffolding', title: 'FutureCast: document migration from recruiting-store', body: phaseBody('0', SPEC, 'Map players.json → Player entity.', ['server/docs/futurecast-platform-spec.md §0'], ['Migration notes in spec or ADR']) },

  // Phase 1 — Data model
  { phase: 'phase-1-data-model', title: 'FutureCast: Postgres migration — Player table', body: phaseBody('1', SPEC, 'Implement Player schema + indexes.', ['server/models/player.ts'], ['UUID PK, slug unique', 'Indexes: class_year+position, slug']) },
  { phase: 'phase-1-data-model', title: 'FutureCast: Postgres migration — HighSchoolProfile', body: phaseBody('1', SPEC, 'HS profile + discovery_score column.', ['server/models/highschool-profile.ts'], ['FK player_id', 'JSONB fields']) },
  { phase: 'phase-1-data-model', title: 'FutureCast: Postgres migration — CollegeProfile', body: phaseBody('1', SPEC, 'College stats, snaps, depth history.', ['server/models/college-profile.ts'], ['Matches spec §1.3']) },
  { phase: 'phase-1-data-model', title: 'FutureCast: Postgres migration — PortalProfile', body: phaseBody('1', SPEC, 'Portal status enums + likelihood.', ['server/models/portal-profile.ts'], ['portal_status enum', 'reason_tags text[]']) },
  { phase: 'phase-1-data-model', title: 'FutureCast: Postgres migration — UFSpecificProfile', body: phaseBody('1', SPEC, 'UF Fit sub-scores + uf_status.', ['server/models/uf-specific-profile.ts'], ['uf_commit_probability nullable', 'score_computed_at']) },
  { phase: 'phase-1-data-model', title: 'FutureCast: Postgres migration — DiscoverySignal', body: phaseBody('1', SPEC, 'Immutable signal log.', ['server/models/discovery-signal.ts'], ['signal_type enum per spec §1.6']) },
  { phase: 'phase-1-data-model', title: 'FutureCast: implement Player repository CRUD', body: phaseBody('1', SPEC, 'Replace TODO throws in player.ts.', ['server/models/player.ts'], ['getById, getBySlug, upsert, list work against DB']) },
  { phase: 'phase-1-data-model', title: 'FutureCast: implement profile repositories', body: phaseBody('1', SPEC, 'CRUD for all profile tables.', ['server/models/*-profile.ts'], ['Join queries for player graph']) },
  { phase: 'phase-1-data-model', title: 'FutureCast: define shared enums module', body: phaseBody('1', SPEC, 'PortalStatus, UfStatus, SignalType, UfInterestLevel.', ['server/models/enums.ts'], ['Used by models + API']) },
  { phase: 'phase-1-data-model', title: 'FutureCast: migrator players.json → Postgres', body: phaseBody('1', SPEC, 'One-time import from recruiting store.', ['server/scripts/migrate-recruiting-to-futurecast.js'], ['No data loss', 'Slug preserved']) },
  { phase: 'phase-1-data-model', title: 'FutureCast: add DB indexes for board queries', body: phaseBody('1', SPEC, 'Indexes for uf_fit_score, discovery_score sorts.', ['migrations/'], ['Big board sort columns indexed']) },
  { phase: 'phase-1-data-model', title: 'FutureCast: wire Supabase client for FutureCast models', body: phaseBody('1', SPEC, 'Reuse recruiting-store Supabase pattern.', ['server/models/db.ts'], ['Connection from env']) },

  // Phase 2 — Engines
  { phase: 'phase-2-engines', title: 'FutureCast: Early Discovery — roster ingestion', body: phaseBody('2', SPEC, 'Implement ingestRosters.', ['server/engines/futurecast/early-discovery/pipeline.ts'], ['Upserts Player + HighSchoolProfile', 'Spec §2.1 step 1']) },
  { phase: 'phase-2-engines', title: 'FutureCast: Early Discovery — signal creation', body: phaseBody('2', SPEC, 'Dedupe + insert DiscoverySignal.', ['server/engines/futurecast/early-discovery/signals.ts'], ['dedupeKey works', 'Spec §2.1 step 2']) },
  { phase: 'phase-2-engines', title: 'FutureCast: Early Discovery — discovery_score aggregation', body: phaseBody('2', SPEC, 'Aggregate score_impact.', ['server/engines/futurecast/early-discovery/pipeline.ts'], ['Stored on HighSchoolProfile', 'Spec §2.1 step 3']) },
  { phase: 'phase-2-engines', title: 'FutureCast: Early Discovery — UF relevance rules', body: phaseBody('2', SPEC, 'Promote watchlist/target.', ['server/engines/futurecast/early-discovery/pipeline.ts'], ['uf_status updated', 'Spec §2.1 step 4']) },
  { phase: 'phase-2-engines', title: 'FutureCast: Portal Intel — usage vs talent', body: phaseBody('2', SPEC, 'Flag underused players.', ['server/engines/futurecast/portal-intel/pipeline.ts'], ['Tags usage_vs_talent']) },
  { phase: 'phase-2-engines', title: 'FutureCast: Portal Intel — depth chart squeeze', body: phaseBody('2', SPEC, 'Detect buried_depth_chart.', ['server/engines/futurecast/portal-intel/reason-tags.ts'], ['Spec §2.2 step 2']) },
  { phase: 'phase-2-engines', title: 'FutureCast: Portal Intel — portal_likelihood_score', body: phaseBody('2', SPEC, 'Combine tags to 0–100.', ['server/engines/futurecast/portal-intel/pipeline.ts'], ['Persisted on PortalProfile']) },
  { phase: 'phase-2-engines', title: 'FutureCast: UF Fit — gatherSubScores implementation', body: phaseBody('2', SPEC, 'War Room, roster, geo, momentum inputs.', ['server/engines/futurecast/uf-fit/compute-fit.ts'], ['All 7 sub-scores populated']) },
  { phase: 'phase-2-engines', title: 'FutureCast: UF Fit — composite score + persist', body: phaseBody('2', SPEC, 'Weighted formula spec §2.3.', ['server/engines/futurecast/uf-fit/compute-fit.ts', 'server/engines/futurecast/uf-fit/weights.ts'], ['uf_fit_score matches formula']) },
  { phase: 'phase-2-engines', title: 'FutureCast: cron job engine:early-discovery', body: phaseBody('2', SPEC, 'Daily job via opsMonitor.', ['server/server.js', 'server/lib/ops-jobs.js'], ['Job registered', 'Logs to GV-OM']) },
  { phase: 'phase-2-engines', title: 'FutureCast: cron job engine:portal-intelligence', body: phaseBody('2', SPEC, '6h in portal window.', ['server/lib/ops-jobs.js'], ['Job runs without error']) },
  { phase: 'phase-2-engines', title: 'FutureCast: cron job engine:uf-fit-recompute', body: phaseBody('2', SPEC, 'Nightly + on-change hooks.', ['server/lib/ops-jobs.js'], ['Batch recompute works']) },
  { phase: 'phase-2-engines', title: 'FutureCast: wire Rivals FutureCast → recruiting_momentum', body: phaseBody('2', SPEC, 'Integrate rivals-prediction-ingest.', ['server/lib/rivals-prediction-ingest.js'], ['Updates momentum sub-score']) },

  // Phase 3 — API
  { phase: 'phase-3-api', title: 'FutureCast API: GET /api/players/:id', body: phaseBody('3', SPEC, 'Unified player graph response.', ['server/api/v1/players/get-player.ts'], ['Returns all profiles + signals', 'Spec §3.1']) },
  { phase: 'phase-3-api', title: 'FutureCast API: GET /api/players list + filters', body: phaseBody('3', SPEC, 'Pagination + sort.', ['server/api/v1/players/list-players.ts'], ['class_year, uf_status filters']) },
  { phase: 'phase-3-api', title: 'FutureCast API: GET /api/futurecast/big-board', body: phaseBody('3', SPEC, 'Tab param routing.', ['server/api/v1/futurecast/big-board.ts'], ['class_year required', 'Spec §3.2']) },
  { phase: 'phase-3-api', title: 'FutureCast API: big-board top_targets tab', body: phaseBody('3', SPEC, 'Sort uf_fit_score desc.', ['server/api/v1/futurecast/big-board.ts'], ['uf_status filter']) },
  { phase: 'phase-3-api', title: 'FutureCast API: big-board early_discovery tab', body: phaseBody('3', SPEC, 'class_year >= 2028 sort discovery.', ['server/api/v1/futurecast/big-board.ts'], ['Spec §4.1 tab']) },
  { phase: 'phase-3-api', title: 'FutureCast API: GET /api/portal/watchlist', body: phaseBody('3', SPEC, 'Portal filters.', ['server/api/v1/futurecast/portal-watchlist.ts'], ['min_portal_likelihood', 'min_uf_fit_score']) },
  { phase: 'phase-3-api', title: 'FutureCast API: GET /api/futurecast/early-discovery', body: phaseBody('3', SPEC, 'Standalone early discovery endpoint.', ['server/api/v1/futurecast/early-discovery.ts'], ['Spec §3.4']) },
  { phase: 'phase-3-api', title: 'FutureCast API: predictions endpoint', body: phaseBody('3', SPEC, 'uf_commit_probability sort.', ['server/api/v1/futurecast/predictions.ts'], ['Spec §3.2 Predictions tab']) },
  { phase: 'phase-3-api', title: 'FutureCast API: movement tracker endpoint', body: phaseBody('3', SPEC, '14-day delta feed.', ['server/api/v1/futurecast/movement-tracker.ts'], ['Spec §4.1 Movement Tracker']) },
  { phase: 'phase-3-api', title: 'FutureCast API: admin engine triggers', body: phaseBody('3', SPEC, 'POST run endpoints with PIN auth.', ['server/api/v1/admin/run-engines.ts'], ['Spec §3.5', 'X-Ops-Pin verified']) },
  { phase: 'phase-3-api', title: 'FutureCast API: mount v1 routes in server.js', body: phaseBody('3', SPEC, 'Register all handlers.', ['server/server.js'], ['Routes live on Render']) },
  { phase: 'phase-3-api', title: 'FutureCast API: add response caching for big board', body: phaseBody('3', SPEC, '45s TTL like live dashboard.', ['server/api/v1/futurecast/big-board.ts'], ['p95 < 400ms cached — Appendix C']) },

  // Phase 4 — Frontend
  { phase: 'phase-4-frontend', title: 'FutureCast UI: Vite + React app bootstrap in client/', body: phaseBody('4', SPEC, 'Package.json, build, dev server.', ['client/'], ['npm run dev serves client']) },
  { phase: 'phase-4-frontend', title: 'FutureCast UI: Big Board layout + tab routing', body: phaseBody('4', SPEC, 'Wire tab nav.', ['client/routes/futurecast/big-board/index.tsx'], ['5 tabs navigable', 'Spec §4.1']) },
  { phase: 'phase-4-frontend', title: 'FutureCast UI: Top Targets tab', body: phaseBody('4', SPEC, 'Fetch big-board?tab=top_targets.', ['client/routes/futurecast/big-board/top-targets.tsx'], ['PlayerCard grid']) },
  { phase: 'phase-4-frontend', title: 'FutureCast UI: Early Discovery tab', body: phaseBody('4', SPEC, 'FutureCast Early Discovery branding §5.', ['client/routes/futurecast/big-board/early-discovery.tsx'], ['Sorted by discovery_score']) },
  { phase: 'phase-4-frontend', title: 'FutureCast UI: Portal Watchlist tab', body: phaseBody('4', SPEC, 'Table with reason tags.', ['client/routes/futurecast/big-board/portal-watchlist.tsx', 'client/components/futurecast/ReasonTags.tsx'], ['Spec §4.3']) },
  { phase: 'phase-4-frontend', title: 'FutureCast UI: Predictions tab', body: phaseBody('4', SPEC, 'Show uf_commit_probability.', ['client/routes/futurecast/big-board/predictions.tsx'], ['Spec §4.1']) },
  { phase: 'phase-4-frontend', title: 'FutureCast UI: Movement Tracker tab', body: phaseBody('4', SPEC, 'Timeline of changes.', ['client/routes/futurecast/big-board/movement-tracker.tsx'], ['Spec §4.1']) },
  { phase: 'phase-4-frontend', title: 'FutureCast UI: PlayerCard component', body: phaseBody('4', SPEC, 'Big Board row/card.', ['client/components/futurecast/PlayerCard.tsx'], ['Photo, scores, status chip']) },
  { phase: 'phase-4-frontend', title: 'FutureCast UI: FitScoreBadge (UF Fit Score™)', body: phaseBody('4', SPEC, 'Color bands 90/75/60.', ['client/components/futurecast/FitScoreBadge.tsx'], ['Fan-facing label §5']) },
  { phase: 'phase-4-frontend', title: 'FutureCast UI: PortalLikelihoodBadge', body: phaseBody('4', SPEC, 'College players only.', ['client/components/futurecast/PortalLikelihoodBadge.tsx'], ['Hidden for HS-only players']) },
  { phase: 'phase-4-frontend', title: 'FutureCast UI: Player Profiles 2.0 page', body: phaseBody('4', SPEC, 'Full profile route.', ['client/routes/futurecast/player/[playerId].tsx'], ['GET /api/players/:id', 'Spec §4.2']) },
  { phase: 'phase-4-frontend', title: 'FutureCast UI: ProfileTabs — HS / College / Portal / War Room', body: phaseBody('4', SPEC, 'Tab panels with API data.', ['client/components/futurecast/ProfileTabs.tsx'], ['All 4 sections populated']) },
  { phase: 'phase-4-frontend', title: 'FutureCast UI: mobile-responsive Big Board', body: phaseBody('4', SPEC, 'Card layout on small screens.', ['client/components/futurecast/PlayerCard.tsx'], ['Matches gv-team-mobile patterns']) }
];

function phaseBody(phase, spec, summary, paths, acceptance) {
  return [
    `## Summary`,
    summary,
    ``,
    `## Spec`,
    `\`${spec}\` — Phase ${phase}`,
    ``,
    `## Files`,
    ...(paths.length ? paths.map((p) => `- \`${p}\``) : ['- See spec module layout']),
    ``,
    `## Acceptance criteria`,
    ...acceptance.map((a) => `- [ ] ${a}`),
    ``,
    `## TODO references`,
    `Search codebase for \`TODO(Phase ${phase})\` in listed files.`
  ].join('\n');
}

function ensureLabels() {
  for (const label of LABELS) {
    try {
      execSync(`gh label create "${label}" --color "1d76db" --force`, { stdio: 'ignore' });
    } catch {
      /* may exist */
    }
  }
}

function createIssues() {
  ensureLabels();
  const urls = [];
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-issues-'));
  for (const issue of issues) {
    const labels = ['futurecast', issue.phase].join(',');
    const bodyFile = path.join(tmpDir, `issue-${urls.length}.md`);
    fs.writeFileSync(bodyFile, issue.body, 'utf8');
    const cmd = `gh issue create --title ${JSON.stringify(issue.title)} --label ${JSON.stringify(labels)} --body-file ${JSON.stringify(bodyFile)}`;
    if (DRY) {
      console.log('[dry-run]', issue.title);
      continue;
    }
    try {
      const out = execSync(cmd, { encoding: 'utf8' });
      urls.push(out.trim());
      console.log('Created:', issue.title);
    } catch (err) {
      console.error('Failed:', issue.title, err.message);
    }
  }
  return urls;
}

console.log(`FutureCast issues: ${issues.length} total${DRY ? ' (dry-run)' : ''}`);
const urls = createIssues();
if (!DRY && urls.length) {
  console.log('\n---\nCreated issues:\n' + urls.join('\n'));
}
