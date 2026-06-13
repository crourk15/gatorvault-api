/**
 * Self-Runner — build patch proposals from product-intel issues (no apply).
 */
const fs = require('fs');
const patches = require('./self-runner-patches');
const templates = require('./self-runner-patch-templates');
const contextPatch = require('./context-patch-generator');
const reactPatch = require('./react-patch-generator');
const reactBp = require('./blueprint/react-blueprint');
const autoposterGuard = require('./autoposter-guard');

function nextId(seq) {
  return `sr_fix_${String(seq).padStart(3, '0')}`;
}

function extractRegionById(html, regionId) {
  try {
    return engine.extractRegionById(html, regionId);
  } catch {
    const marker = `id="${regionId}"`;
    const start = html.indexOf(marker);
    if (start < 0) return '';
    return html.slice(start, start + 80000);
  }
}

function buildBackgroundThemePatch(issue, checkDetails) {
  return reactPatch.generateReactPatch(issue, checkDetails);
}

function buildFeedDedupPatch(issue, checkDetails) {
  return contextPatch.buildFeedDedupPatchV2(issue, checkDetails);
}

function buildFilmSourcePatch(issue, checkDetails) {
  const broken = checkDetails?.details || issue.details || [];
  const replacements = (Array.isArray(broken) ? broken : []).map((b) => ({
    url: b.url,
    fallback: patches.fallbackForUrl(b.url)
  }));

  if (!replacements.length) {
    replacements.push({
      url: '(broken sources in catalog)',
      fallback: patches.FILM_SOURCE_FALLBACKS.default
    });
  }

  return {
    patchType: 'film-source-url',
    edits: [
      {
        file: 'data/film-room-knowledge',
        type: 'replace-broken-source-urls',
        replacements
      }
    ],
    patchPreview: {
      file: 'data/film-room-knowledge/*.json',
      before: replacements[0]?.url || 'broken URL',
      after: replacements[0]?.fallback || patches.FILM_SOURCE_FALLBACKS.default
    },
    suggestedFix:
      issue.suggestedFix ||
      'Replace broken Film Room source URLs with verified fallbacks from apply-film-room-sources.js'
  };
}

function buildHtmlHookPatch(issue) {
  const checkId = issue.checkId || '';
  const missing = contextPatch.scanHtmlHooks();
  if (missing.length) {
    const v2 = contextPatch.buildHtmlHookPatch(missing);
    if (v2) return v2;
  }
  const tpl = patches.HOOK_SNIPPETS[checkId];
  if (!tpl) {
    return null;
  }
  return {
    patchType: 'html-hook',
    riskLevel: 'medium',
    edits: [
      {
        file: tpl.file,
        type: 'insert-if-missing',
        marker: tpl.marker,
        anchor: tpl.insertBefore,
        text: tpl.snippet
      }
    ],
    patchPreview: {
      file: tpl.file,
      before: `missing ${tpl.marker}`,
      after: tpl.snippet.trim().slice(0, 120)
    },
    suggestedFix: issue.suggestedFix || `Add ${tpl.marker} hook to index.html`
  };
}

function buildCssTokenPatch(issue) {
  const checkId = issue.checkId || '';
  const tokens = ['--gv-team-card-bg', '--gv-team-radius', '--gv-team-space-4', '--gv-team-title', '--gv-team-body'];
  const edits = [{ file: 'css/gv-team.css', type: 'ensure-css-tokens', tokens }];

  if (/layout-overflow|panel-clipping|overflow/.test(checkId)) {
    edits.push({
      file: 'css/gv-team.css',
      type: 'append-if-missing',
      marker: 'self-runner: modal overflow guards',
      text: patches.MODAL_OVERFLOW_CSS_SNIPPET
    });
  }

  return {
    patchType: 'css-token',
    edits,
    patchPreview: {
      file: 'css/gv-team.css',
      before: 'missing team tokens / overflow guards',
      after: tokens.join(', ') + ' + modal overflow guards'
    },
    suggestedFix:
      issue.suggestedFix ||
      'Define --gv-team-* tokens and modal overflow guards (min-height:0, overflow-wrap) in css/gv-team.css'
  };
}

