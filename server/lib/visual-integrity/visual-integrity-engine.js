/**
 * Visual integrity — HTML/CSS analysis helpers.
 */
const fs = require('fs');
const path = require('path');

const RULES_PATH = path.join(__dirname, 'visual-integrity-rules.json');

function loadRules() {
  return JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
}

function extractRegionById(html, regionId) {
  const marker = `id="${regionId}"`;
  const start = html.indexOf(marker);
  if (start < 0) return '';
  const slice = html.slice(start);
  const nextVpane = slice.search(/<div[^>]+id="vpane-/i);
  const end = nextVpane > 50 ? nextVpane : Math.min(slice.length, 120000);
  return slice.slice(0, end);
}

function collectMatches(text, patterns) {
  const hits = [];
  (patterns || []).forEach((pat) => {
    if (text.includes(pat)) hits.push(pat);
  });
  return hits;
}

function detectBackgrounds(text, rules) {
  const found = [];
  Object.entries(rules.backgroundDetectors || {}).forEach(([name, patterns]) => {
    if (collectMatches(text, patterns).length) found.push(name);
  });
  return found;
}

function patternsForDetectors(detectorNames, rules) {
  const out = [];
  (detectorNames || []).forEach((name) => {
    const pats = rules.backgroundDetectors?.[name] || [];
    out.push(...pats);
  });
  return [...new Set(out)];
}

function checkRegionContamination(html, pageKey, rules) {
  const cfg = rules.pageRegions?.[pageKey];
  if (!cfg) return [];
  const violations = [];
  const forbiddenPats = patternsForDetectors(cfg.forbiddenDetectors, rules);

  (cfg.regionIds || []).forEach((regionId) => {
    const region = extractRegionById(html, regionId);
    if (!region) {
      violations.push({ regionId, issue: 'region_missing' });
      return;
    }
    forbiddenPats.forEach((pat) => {
      if (region.includes(pat)) {
        violations.push({ regionId, pattern: pat, type: 'forbidden_background_class' });
      }
    });
    (cfg.requiredClasses || []).forEach((cls) => {
      if (!region.includes(cls)) {
        violations.push({ regionId, missing: cls, type: 'required_class_missing' });
      }
    });
  });

  if (cfg.desktopOnlyClasses) {
    const desktop = extractRegionById(html, 'vpane-team');
    cfg.desktopOnlyClasses.forEach((cls) => {
      if (desktop && !desktop.includes(cls)) {
        violations.push({ regionId: 'vpane-team', missing: cls, type: 'desktop_layout_missing' });
      }
    });
  }

  return violations;
}

function checkComponentVariants(html, rules) {
  const violations = [];
  const teamCfg = rules.componentVariants?.['team-overview'];
  if (teamCfg) {
    (teamCfg.regionIds || []).forEach((regionId) => {
      const region = extractRegionById(html, regionId);
      if (!region) return;
      (teamCfg.forbiddenClasses || []).forEach((cls) => {
        if (region.includes(cls)) {
          violations.push({ component: 'team-overview', regionId, class: cls });
        }
      });
    });
    const desktop = extractRegionById(html, 'vpane-team');
    if (desktop) {
      const hasLayout = (teamCfg.requiredMarkers || []).some((m) => desktop.includes(m));
      if (!hasLayout) {
        violations.push({ component: 'team-overview', issue: 'missing_overview_layout_markers' });
      }
    }
  }

  const filmCfg = rules.componentVariants?.['film-source'];
  if (filmCfg) {
    (filmCfg.globalHooks || []).forEach((hook) => {
      if (!html.includes(hook)) {
        violations.push({ component: 'film-source', missingHook: hook });
      }
    });
    (filmCfg.forbiddenClasses || []).forEach((cls) => {
      const filmRegion = extractRegionById(html, 'vpane-highlights');
      if (filmRegion.includes(cls)) {
        violations.push({ component: 'film-source', class: cls });
      }
    });
  }

  const trialCfg = rules.componentVariants?.['trial-page'];
  if (trialCfg) {
    const trialHtml = (trialCfg.regionMarkers || [])
      .map((m) => (html.includes(m) ? extractRegionAround(html, m) : ''))
      .join('');
    (trialCfg.forbiddenOutsideTrial || []).forEach((cls) => {
      const teamRegions = ['vpane-team', 'vpane-mteam', 'vpane-highlights']
        .map((id) => extractRegionById(html, id))
        .join('');
      if (teamRegions.includes(cls)) {
        violations.push({ component: 'trial-page', leakedClass: cls, where: 'non-trial-region' });
      }
    });
  }

  return violations;
}

function extractRegionAround(html, marker) {
  const idx = html.indexOf(marker);
  if (idx < 0) return '';
  return html.slice(Math.max(0, idx - 200), idx + 800);
}

function checkCssTokens(teamCss, html, rules) {
  const violations = [];
  const tokenCfg = rules.cssTokenRules?.team;
  if (tokenCfg) {
    (tokenCfg.requiredTokens || []).forEach((token) => {
      if (!teamCss.includes(token)) {
        violations.push({ token, issue: 'missing_in_team_css' });
      }
    });
    const teamHtml = ['vpane-team', 'vpane-mteam']
      .map((id) => extractRegionById(html, id))
      .join('');
    (tokenCfg.forbiddenInTeamHtml || []).forEach((token) => {
      if (teamHtml.includes(token)) {
        violations.push({ token, issue: 'forbidden_token_in_team_html' });
      }
    });
  }
  return violations;
}

function checkCssLinked(html, rules) {
  const teamCfg = rules.pageRegions?.['/team'];
  if (!teamCfg?.cssFile) return [];
  if (!html.includes(teamCfg.cssFile)) {
    return [{ issue: 'team_css_not_linked', file: teamCfg.cssFile }];
  }
  return [];
}

function checkCrossPageContamination(html, rules) {
  const violations = [];
  Object.entries(rules.forbiddenBackgroundsCrossPage || {}).forEach(([bgName, pages]) => {
    const patterns = rules.backgroundDetectors?.[bgName] || [];
    pages.forEach((pageKey) => {
      if (pageKey === 'trial') return;
      const cfg = rules.pageRegions?.[pageKey];
      if (!cfg) return;
      (cfg.regionIds || []).forEach((regionId) => {
        const region = extractRegionById(html, regionId);
        patterns.forEach((pat) => {
          if (region.includes(pat)) {
            violations.push({ page: pageKey, regionId, background: bgName, pattern: pat });
          }
        });
      });
    });
  });
  return violations;
}

module.exports = {
  loadRules,
  extractRegionById,
  detectBackgrounds,
  checkRegionContamination,
  checkComponentVariants,
  checkCssTokens,
  checkCssLinked,
  checkCrossPageContamination,
  patternsForDetectors
};
