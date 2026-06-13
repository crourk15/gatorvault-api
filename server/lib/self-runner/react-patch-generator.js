/**
 * Self-Runner 3.0 — React-native patch generator (no monolith HTML patching).
 */
const fs = require('fs');
const reactBp = require('./blueprint/react-blueprint');
const patches = require('./self-runner-patches');
const dedupeEngine = require('./dedupe-engine');

const VAULT_CSS_SNIPPETS = {
  'ux:scroll-containers': `
.gv-hub-tabs--scroll {
  flex-wrap: nowrap;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
`,
  'ux:bottom-nav': `
.gv-vault-bottom-nav {
  display: flex;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 55;
  padding-bottom: env(safe-area-inset-bottom, 0);
}
`,
  'ux:live-feed-layout': `
.gv-live-ticker { display: flex; overflow: hidden; }
.gv-live-feed__tabs { display: flex; gap: 0.5rem; }
.gv-live-feed__row-time { font-variant-numeric: tabular-nums; }
`,
  'ux:mobile-safari': `
.gv-vault-shell__main {
  padding-bottom: calc(4.5rem + env(safe-area-inset-bottom, 0));
}
`,
  'ux:modal-zindex': `
.gv-vault-shell__header { z-index: 40; }
.gv-vault-bottom-nav { z-index: 55; }
`,
  'ux:tap-targets': `
.gv-vault-bottom-nav__item { min-height: 44px; touch-action: manipulation; }
.gv-hub-tab { min-height: 44px; touch-action: manipulation; }
`
};

function clientPath(rel) {
  return patches.absPath(`../client/${rel.replace(/^client\//, '')}`);
}

function buildReactRebuildPatch(checkId, issue) {
  const route = reactBp.routeForCheck(checkId);
  const meta = reactBp.componentForRoute(route);
  const exportPath = `vault${route === '/vault' ? '' : route.replace('/vault', '')}/index.html`;

  return {
    patchType: 'react-rebuild',
    riskLevel: 'low',
    edits: [
      {
        file: exportPath,
        type: 'react-rebuild-export',
        steps: ['npm run build --prefix client', 'node client/scripts/merge-into-server.js']
      }
    ],
    patchPreview: {
      file: meta.component,
      files: [meta.component, exportPath],
      before: issue?.error || 'Missing React export or marker',
      after: `Rebuild ${route} from ${meta.component} and merge into server/${exportPath}`
    },
    suggestedFix: reactBp.reactExplanation(checkId, issue),
    qaSteps: [
      `Open ${route} in browser`,
      `Verify data-testid="${meta.testid}"`,
      'Run npm run deploy:guardian:static'
    ]
  };
}

function buildReactCssPatch(checkId, issue) {
  const snippet = VAULT_CSS_SNIPPETS[checkId];
  if (!snippet) {
    const route = reactBp.routeForCheck(checkId);
    return {
      patchType: 'react-css',
      riskLevel: 'low',
      edits: [
        {
          file: 'client/lib/vault-shell.css',
          type: 'react-css-append',
          marker: `/* Self-Runner: ${checkId} */`,
          text: `\n/* Self-Runner: ${checkId} */\n${snippet || '/* Review layout for ' + route + ' */'}\n`
        }
      ],
      patchPreview: {
        file: 'client/lib/vault-shell.css',
        before: issue?.error || checkId,
        after: 'Append vault-shell.css rules for React layout'
      },
      suggestedFix: reactBp.reactExplanation(checkId, issue)
    };
  }

  return {
    patchType: 'react-css',
    riskLevel: 'low',
    edits: [
      {
        file: 'client/lib/vault-shell.css',
        type: 'react-css-append',
        marker: `/* Self-Runner: ${checkId} */`,
        text: snippet
      }
    ],
    patchPreview: {
      file: 'client/lib/vault-shell.css',
      before: issue?.error || 'Missing CSS pattern',
      after: `Add ${checkId} styles to vault-shell.css`
    },
    suggestedFix: reactBp.reactExplanation(checkId, issue)
  };
}