function buildTeamContentPatch(issue, checkDetails) {
  const details = checkDetails?.details || issue.details || [];
  const edits = [];
  const preview = { file: patches.TEAM_OVERVIEW_FILES.cards, changes: [] };

  if (issue.checkId === 'integrity:team-history-structure' || issue.checkId === 'content:team-module') {
    edits.push({
      file: patches.TEAM_OVERVIEW_FILES.cards,
      type: 'verify-team-eras',
      requiredEras: ['era-70s80s', 'era-90s', 'era-2000s', 'era-2010s', 'era-2020s']
    });
    preview.changes.push({ note: 'Verify 5 ERAS with coaching, milestones, schemes — Spurrier only in era-90s' });
  }

  (Array.isArray(details) ? details : []).forEach((d) => {
    if (d.eraId && d.issue === 'spurrier_in_70s_era') {
      edits.push({ file: patches.TEAM_OVERVIEW_FILES.cards, type: 'remove-spurrier-from-70s-era' });
      preview.changes.push({ eraId: d.eraId, fix: 'remove Spurrier references from 70s–80s era' });
    }
    if (d.missing && d.section === 'coachingStaff') {
      edits.push({ file: 'data/coaching-staff.json', type: 'verify-coach', name: d.missing });
      preview.changes.push({ coach: d.missing });
    }
  });

  if (!edits.length) {
    edits.push({ file: patches.TEAM_OVERVIEW_FILES.cards, type: 'verify-team-eras' });
    preview.changes.push({ note: 'Review gv-team-mobile.js ERAS + coaching-staff.json' });
  }

  return {
    patchType: 'team-content',
    edits,
    patchPreview: preview,
    suggestedFix:
      issue.suggestedFix ||
      'Update gv-team-mobile.js ERAS and data/coaching-staff.json — all sections populated'
  };
}

function buildComponentVariantPatch(issue, checkDetails) {
  const violations = checkDetails?.details || issue.details || [];
  const edits = [];
  const preview = { file: patches.TEAM_OVERVIEW_FILES.shell, changes: [] };

  (Array.isArray(violations) ? violations : []).forEach((v) => {
    const regionId = v.regionId || 'vpane-team';
    const leaked = v.leakedClass || v.class;

    if (v.issue === 'missing_overview_layout_markers') {
      edits.push({
        file: patches.TEAM_OVERVIEW_FILES.shell,
        type: 'add-class-to-region',
        regionId: 'vpane-team',
        className: 'gv-team-overview-layout'
      });
      preview.changes.push({ regionId: 'vpane-team', add: 'gv-team-overview-layout' });
      return;
    }

    if (leaked && patches.TEAM_LEGACY_CARD_SWAPS[leaked]) {
      const to = patches.TEAM_LEGACY_CARD_SWAPS[leaked];
      edits.push({
        file: patches.TEAM_OVERVIEW_FILES.shell,
        type: 'class-swap-in-region',
        regionId,
        from: leaked,
        to
      });
      preview.changes.push({ regionId, swap: `${leaked} → ${to}` });
      return;
    }

    if (leaked && patches.TEAM_FORBIDDEN_IN_REGION.includes(leaked)) {
      edits.push({
        file: patches.TEAM_OVERVIEW_FILES.shell,
        type: 'remove-class-from-region',
        regionId,
        className: leaked
      });
      preview.changes.push({ regionId, remove: leaked });
    }
  });

  if (!edits.length) {
    ['vpane-team', 'vpane-mteam'].forEach((regionId) => {
      patches.TEAM_FORBIDDEN_IN_REGION.forEach((cls) => {
        edits.push({
          file: patches.TEAM_OVERVIEW_FILES.shell,
          type: 'remove-class-from-region',
          regionId,
          className: cls
        });
      });
      (patches.TEAM_REQUIRED[regionId] || []).forEach((cls) => {
        edits.push({
          file: patches.TEAM_OVERVIEW_FILES.shell,
          type: 'add-class-to-region',
          regionId,
          className: cls
        });
      });
    });
    preview.changes.push({
      note: 'Ensure Team Overview shell: gv-team-page on #vpane-team / #vpane-mteam, gv-team-overview-layout on desktop overview'
    });
  }

  const firstChange = preview.changes[0];
  return {
    patchType: 'component-variant',
    edits,
    patchPreview: {
      file: patches.TEAM_OVERVIEW_FILES.shell,
      before: firstChange?.remove || firstChange?.swap?.split(' → ')[0] || 'legacy promo/trial classes',
      after:
        firstChange?.add ||
        firstChange?.swap?.split(' → ')[1] ||
        'gv-team-page gv-team-overview-layout gv-team-section',
      changes: preview.changes
    },
    suggestedFix:
      issue.suggestedFix ||
      'Team Overview (#vpane-team / #vpane-mteam in index.html): use gv-team-page shell, gv-team-overview-layout grid, gv-team-era-card tiles — remove card-h / trial / pricing classes'
  };
}

