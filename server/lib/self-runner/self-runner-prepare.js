/**
 * Self-Runner — build patch proposals from product-intel issues (no apply).
 */
const fs = require('fs');
const patches = require('./self-runner-patches');
const templates = require('./self-runner-patch-templates');
const engine = require('../visual-integrity/visual-integrity-engine');
const contextPatch = require('./context-patch-generator');
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
  const edits = [];
  const preview = { file: 'index.html', changes: [] };
  const htmlPath = patches.absPath('index.html');
  let html = '';
  try {
    html = fs.readFileSync(htmlPath, 'utf8');
  } catch {
    return null;
  }

  const violations = checkDetails?.details || issue.details || [];
  const forbiddenHits = Array.isArray(violations)
    ? violations.filter((v) => v.pattern || v.class || v.leakedClass)
    : [];

  ['vpane-team', 'vpane-mteam'].forEach((regionId) => {
    const region = extractRegionById(html, regionId);
    if (!region) return;
    patches.TEAM_FORBIDDEN_IN_REGION.forEach((cls) => {
      if (region.includes(cls)) {
        edits.push({
          file: 'index.html',
          type: 'remove-class-from-region',
          regionId,
          className: cls
        });
        preview.changes.push({ regionId, remove: cls });
      }
    });
    (patches.TEAM_REQUIRED[regionId] || []).forEach((cls) => {
      if (region.includes(regionId) && !region.includes(cls)) {
        edits.push({
          file: 'index.html',
          type: 'add-class-to-region',
          regionId,
          className: cls
        });
        preview.changes.push({ regionId, add: cls });
      }
    });
  });

  forbiddenHits.forEach((v) => {
    const pat = v.pattern || v.class || v.leakedClass;
    if (pat && !edits.some((e) => e.className === pat)) {
      edits.push({
        file: 'index.html',
        type: 'remove-class-from-region',
        regionId: v.regionId || 'vpane-team',
        className: pat
      });
      preview.changes.push({ regionId: v.regionId, remove: pat });
    }
  });

  if (!html.includes('/css/gv-team.css')) {
    edits.push({
      file: 'index.html',
      type: 'insert-before',
      anchor: '</head>',
      text: '    <link rel="stylesheet" href="/css/gv-team.css?v=team-self-runner">\n'
    });
    preview.changes.push({ addCssLink: '/css/gv-team.css' });
  }

  if (!edits.length) {
    edits.push({
      file: 'index.html',
      type: 'ensure-team-shell',
      regionIds: ['vpane-team', 'vpane-mteam']
    });
    preview.changes.push({ note: 'Ensure gv-team-page shell on Team panes' });
  }

  return {
    patchType: 'background-theme',
    edits,
    patchPreview: preview,
    suggestedFix:
      issue.suggestedFix ||
      'Replace trial/promo classes with gv-team-page + gv-team-overview-layout; use gv-team.css tokens only'
  };
}

