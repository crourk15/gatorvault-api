const fs = require('fs');
const path = require('path');

const content = `/**
 * Insider Articles — public article types (no War Room product branding).
 */
const CATEGORY_TO_ARTICLE_TYPE = {
  program_pulse: 'Program Pulse',
  heat_check: 'Heat Check',
  official_visit_preview: 'OV Preview',
  post_visit_reaction: 'Post-Visit',
  staff_intel: 'Insider',
  summer_preview: 'Game Week',
  depth_chart_movement: 'Roster Analysis',
  insider: 'Insider',
  game_week_preview: 'Game Week',
  roster_analysis: 'Roster Analysis',
};

const RECRUITING_BATTLE_CATEGORIES = new Set([
  'heat_check',
  'official_visit_preview',
  'post_visit_reaction',
]);

const RECRUITING_BATTLE_ARTICLE_TYPES = new Set(['Heat Check', 'OV Preview', 'Post-Visit']);

const LEGACY_RECRUITING_BATTLE_TYPES = new Set(['War Room', 'Recruiting Intel']);

function articleTypeForCategory(category) {
  return CATEGORY_TO_ARTICLE_TYPE[category] || 'Insider';
}

function isRecruitingBattleCategory(category) {
  return RECRUITING_BATTLE_CATEGORIES.has(String(category || ''));
}

function isRecruitingBattleArticleType(articleType) {
  const t = String(articleType || '');
  return RECRUITING_BATTLE_ARTICLE_TYPES.has(t) || LEGACY_RECRUITING_BATTLE_TYPES.has(t);
}

module.exports = {
  CATEGORY_TO_ARTICLE_TYPE,
  RECRUITING_BATTLE_CATEGORIES,
  RECRUITING_BATTLE_ARTICLE_TYPES,
  articleTypeForCategory,
  isRecruitingBattleCategory,
  isRecruitingBattleArticleType,
};
`;

fs.writeFileSync(
  path.join(__dirname, '../lib/insider-articles-types.js'),
  content,
  'utf8'
);
console.log('wrote insider-articles-types.js');