function buildReactComponentPatch(checkId, issue) {
  const route = reactBp.routeForCheck(checkId);
  const meta = reactBp.componentForRoute(route);

  return {
    patchType: 'react-component',
    riskLevel: 'medium',
    edits: [
      {
        file: meta.component.replace(/^client\//, ''),
        type: 'react-component-review',
        checkId,
        route,
        testid: meta.testid,
        note: 'Manual TypeScript/React fix required — self-runner cannot auto-edit TSX safely'
      }
    ],
    patchPreview: {
      file: meta.component,
      files: [meta.component, meta.data, meta.css].filter(Boolean),
      before: issue?.error || issue?.title || checkId,
      after: `Ensure ${meta.component} renders correctly at ${route} with data-testid="${meta.testid}"`
    },
    suggestedFix: reactBp.reactExplanation(checkId, issue),
    requiresManualApproval: true,
    qaSteps: [`Load ${route}`, `Verify [data-testid="${meta.testid}"]`, 'Check mobile + desktop viewports']
  };
}

function buildReactSlugPatch(issue) {
  return {
    patchType: 'react-slug',
    riskLevel: 'medium',
    edits: [
      {
        file: 'client/lib/slug.ts',
        type: 'react-component-review',
        note: 'Verify ensurePlayerSlug() and playerProfilePath() in client/lib/player-routes.ts'
      },
      {
        file: 'client/lib/player-profile-resolver.ts',
        type: 'react-component-review',
        note: 'Ensure resolvePlayerProfile redirects portal/roster/HS correctly'
      }
    ],
    patchPreview: {
      file: 'client/lib/slug.ts',
      before: issue?.error || 'Player profile slug mismatch',
      after: 'Standardize slugs across Recruiting, FutureCast, Portal, and Roster'
    },
    suggestedFix: 'Fix slug generation in client/lib/slug.ts and routing in player-routes.ts — rebuild and deploy',
    requiresManualApproval: true
  };
}

function buildReactRoutePatch(issue) {
  return {
    patchType: 'react-route',
    riskLevel: 'medium',
    edits: [
      {
        file: 'client/lib/routes.js',
        type: 'react-route-verify',
        note: 'Ensure REACT_REWRITES includes vault route static export'
      }
    ],
    patchPreview: {
      file: 'client/lib/routes.js',
      before: issue?.error || 'Route missing from static export',
      after: 'Add vault route rewrite + REQUIRED_VAULT_EXPORTS entry, then rebuild'
    },
    suggestedFix: 'Add missing route to client/lib/routes.js and netlify.toml, rebuild client export',
    requiresManualApproval: true
  };
}

function buildFeedDedupPatch(issue, checkDetails) {
  const items = (() => {
    try {
      const raw = JSON.parse(fs.readFileSync(patches.absPath('data/live/feed-items.json'), 'utf8'));
      return Array.isArray(raw) ? raw : raw.items || raw.feed || [];
    } catch {
      return [];
    }
  })();
  const validation = dedupeEngine.validateFeedIntegrity(items);
  const issueList = checkDetails?.details || issue.details || validation.issues || [];

  return {
    patchType: 'feed-dedup-v2',
    riskLevel: 'low',
    edits: [
      {
        file: 'data/live/feed-items.json',
        type: 'repair-feed-integrity',
        windowSec: dedupeEngine.DEFAULT_WINDOW_SEC
      }
    ],
    patchPreview: {
      file: 'data/live/feed-items.json',
      before: `${issueList.length || validation.issues.length} feed integrity issue(s)`,
      after: 'repairFeedItems() with SHA-256 dedupe — Live Feed React page reads this API'
    },
    suggestedFix: 'Repair data/live/feed-items.json — VaultLiveFeedPage displays via /api/live/dashboard'
  };
}

function buildFilmSourcePatch(issue, checkDetails) {
  const broken = checkDetails?.details || issue.details || [];
  const replacements = (Array.isArray(broken) ? broken : []).map((b) => ({
    url: b.url,
    fallback: patches.fallbackForUrl(b.url)
  }));

  return {
    patchType: 'film-source-url',
    riskLevel: 'low',
    edits: [
      {
        file: 'data/film-room-knowledge',
        type: 'replace-broken-source-urls',
        replacements
      }
    ],
    patchPreview: {
      file: 'data/film-room-knowledge/',
      before: `${replacements.length} broken source URL(s)`,
      after: 'Update film knowledge JSON — VaultFilmRoomPage links via item.sourceUrl'
    },
    suggestedFix: 'Fix broken Film Room source URLs in data/film-room-knowledge/*.json for React verified source links'
  };
}

/** Main entry — generate React-native patch for a QA issue. */
function generateReactPatch(issue, checkDetails) {
  const checkId = String(issue?.checkId || issue?.id || '');

  if (/retired-monolith|^pages:(team-hooks|film-room-hooks)$/.test(checkId)) {
    return null;
  }

  if (/feed-dedup|autoposter-dedup/.test(checkId)) {
    return buildFeedDedupPatch(issue, checkDetails);
  }

  if (/film-sources|film-source/.test(checkId)) {
    return buildFilmSourcePatch(issue, checkDetails);
  }

  if (/slug|player-profile|pages:react.*player/.test(checkId)) {
    return buildReactSlugPatch(issue);
  }

  if (/integrity:react-|integrity:missing-content/.test(checkId)) {
    return buildReactRebuildPatch(checkId, issue);
  }

  if (/^ux:/.test(checkId)) {
    return buildReactCssPatch(checkId, issue);
  }

  if (/visual-integrity:/.test(checkId)) {
    if (/landing/.test(checkId)) return buildReactRebuildPatch('/', issue);
    return buildReactComponentPatch(checkId, issue);
  }

  if (/^pages:/.test(checkId)) {
    return buildReactComponentPatch(checkId, issue);
  }

  if (/integrity:(roster|depth-chart)/.test(checkId)) {
    const route = '/vault/team';
    const meta = reactBp.componentForRoute(route);
    return {
      patchType: 'react-component',
      riskLevel: 'medium',
      edits: [
        { file: meta.data?.replace(/^client\//, ''), type: 'react-component-review', note: 'Verify roster/depth data' },
        { file: 'data/roster/players.json', type: 'verify-json', checkId }
      ],
      patchPreview: {
        file: meta.component,
        before: issue?.error || checkId,
        after: 'Fix roster API data or VaultTeamPage depth chart module'
      },
      suggestedFix: reactBp.reactExplanation(checkId, issue),
      requiresManualApproval: true
    };
  }

  if (/mobile-behavior:react-vault-nav|mobile-behavior:navigation/.test(checkId)) {
    return buildReactCssPatch('ux:bottom-nav', issue);
  }

  if (/404|crawler:404|route/.test(checkId)) {
    return buildReactRoutePatch(issue);
  }

  if (/recruiting|war-room|portal/.test(checkId) && !/retired/.test(checkId)) {
    return buildReactComponentPatch(checkId, issue);
  }

  return null;
}

module.exports = {
  generateReactPatch,
  buildReactRebuildPatch,
  buildReactCssPatch,
  buildReactComponentPatch,
  buildFeedDedupPatch,
  VAULT_CSS_SNIPPETS
};