function enrichWithTemplate(built, issue, checkDetails) {
  const tmpl = templates.applyTemplate(issue, checkDetails);
  if (!tmpl) return built;

  const feedDedupIssue = /feed-dedup|autoposter-dedup|feed-dedup-v2/.test(
    `${built.patchType || ''} ${issue.checkId || ''} ${tmpl.patchType || ''}`
  );

  const diff0 = tmpl.diff[0] || {};
  const templateMeta = {
    ruleId: tmpl.ruleId,
    category: tmpl.category,
    classification: tmpl.classification,
    safetyRules: tmpl.safetyRules,
    diff: feedDedupIssue ? built.patchPreview?.diff || tmpl.diff : tmpl.diff
  };

  if (feedDedupIssue) {
    return {
      ...built,
      patchType: built.patchType || 'feed-dedup-v2',
      suggestedFix: built.suggestedFix || tmpl.description,
      patchPreview: {
        ...built.patchPreview,
        file: built.patchPreview?.file || tmpl.files[0],
        files: built.patchPreview?.files || tmpl.files,
        diff: built.patchPreview?.diff || tmpl.diff,
        before: built.patchPreview?.before || diff0.before,
        after: built.patchPreview?.after || diff0.after
      },
      template: templateMeta,
      testPlan: tmpl.testPlan,
      qaSteps: tmpl.qaSteps,
      rollbackPlan: tmpl.rollbackPlan
    };
  }

  const reactPatchTypes = /^(react-|feed-dedup|film-source|schema-field)/;
  const preserveBuiltType = reactPatchTypes.test(built.patchType || '');

  return {
    ...built,
    patchType: preserveBuiltType ? built.patchType : tmpl.patchType,
    suggestedFix: built.suggestedFix || tmpl.description,
    patchPreview: {
      ...built.patchPreview,
      file: built.patchPreview?.file || tmpl.files[0],
      files: tmpl.files,
      diff: tmpl.diff,
      before: diff0.before || built.patchPreview?.before,
      after: diff0.after || built.patchPreview?.after
    },
    template: templateMeta,
    testPlan: tmpl.testPlan,
    qaSteps: tmpl.qaSteps,
    rollbackPlan: tmpl.rollbackPlan
  };
}

function editsFromTemplate(tmpl, issue) {
  const ctx = tmpl.context;
  const file = ctx.file || tmpl.files[0];

  switch (tmpl.patchType) {
    case 'layout-overflow':
    case 'panel-layering':
    case 'react-css':
      return [
        {
          file: 'client/lib/vault-shell.css',
          type: 'react-css-append',
          marker: `/* Self-Runner: ${issue.checkId || tmpl.ruleId} */`,
          text: patches.MODAL_OVERFLOW_CSS_SNIPPET
        }
      ];
    case 'background-theme':
    case 'missing-content':
    case 'ordering-fix':
    case 'html-hook': {
      const react = reactPatch.generateReactPatch(issue, {});
      return react?.edits || [];
    }
    case 'autoposter-dedup':
    case 'feed-dedup-v2':
    case 'similarity-filter':
      return [{ file: 'data/live/feed-items.json', type: 'repair-feed-integrity' }];
    case 'recruiting-board-sync':
      return [{ file: 'data/recruiting/players.json', type: 'verify-json', checkId: issue.checkId }];
    case 'roster-sync':
      return [{ file: 'data/roster/players.json', type: 'verify-json', checkId: issue.checkId }];
    case 'film-source-url':
      return [{ file: 'data/film-room-knowledge', type: 'replace-broken-source-urls', replacements: [] }];
    case 'react-component':
    case 'react-rebuild':
      return reactPatch.generateReactPatch(issue, {})?.edits || [];
    default:
      return [{ file, type: 'react-component-review', ruleId: tmpl.ruleId, checkId: issue.checkId }];
  }
}