function buildFeedDedupPatch(issue, checkDetails) {
  const v2 = contextPatch.buildFeedDedupPatchV2(issue);
  if (v2) return v2;
  const dups = checkDetails?.details || issue.details || [];
  return {
    patchType: 'feed-dedup',
    riskLevel: 'low',
    edits: [{ file: 'data/live/feed-items.json', type: 'dedupe-feed-smart' }],
    patchPreview: {
      file: 'data/live/feed-items.json',
      before: `${Array.isArray(dups) ? dups.length : '?'} duplicate feed item(s)`,
      after: 'Deduped by SHA-256 normalized hash within window'
    },
    suggestedFix: issue.suggestedFix || 'Run smart feed dedupe with SHA-256 hashes'
  };
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

  const diff0 = tmpl.diff[0] || {};
  return {
    ...built,
    patchType: tmpl.patchType,
    suggestedFix: built.suggestedFix || tmpl.description,
    patchPreview: {
      ...built.patchPreview,
      file: built.patchPreview?.file || tmpl.files[0],
      files: tmpl.files,
      diff: tmpl.diff,
      before: diff0.before || built.patchPreview?.before,
      after: diff0.after || built.patchPreview?.after
    },
    template: {
      ruleId: tmpl.ruleId,
      category: tmpl.category,
      classification: tmpl.classification,
      safetyRules: tmpl.safetyRules,
      diff: tmpl.diff
    },
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
      return [
        {
          file: 'css/gv-team.css',
          type: 'append-if-missing',
          marker: 'Self-Runner 2.0: modal overflow guards',
          text: patches.MODAL_OVERFLOW_CSS_SNIPPET
        }
      ];
    case 'background-theme':
      return [{ file: 'index.html', type: 'ensure-team-shell', regionIds: ['vpane-team', 'vpane-mteam'] }];
    case 'missing-content':
    case 'ordering-fix':
    case 'html-hook': {
      const v2 = contextPatch.generateContextPatch(issue, {});
      if (v2?.edits?.length) return v2.edits;
      const missing = contextPatch.scanHtmlHooks();
      const hookPatch = contextPatch.buildHtmlHookPatch(missing);
      return hookPatch?.edits || [];
    }
    case 'autoposter-dedup':
    case 'similarity-filter':
      return [{ file: 'data/live/feed-items.json', type: 'dedupe-feed-smart' }];
    case 'recruiting-board-sync':
      return [{ file: 'data/recruiting/players.json', type: 'verify-json', checkId: issue.checkId }];
    case 'roster-sync':
      return [{ file: 'data/roster/players.json', type: 'verify-json', checkId: issue.checkId }];
    case 'api-latency':
      return [{ file: 'lib/live-routes.js', type: 'verify-api-cache', endpoint: ctx.endpoint }];
    case 'film-source-url':
      return [{ file: 'data/film-room-knowledge', type: 'replace-broken-source-urls', replacements: [] }];
    default:
      return [{ file, type: 'template-guided', ruleId: tmpl.ruleId }];
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
  const patchType = patches.resolvePatchType(issue);
  if (!patchType && !templates.resolveRuleId(issue)) return null;

  const checkId = issue.checkId || '';
  let built = null;

  if (checkId.includes('component-variants')) {
    built = buildComponentVariantPatch(issue, checkDetails);
  } else if (patchType === 'team-content') {
    built = buildTeamContentPatch(issue, checkDetails);
  } else if (patchType === 'background-theme') {
    built = buildBackgroundThemePatch(issue, checkDetails);
  } else if (patchType === 'feed-dedup' || patchType === 'autoposter-dedup' || patchType === 'similarity-filter') {
    built = buildFeedDedupPatch(issue, checkDetails);
  } else if (patchType === 'film-source-url') {
    built = buildFilmSourcePatch(issue, checkDetails);
  } else if (patchType === 'html-hook' || patchType === 'missing-content') {
    built = buildHtmlHookPatch(issue);
  } else if (patchType === 'css-token' || patchType === 'layout-overflow' || patchType === 'panel-layering') {
    built = buildCssTokenPatch(issue);
  } else if (patchType === 'ordering-fix' || patchType === 'recruiting-board-sync' || patchType === 'roster-sync' || patchType === 'api-latency') {
    built = buildFromTemplate(issue, checkDetails);
  }

  if (!built) built = buildFromTemplate(issue, checkDetails);
  if (!built || !built.edits?.length) {
    built = contextPatch.generateContextPatch(issue, checkDetails);
  }
  if (!built || !built.edits?.length) return null;

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
    codeDiff: patch.patchPreview?.diff || patch.template?.diff || null,
    codeDiffHint: piProposal?.codeDiffHint || patch.patchPreview?.after || null,
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

/** Rule metadata for failure reports */
const RULE_EXPECTATIONS = {
  'visual-integrity:component-variants': {
    rule: 'Team Overview component variants',
    expected:
      'index.html #vpane-team / #vpane-mteam use gv-team-page, gv-team-overview-layout, gv-team-section, gv-team-era-card — no card-h, trial, or pricing classes',
    defaultFile: 'index.html'
  },
  'visual-integrity:team-overview-background': {
    rule: 'Team Overview background / theme',
    expected: 'Team panes use gv-team-page shell with gv-team.css — no trial-promo or pricing backgrounds',
    defaultFile: 'index.html'
  },
  'visual-integrity:team-css-linked': {
    rule: 'Team module CSS linked',
    expected: 'index.html includes <link href="/css/gv-team.css">',
    defaultFile: 'index.html'
  },
  'visual-integrity:team-theme-tokens': {
    rule: 'Team CSS design tokens',
    expected: 'css/gv-team.css defines --gv-team-card-bg, --gv-team-radius, --gv-team-space-4, --gv-team-title, --gv-team-body',
    defaultFile: 'css/gv-team.css'
  },
  'visual-integrity:cross-page-contamination': {
    rule: 'Cross-page theme isolation',
    expected: 'Trial/promo classes only in pricing/reg modal — not in Team, Film Room, Latest, or Admin panes',
    defaultFile: 'index.html'
  },
  'visual-integrity:film-room-theme': {
    rule: 'Film Room theme isolation',
    expected: 'Film Room pane uses film hooks only — no trial or team contamination',
    defaultFile: 'index.html'
  },
  'visual-integrity:admin-theme': {
    rule: 'Admin Hub neutral theme',
    expected: 'admin.html uses hub-neutral CSS — no gv-team or trial classes',
    defaultFile: 'admin.html'
  },
  'integrity:feed-dedup': {
    rule: 'Latest Updates feed dedup',
    expected: 'No duplicate feed items by URL or player/event key in data/live/feed-items.json',
    defaultFile: 'data/live/feed-items.json'
  },
  'integrity:film-sources': {
    rule: 'Film Room source URLs',
    expected: 'All Film Room knowledge source_url values return HTTP 200',
    defaultFile: 'data/film-room-knowledge/*.json'
  },
  'pages:team-hooks': {
    rule: 'Team tab modal hooks',
    expected: 'index.html includes gvOpenTeamDetail, gv-team-detail-modal, gv-team-mobile.js',
    defaultFile: 'index.html'
  },
  'pages:film-room-hooks': {
    rule: 'Film Room verified source hooks',
    expected: 'index.html includes gvOpenVerifiedSource, gv-film-source, gv-verified-source-modal',
    defaultFile: 'index.html'
  },
  'mobile-behavior:stale-html': {
    rule: 'Production HTML build stamp',
    expected: 'Netlify production meta gv-build matches repo server/index.html; #vpane-mteam includes gv-team-page',
    defaultFile: 'index.html'
  },
  'mobile-behavior:team-tab-theme': {
    rule: 'Mobile Team tab theme',
    expected: 'Mobile Team tab shows gv-team-page dark theme without trial-expired overlay or promo markup in #vpane-mteam',
    defaultFile: 'index.html'
  },
  'mobile-behavior:navigation-back': {
    rule: 'Mobile modal back navigation',
    expected: 'Recruit/team profile modals use gvPushModalHistory; back gesture closes modal and restores prior pane',
    defaultFile: 'index.html'
  },
  'integrity:filmroom-structure': {
    rule: 'Film Room hub structure',
    expected: 'index.html has film-room-hub-landing, GV_FILM_HUB_DESC, gvOpenFilmRoomHub for all 5 categories',
    defaultFile: 'index.html'
  },
  'integrity:team-history-structure': {
    rule: 'Program History era structure',
    expected: 'gv-team-mobile.js defines 5 ERAS with coaching, milestones, schemes — Spurrier only in era-90s',
    defaultFile: 'js/gv-team-mobile.js'
  },
  'integrity:missing-content': {
    rule: 'Section content markers',
    expected: 'All site sections (Team, Film Room, Recruiting, Latest Updates, Depth Chart, Roster) have required hooks',
    defaultFile: 'index.html'
  },
  'integrity:layout-overflow': {
    rule: 'Modal layout overflow CSS',
    expected: 'gv-team.css: .gv-team-modal-body has min-height:0, overflow-y:auto, overflow-wrap on text blocks',
    defaultFile: 'css/gv-team.css'
  },
  'integrity:panel-clipping': {
    rule: 'Panel clipping guards',
    expected: 'gv-team.css: min-width:0 + overflow-wrap on .gv-tm-lead, .gv-tm-highlight-text, .gv-team-overview-main',
    defaultFile: 'css/gv-team.css'
  },
  'integrity:wrong-background': {
    rule: 'Team Identity backgrounds',
    expected: 'Era gradient classes on identity banner — no og-image.jpg or trial/pricing backgrounds',
    defaultFile: 'css/gv-team.css'
  },
  'integrity:autoposter-dedup': {
    rule: 'Autoposter duplication',
    expected: 'No duplicate URLs/titles or truncated copy (…) in feed-items.json',
    defaultFile: 'data/live/feed-items.json'
  },
  'visual-integrity:panel-clipping': {
    rule: 'Visual integrity — panel clipping',
    expected: 'Modal CSS guards prevent desktop text clipping',
    defaultFile: 'css/gv-team.css'
  },
  'visual-integrity:layout-overflow': {
    rule: 'Visual integrity — layout overflow',
    expected: 'Modal flex scroll chain allows full content on desktop',
    defaultFile: 'css/gv-team.css'
  },
  'mobile-behavior:navigation-back': {
    rule: 'Mobile modal back navigation',
    expected: 'Recruit/team profile modals use gvPushModalHistory; back gesture closes modal and restores prior pane',
    defaultFile: 'index.html'
  },
  'mobile-behavior:feed-freshness': {
    rule: 'Mobile Latest Updates freshness',
    expected: 'Home tab feed items within QA_MOBILE_FEED_MAX_AGE_HOURS; gvLoadLiveDashboard force refresh on tab focus',
    defaultFile: 'index.html'
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
  const patchedFile =
    appliedFiles?.[0] ||
    fix?.patch?.edits?.[0]?.file ||
    fix?.patchPreview?.file ||
    meta.defaultFile;

  let before = null;
  let after = null;
  let edits = [];

  if (checkId.includes('component-variants') || checkId.includes('team-overview')) {
    const v = details[0] || {};
    const leaked = v.leakedClass || v.class || v.pattern;
    const regionId = v.regionId || 'vpane-team';
    if (leaked && patches.TEAM_LEGACY_CARD_SWAPS[leaked]) {
      before = leaked;
      after = patches.TEAM_LEGACY_CARD_SWAPS[leaked];
      edits = [{ file: patchedFile, type: 'class-swap-in-region', regionId, from: before, to: after }];
    } else if (leaked && patches.TEAM_FORBIDDEN_IN_REGION.includes(leaked)) {
      before = leaked;
      after = '(remove from #' + regionId + ')';
      edits = [{ file: patchedFile, type: 'remove-class-from-region', regionId, className: leaked }];
    } else if (v.issue === 'missing_overview_layout_markers') {
      before = 'missing gv-team-overview-layout';
      after = 'gv-team-overview-layout on #vpane-team';
      edits = [{ file: patchedFile, type: 'add-class-to-region', regionId: 'vpane-team', className: 'gv-team-overview-layout' }];
    } else {
      before = leaked || 'legacy promo/trial classes (card-h, text-amber-300)';
      after = 'gv-team-page gv-team-overview-layout gv-team-era-card';
      edits = [
        { file: patchedFile, type: 'add-class-to-region', regionId: 'vpane-team', className: 'gv-team-page' },
        { file: patchedFile, type: 'add-class-to-region', regionId: 'vpane-team', className: 'gv-team-overview-layout' }
      ];
    }
  } else if (checkId.includes('team-css-linked')) {
    before = 'missing /css/gv-team.css link';
    after = '<link rel="stylesheet" href="/css/gv-team.css">';
    edits = [{ file: 'index.html', type: 'insert-before', anchor: '</head>', text: '    <link rel="stylesheet" href="/css/gv-team.css">\n' }];
  } else if (checkId.includes('theme-token')) {
    before = details.map((d) => d.token).filter(Boolean).join(', ') || 'missing --gv-team-* tokens';
    after = '--gv-team-card-bg, --gv-team-radius, --gv-team-space-4, --gv-team-title, --gv-team-body';
    edits = [{ file: 'css/gv-team.css', type: 'ensure-css-tokens', tokens: after.split(', ') }];
  } else if (checkId === 'integrity:feed-dedup') {
    before = `${details.length || '?'} duplicate feed item(s)`;
    after = 'deduped feed-items.json';
    edits = [{ file: 'data/live/feed-items.json', type: 'dedupe-feed' }];
  } else if (checkId === 'integrity:film-sources') {
    const broken = details[0];
    before = broken?.url || 'broken source_url';
    after = patches.fallbackForUrl(broken?.url);
    edits = [{ file: 'data/film-room-knowledge', type: 'replace-broken-source-urls', replacements: [{ url: before, fallback: after }] }];
  } else if (checkId.includes('hooks')) {
    const hook = details[0]?.missing || check?.error || 'required hook';
    before = `missing ${hook}`;
    after = `wire ${hook} in ${patchedFile}`;
    edits = [{ file: patchedFile, type: 'verify-hooks', checkId }];
  } else if (details.length) {
    const d = details[0];
    before = d.pattern || d.class || d.leakedClass || d.url || JSON.stringify(d);
    after = meta.expected.split('—')[0].trim();
    edits = fix?.patch?.edits || [];
  } else {
    const rebuilt = preparePatch(
      { checkId, module: fix?.module, details: check?.details },
      check
    );
    if (rebuilt?.patchPreview) {
      before = rebuilt.patchPreview.before;
      after = rebuilt.patchPreview.after;
      edits = rebuilt.edits || [];
    }
  }

  return {
    file: patchedFile,
    before: before || fix?.patchPreview?.before || 'incorrect markup',
    after: after || fix?.patchPreview?.after || meta.expected,
    edits,
    suggestedFix:
      fix?.suggestedFix ||
      `Update ${patchedFile}: replace "${before}" with "${after}" per ${meta.rule}`
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

