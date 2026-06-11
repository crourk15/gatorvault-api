/**
 * Self-Runner — build patch proposals from product-intel issues (no apply).
 */
const fs = require('fs');
const patches = require('./self-runner-patches');
const engine = require('../visual-integrity/visual-integrity-engine');

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
  const dups = checkDetails?.details || issue.details || [];
  return {
    patchType: 'feed-dedup',
    edits: [{ file: 'data/live/feed-items.json', type: 'dedupe-feed' }],
    patchPreview: {
      file: 'data/live/feed-items.json',
      before: `${Array.isArray(dups) ? dups.length : '?'} duplicate feed item(s)`,
      after: 'Deduped by URL + player/event key (keep newest)'
    },
    suggestedFix: issue.suggestedFix || 'Run feed dedupe — collapse duplicate URLs and player/event keys'
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
  const tpl = patches.HOOK_SNIPPETS[checkId];
  if (!tpl) {
    return {
      patchType: 'html-hook',
      edits: [{ file: 'index.html', type: 'verify-hooks', checkId }],
      patchPreview: { file: 'index.html', before: 'missing hooks', after: checkId },
      suggestedFix: issue.suggestedFix || `Wire required hooks for ${checkId}`
    };
  }
  return {
    patchType: 'html-hook',
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
      after: tpl.snippet.trim().slice(0, 80)
    },
    suggestedFix: issue.suggestedFix || `Add ${tpl.marker} hook to index.html`
  };
}

function buildCssTokenPatch(issue) {
  const tokens = ['--gv-team-card-bg', '--gv-team-radius', '--gv-team-space-4', '--gv-team-title', '--gv-team-body'];
  return {
    patchType: 'css-token',
    edits: [{ file: 'css/gv-team.css', type: 'ensure-css-tokens', tokens }],
    patchPreview: {
      file: 'css/gv-team.css',
      before: 'missing team tokens',
      after: tokens.join(', ')
    },
    suggestedFix: issue.suggestedFix || 'Define --gv-team-* design tokens in css/gv-team.css'
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

function preparePatch(issue, checkDetails) {
  const patchType = patches.resolvePatchType(issue);
  if (!patchType) return null;

  const checkId = issue.checkId || '';
  let built = null;

  if (checkId.includes('component-variants')) {
    built = buildComponentVariantPatch(issue, checkDetails);
  } else if (patchType === 'background-theme') {
    built = buildBackgroundThemePatch(issue, checkDetails);
  } else if (patchType === 'feed-dedup') {
    built = buildFeedDedupPatch(issue, checkDetails);
  } else if (patchType === 'film-source-url') {
    built = buildFilmSourcePatch(issue, checkDetails);
  } else if (patchType === 'html-hook') {
    built = buildHtmlHookPatch(issue);
  } else if (patchType === 'css-token') {
    built = buildCssTokenPatch(issue);
  }

  if (!built || !built.edits?.length) return null;
  return built;
}

function prepareFixProposal(issue, { seq, checkDetails } = {}) {
  if (!patches.isEligible(issue)) return null;

  const patch = preparePatch(issue, checkDetails);
  if (!patch) return null;

  const id = nextId(seq);
  return {
    id,
    sourceIssueId: issue.id,
    checkId: issue.checkId,
    title: issue.title || issue.id,
    module: issue.module,
    severity: issue.severity || 'high',
    impact: issue.impact || 'user-facing',
    status: 'pending',
    patchType: patch.patchType,
    patchPreview: patch.patchPreview,
    patch: { edits: patch.edits },
    suggestedFix: patch.suggestedFix,
    repro: issue.repro || null,
    createdAt: new Date().toISOString(),
    approvedAt: null,
    completedAt: null,
    rejectedAt: null
  };
}

module.exports = {
  prepareFixProposal,
  preparePatch,
  buildBackgroundThemePatch,
  buildFeedDedupPatch,
  buildFilmSourcePatch
};