function buildFromTemplate(issue, checkDetails) {
  const tmpl = templates.applyTemplate(issue, checkDetails);
  if (!tmpl) return null;

  const edits = editsFromTemplate(tmpl, issue);
  const diff0 = tmpl.diff[0] || {};

  return enrichWithTemplate(
    {
      patchType: tmpl.patchType,
      edits,
      patchPreview: {
        file: tmpl.files[0],
        files: tmpl.files,
        diff: tmpl.diff,
        before: diff0.before,
        after: diff0.after
      },
      suggestedFix: issue.suggestedFix || tmpl.description
    },
    issue,
    checkDetails
  );
}

function preparePatch(issue, checkDetails) {
  const checkId = issue.checkId || '';
  if (/retired-monolith|^pages:(team-hooks|film-room-hooks)$/.test(checkId)) return null;

  const patchType = patches.resolvePatchType(issue);
  if (!patchType && !templates.resolveRuleId(issue)) {
    const reactOnly = reactPatch.generateReactPatch(issue, checkDetails);
    if (!reactOnly?.edits?.length) return null;
  }

  let built = reactPatch.generateReactPatch(issue, checkDetails);

  if (!built && (patchType === 'feed-dedup-v2' || /feed-dedup|autoposter-dedup/.test(checkId))) {
    built = buildFeedDedupPatch(issue, checkDetails);
  } else if (!built && patchType === 'film-source-url') {
    built = buildFilmSourcePatch(issue, checkDetails);
  } else if (!built && patchType === 'schema-field-v2') {
    built = contextPatch.generateContextPatch(issue, checkDetails);
  }

  if (!built) built = buildFromTemplate(issue, checkDetails);
  if (!built || !built.edits?.length) {
    built = contextPatch.generateContextPatch(issue, checkDetails);
  }
  if (!built || !built.edits?.length) return null;

  built.edits = (built.edits || []).filter((e) => !reactBp.isForbiddenEdit(e));
  if (!built.edits.length) return null;

  built = contextPatch.enrichLegacyPatch(built, issue);
  const safety = autoposterGuard.validatePatchSafety({ patch: built });
  if (!safety.ok) {
    built.blocked = true;
    built.blockReason = safety.blocked;
    built.requiresManualApproval = true;
  }

  return enrichWithTemplate(built, issue, checkDetails);
}

function prepareFixProposal(issue, { seq, checkDetails } = {}) {
  if (!patches.isEligible(issue)) return null;

  const patch = preparePatch(issue, checkDetails);
  if (!patch) return null;

  const id = nextId(seq);
  const piProposal = issue.proposal || null;

  return {
    id,
    sourceIssueId: issue.id,
    checkId: issue.checkId,
    title: issue.title || issue.id,
    module: issue.module,
    classification: issue.classification || patch.template?.classification || null,
    ruleId: issue.ruleId || patch.template?.ruleId || null,
    category: issue.category || patch.template?.category || null,
    severity: issue.severity || 'high',
    severityScore: issue.severityScore ?? null,
    impact: issue.impact || 'user-facing',
    status: 'pending',
    patchType: patch.patchType,
    patchPreview: patch.patchPreview,
    patch: { edits: patch.edits },
    template: patch.template || null,
    safetyRules: patch.template?.safetyRules || [],
    suggestedFix: patch.suggestedFix,
    description: piProposal?.description || patch.suggestedFix,
    filesToModify: piProposal?.filesToModify || patch.patchPreview?.files || [patch.patchPreview?.file].filter(Boolean),
    codeDiff: patch.patchPreview?.diff || (patch.patchType?.includes('feed-dedup') ? null : patch.template?.diff) || null,
    codeDiffHint:
      piProposal?.codeDiffHint ||
      (patch.patchType?.includes('feed-dedup') ? patch.patchPreview?.after : null) ||
      patch.patchPreview?.after ||
      null,
    testPlan: patch.testPlan || piProposal?.testPlan || [],
    qaSteps: patch.qaSteps || piProposal?.qaSteps || [],
    rollbackPlan: patch.rollbackPlan || piProposal?.rollbackPlan || null,
    repro: issue.repro || null,
    riskLevel: patch.riskLevel || 'medium',
    blocked: patch.blocked || false,
    blockReason: patch.blockReason || null,
    requiresManualApproval: patch.requiresManualApproval || false,
    v2: patch.patchType?.includes('v2') || patch.supersededPlaceholder || false,
    createdAt: new Date().toISOString(),
    approvedAt: null,
    completedAt: null,
    rejectedAt: null
  };
}

