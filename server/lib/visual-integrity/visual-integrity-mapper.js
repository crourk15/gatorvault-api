/**
 * Maps visual-integrity failures → product-intel scoring, fix queue, recommendations.
 */
const FIX_TEMPLATES = {
  'visual-integrity:team-overview-background': {
    title: 'Fix Team Overview background',
    suggestedFix: 'Replace trial/promo classes with gv-team-page shell and gv-team-overview-layout; use gv-team.css tokens only'
  },
  'visual-integrity:team-css-linked': {
    title: 'Link Team module CSS',
    suggestedFix: 'Add <link rel="stylesheet" href="/css/gv-team.css"> to index.html'
  },
  'visual-integrity:team-theme-tokens': {
    title: 'Restore Team design tokens',
    suggestedFix: 'Define --gv-team-* spacing, radius, and card tokens in css/gv-team.css'
  },
  'visual-integrity:component-variants': {
    title: 'Fix Team Overview component variants',
    suggestedFix:
      'In index.html (#vpane-team / #vpane-mteam): use gv-team-page, gv-team-overview-layout, gv-team-section, gv-team-era-card — remove card-h and trial/pricing classes from Team panes'
  },
  'visual-integrity:cross-page-contamination': {
    title: 'Remove cross-page theme leaks',
    suggestedFix: 'Scope trial-promo and pricing styles to #pricing-sec and reg modal only — not Team panes'
  },
  'visual-integrity:film-room-theme': {
    title: 'Fix Film Room theme isolation',
    suggestedFix: 'Keep Film Room on film-slate tokens; wire gvOpenVerifiedSource hooks'
  },
  'visual-integrity:admin-theme': {
    title: 'Fix Admin Hub theme',
    suggestedFix: 'Admin should use hub-neutral CSS only — no gv-team or trial classes'
  }
};

function suggestedFix(checkId, details) {
  const tpl = FIX_TEMPLATES[checkId];
  if (tpl) return tpl.suggestedFix;
  if (checkId.includes('team-overview')) {
    return 'Replace trial-promo background with team-gradient (gv-team-page + gv-team.css)';
  }
  return 'Review visual-integrity-rules.json and align page region classes';
}

function fixQueueItemFromCheck(check) {
  const tpl = FIX_TEMPLATES[check.id] || {};
  return {
    id: `fix_${check.id}`,
    title: tpl.title || check.error || check.label,
    module: 'visual-integrity',
    severity: check.severity || inferVisualSeverity(check),
    impact: 'user-facing',
    repro: check.repro || null,
    suggestedFix: check.suggestedFix || suggestedFix(check.id, check.details),
    eta: inferVisualSeverity(check) === 'critical' || inferVisualSeverity(check) === 'high' ? 'short' : 'medium',
    checkId: check.id,
    url: check.url || null,
    createdAt: new Date().toISOString(),
    resolved: false
  };
}

function inferVisualSeverity(check) {
  const id = String(check.id || '');
  if (id.includes('cross-page') || id.includes('contamination')) return 'critical';
  if (id.includes('team-overview') || id.includes('theme-token') || id.includes('css-linked')) return 'high';
  if (check.module === 'visual-integrity') return 'high';
  return 'medium';
}

function productIntelPageChecks() {
  return {
    '/team': {
      score: [
        'visual-integrity:team-overview-background',
        'visual-integrity:team-theme-tokens',
        'visual-integrity:component-variants'
      ]
    }
  };
}

function productIntelFeatureChecks() {
  return {
    team_modals: ['visual-integrity:team-overview-background', 'visual-integrity:component-variants'],
    film_verified_source_modal: ['visual-integrity:film-room-theme', 'visual-integrity:component-variants'],
    admin_hub: ['visual-integrity:admin-theme']
  };
}

function upgradeRecommendationsFromFailures(failures) {
  return failures
    .filter((c) => c.module === 'visual-integrity' && !c.pass)
    .map((c) => ({
      page: c.id.includes('team') ? '/team' : c.id.includes('film') ? '/film-room' : 'site',
      score: null,
      reason: `Visual integrity failure: ${c.error || c.label}`,
      checkId: c.id
    }));
}

module.exports = {
  suggestedFix,
  fixQueueItemFromCheck,
  inferVisualSeverity,
  productIntelPageChecks,
  productIntelFeatureChecks,
  upgradeRecommendationsFromFailures,
  FIX_TEMPLATES
};