/** Rule metadata for failure reports — React vault architecture. */
const RULE_EXPECTATIONS = {
  'visual-integrity:component-variants': {
    rule: 'React Team page layout',
    expected: 'VaultTeamPage uses gv-team-page shell with roster + depth chart tabs — no trial/promo classes',
    defaultFile: 'client/components/vault/VaultTeamPage.tsx'
  },
  'visual-integrity:team-overview-background': {
    rule: 'React Team theme',
    expected: 'VaultTeamPage uses vault-shell.css tokens — no trial-promo bleed',
    defaultFile: 'client/components/vault/VaultTeamPage.tsx'
  },
  'visual-integrity:team-css-linked': {
    rule: 'Vault shell CSS',
    expected: 'VaultShell imports client/lib/vault-shell.css',
    defaultFile: 'client/lib/vault-shell.css'
  },
  'visual-integrity:team-theme-tokens': {
    rule: 'Vault CSS design tokens',
    expected: 'vault-shell.css defines scroll, safe-area, and modal z-index rules',
    defaultFile: 'client/lib/vault-shell.css'
  },
  'visual-integrity:cross-page-contamination': {
    rule: 'Cross-page theme isolation',
    expected: 'Trial/promo classes only on marketing landing — not in vault pillars',
    defaultFile: 'client/components/vault/VaultShell.tsx'
  },
  'visual-integrity:film-room-theme': {
    rule: 'React Film Room theme',
    expected: 'VaultFilmRoomPage hub grid with 5 categories — no monolith hooks',
    defaultFile: 'client/components/vault/VaultFilmRoomPage.tsx'
  },
  'visual-integrity:admin-theme': {
    rule: 'Admin Hub neutral theme',
    expected: 'admin.html uses hub-neutral CSS — no gv-team or trial classes',
    defaultFile: 'admin.html'
  },
  'integrity:feed-dedup': {
    rule: 'Live Feed dedup',
    expected: 'No duplicate feed items in data/live/feed-items.json',
    defaultFile: 'data/live/feed-items.json'
  },
  'integrity:film-sources': {
    rule: 'Film Room source URLs',
    expected: 'Film knowledge source_url values return HTTP 200',
    defaultFile: 'data/film-room-knowledge/*.json'
  },
  'pages:home:desktop': {
    rule: 'React landing page (desktop)',
    expected: 'Landing export includes data-testid="landing-page" — no vpane hooks',
    defaultFile: 'client/app/page.tsx'
  },
  'pages:home:mobile': {
    rule: 'React landing page (mobile)',
    expected: 'Mobile landing renders React marketing page at /',
    defaultFile: 'client/app/page.tsx'
  },
  'pages:vault-dashboard': {
    rule: 'React vault dashboard',
    expected: '/vault export includes data-testid="vault-dashboard"',
    defaultFile: 'vault/index.html'
  },
  'pages:vault-team': {
    rule: 'React Team page',
    expected: '/vault/team with roster + depth chart',
    defaultFile: 'vault/team/index.html'
  },
  'pages:vault-recruiting': {
    rule: 'React Recruiting Hub',
    expected: '/vault/recruiting with all hub tabs',
    defaultFile: 'vault/recruiting/index.html'
  },
  'pages:vault-film-room': {
    rule: 'React Film Room',
    expected: '/vault/film-room with 5 category cards',
    defaultFile: 'vault/film-room/index.html'
  },
  'pages:vault-live-feed': {
    rule: 'React Live Feed',
    expected: '/vault/live-feed with ticker + category chips',
    defaultFile: 'vault/live-feed/index.html'
  },
  'pages:vault-futurecast': {
    rule: 'React FutureCast',
    expected: '/vault/futurecast with big board',
    defaultFile: 'vault/futurecast/index.html'
  },
  'pages:react-team': {
    rule: 'React Team page',
    expected: '/vault/team export includes data-testid="vault-team", roster + depth chart',
    defaultFile: 'vault/team/index.html'
  },
  'pages:react-film-room': {
    rule: 'React Film Room',
    expected: 'VaultFilmRoomPage hub grid with 5 categories and verified source links',
    defaultFile: 'vault/film-room/index.html'
  },
  'pages:react-recruiting-hub': {
    rule: 'React Recruiting Hub',
    expected: 'VaultRecruitingHubPage with commits, targets, heat, scouting, portal tabs',
    defaultFile: 'vault/recruiting/index.html'
  },
  'pages:react-live-feed': {
    rule: 'React Live Feed',
    expected: 'VaultLiveFeedPage with ticker, tabs, ESPN-style row layout',
    defaultFile: 'vault/live-feed/index.html'
  },
  'pages:react-futurecast': {
    rule: 'React FutureCast',
    expected: '/vault/futurecast export with big board and movement intel',
    defaultFile: 'vault/futurecast/index.html'
  },
  'integrity:react-markers': {
    rule: 'React static export markers',
    expected: 'All vault pillar pages have data-testid hooks in SSG HTML',
    defaultFile: 'vault/index.html'
  },
  'integrity:react-exports': {
    rule: 'React vault static exports',
    expected: 'server/vault/{team,recruiting,futurecast,live-feed,film-room,tickets}/index.html exist',
    defaultFile: 'vault/team/index.html'
  },
  'pages:team-hooks': {
    rule: 'RETIRED — monolith team hooks',
    expected: 'Use pages:react-team instead',
    defaultFile: 'vault/team/index.html'
  },
  'pages:film-room-hooks': {
    rule: 'RETIRED — monolith film room hooks',
    expected: 'Use pages:react-film-room instead',
    defaultFile: 'vault/film-room/index.html'
  },
  'mobile-behavior:stale-html': {
    rule: 'Production HTML build stamp',
    expected: 'Netlify production meta gv-build matches repo server/index.html React landing',
    defaultFile: 'index.html'
  },
  'mobile-behavior:react-vault-nav': {
    rule: 'React mobile bottom nav',
    expected: 'gv-vault-bottom-nav links load Recruiting, Team, Live Feed React pages',
    defaultFile: 'client/components/vault/VaultShell.tsx'
  },
  'mobile-behavior:team-tab-theme': {
    rule: 'RETIRED — monolith mobile team pane',
    expected: 'Use mobile-behavior:react-vault-nav and pages:react-team',
    defaultFile: 'client/components/vault/VaultTeamPage.tsx'
  },
  'mobile-behavior:navigation-back': {
    rule: 'React modal back navigation',
    expected: 'Profile modals close on back gesture without breaking vault shell',
    defaultFile: 'client/components/vault/VaultShell.tsx'
  },
  'integrity:filmroom-structure': {
    rule: 'RETIRED — monolith film room hooks',
    expected: 'Use pages:react-film-room and VaultFilmRoomPage.tsx',
    defaultFile: 'client/components/vault/VaultFilmRoomPage.tsx'
  },
  'integrity:team-history-structure': {
    rule: 'React Team data',
    expected: 'Roster + depth chart data in data/roster/ and VaultTeamPage.tsx',
    defaultFile: 'client/components/vault/VaultTeamPage.tsx'
  },
  'integrity:missing-content': {
    rule: 'RETIRED — monolith section hooks',
    expected: 'Use integrity:react-exports and pages:react-* checks',
    defaultFile: 'vault/index.html'
  },
  'integrity:layout-overflow': {
    rule: 'React scroll containers',
    expected: 'vault-shell.css: hub tabs scroll horizontally; main pane min-width:0',
    defaultFile: 'client/lib/vault-shell.css'
  },
  'integrity:panel-clipping': {
    rule: 'React modal layering',
    expected: 'vault-shell.css: modal z-index above header; no text clipping',
    defaultFile: 'client/lib/vault-shell.css'
  },
  'integrity:wrong-background': {
    rule: 'RETIRED — monolith team identity backgrounds',
    expected: 'Fix theme in VaultTeamPage.tsx + vault-shell.css',
    defaultFile: 'client/components/vault/VaultTeamPage.tsx'
  },
  'integrity:autoposter-dedup': {
    rule: 'Autoposter duplication',
    expected: 'No duplicate URLs/titles in feed-items.json',
    defaultFile: 'data/live/feed-items.json'
  },
  'ux:scroll-containers': {
    rule: 'Scroll containers',
    expected: 'Hub tabs and horizontal lists use overflow-x:auto with touch scrolling',
    defaultFile: 'client/lib/vault-shell.css'
  },
  'ux:modal-zindex': {
    rule: 'Modal z-index',
    expected: 'Header z-index:40; bottom nav z-index:55; modals above content',
    defaultFile: 'client/lib/vault-shell.css'
  },
  'ux:tap-targets': {
    rule: 'Mobile tap targets',
    expected: 'Bottom nav and hub tabs min-height 44px with touch-action:manipulation',
    defaultFile: 'client/lib/vault-shell.css'
  },
  'ux:mobile-safari': {
    rule: 'Mobile Safari safe-area',
    expected: 'Main content padding-bottom accounts for safe-area-inset-bottom + bottom nav',
    defaultFile: 'client/lib/vault-shell.css'
  },
  'ux:live-feed-layout': {
    rule: 'Live Feed layout',
    expected: 'Ticker, category chips, and row time columns render in VaultLiveFeedPage',
    defaultFile: 'client/components/vault/VaultLiveFeedPage.tsx'
  },
  'ux:bottom-nav': {
    rule: 'Mobile bottom nav',
    expected: 'gv-vault-bottom-nav fixed with safe-area padding',
    defaultFile: 'client/components/vault/VaultShell.tsx'
  },
  'visual-integrity:panel-clipping': {
    rule: 'Visual integrity — panel clipping',
    expected: 'React modal CSS prevents desktop text clipping',
    defaultFile: 'client/lib/vault-shell.css'
  },
  'visual-integrity:layout-overflow': {
    rule: 'Visual integrity — layout overflow',
    expected: 'React scroll chain allows full content on desktop and mobile',
    defaultFile: 'client/lib/vault-shell.css'
  },
  'mobile-behavior:feed-freshness': {
    rule: 'React Live Feed freshness',
    expected: 'Live Feed items within QA_MOBILE_FEED_MAX_AGE_HOURS via /api/live/dashboard',
    defaultFile: 'client/components/vault/VaultLiveFeedPage.tsx'
  }
};

function describeRuleExpectation(checkId) {
  const meta = RULE_EXPECTATIONS[checkId];
  if (meta) return meta;
  return {
    rule: checkId || 'unknown rule',
    expected: 'QA check must pass after patch apply',
    defaultFile: patches.TEAM_OVERVIEW_FILES?.shell || 'index.html'
  };
}

function formatActualFromCheck(check, { localValidation, remoteCheck, qaPass } = {}) {
  if (check?.details?.length) {
    const formatted = check.details
      .slice(0, 5)
      .map((d) => {
        if (d.leakedClass) return `${d.leakedClass} in ${d.regionId || d.where || 'region'}`;
        if (d.pattern) return `forbidden pattern "${d.pattern}" in ${d.regionId || 'region'}`;
        if (d.class) return `class "${d.class}" in ${d.regionId || 'region'}`;
        if (d.url) return `broken URL ${d.url}`;
        if (d.token) return `token ${d.token}: ${d.issue || 'violation'}`;
        if (d.missing) return `missing ${d.missing}`;
        if (d.issue) return d.issue;
        return JSON.stringify(d);
      })
      .join('; ');
    if (formatted) return formatted;
  }
  if (check?.error) return check.error;
  if (localValidation && !localValidation.pass) {
    const failed = (localValidation.checks || []).filter((c) => !c.pass);
    if (failed.length) return failed.map((c) => `${c.id}: ${c.error || 'failed'}`).join('; ');
  }
  if (remoteCheck && !remoteCheck.pass) return remoteCheck.error || `${remoteCheck.id} still failing on production`;
  if (qaPass === false) return 'Full QA crawl failed — one or more checks still open';
  return 'Validation failed — issue not resolved';
}

function generateCorrectivePatchSuggestion(ctx) {
  const { checkId, check, fix, appliedFiles } = ctx;
  const meta = describeRuleExpectation(checkId);
  const details = check?.details || [];

  const rebuilt = preparePatch({ checkId, module: fix?.module, details: check?.details }, check);
  if (rebuilt?.patchPreview) {
    return {
      file: rebuilt.patchPreview.file || meta.defaultFile,
      before: rebuilt.patchPreview.before || fix?.patchPreview?.before || 'check failed',
      after: rebuilt.patchPreview.after || meta.expected,
      edits: (rebuilt.edits || []).filter((e) => !reactBp.isForbiddenEdit(e)),
      suggestedFix: fix?.suggestedFix || rebuilt.suggestedFix || meta.expected
    };
  }

  const patchedFile =
    appliedFiles?.[0] ||
    fix?.patch?.edits?.[0]?.file ||
    fix?.patchPreview?.file ||
    meta.defaultFile;

  if (checkId === 'integrity:feed-dedup' || checkId === 'integrity:autoposter-dedup') {
    return {
      file: 'data/live/feed-items.json',
      before: `${details.length || '?'} feed integrity issue(s)`,
      after: 'validateFeedIntegrity() → repairFeedItems() with SHA-256 hashes',
      edits: [{ file: 'data/live/feed-items.json', type: 'repair-feed-integrity' }],
      suggestedFix: 'Repair data/live/feed-items.json for VaultLiveFeedPage'
    };
  }

  if (checkId === 'integrity:film-sources') {
    const broken = details[0];
    const before = broken?.url || 'broken source_url';
    const after = patches.fallbackForUrl(broken?.url);
    return {
      file: 'data/film-room-knowledge',
      before,
      after,
      edits: [{ file: 'data/film-room-knowledge', type: 'replace-broken-source-urls', replacements: [{ url: before, fallback: after }] }],
      suggestedFix: 'Fix Film Room source URLs for VaultFilmRoomPage verified links'
    };
  }

  return {
    file: patchedFile,
    before: fix?.patchPreview?.before || check?.error || 'validation failed',
    after: meta.expected,
    edits: (fix?.patch?.edits || []).filter((e) => !reactBp.isForbiddenEdit(e)),
    suggestedFix: fix?.suggestedFix || reactBp.reactExplanation(checkId, check)
  };
}

function buildFailureReport(ctx) {
  const { checkId, check, fix, run, localValidation, remoteCheck, qaPass } = ctx;
  const meta = describeRuleExpectation(checkId);
  const primaryCheck = check || remoteCheck || (localValidation?.checks || []).find((c) => c.id === checkId && !c.pass);
  const actual = formatActualFromCheck(primaryCheck, { localValidation, remoteCheck, qaPass });
  const correctivePatch = generateCorrectivePatchSuggestion({
    checkId,
    check: primaryCheck,
    fix,
    appliedFiles: ctx.appliedFiles,
    run
  });

  const reason = primaryCheck?.error
    ? `${checkId} — ${primaryCheck.error}`
    : `${checkId} — ${meta.rule} validation failed`;

  return {
    reason,
    expected: meta.expected,
    actual,
    correctivePatch,
    checkId,
    runId: run?.id || null,
    fixId: fix?.id || null,
    violations: primaryCheck?.details?.slice(0, 8) || null,
    localPass: localValidation?.pass ?? null,
    remotePass: remoteCheck?.pass ?? null,
    qaPass: qaPass ?? null
  };
}

module.exports = {
  prepareFixProposal,
  preparePatch,
  buildFromTemplate,
  enrichWithTemplate,
  buildBackgroundThemePatch,
  buildFeedDedupPatch,
  buildFilmSourcePatch,
  generateCorrectivePatchSuggestion,
  describeRuleExpectation,
  formatActualFromCheck,
  buildFailureReport,
  RULE_EXPECTATIONS
};

