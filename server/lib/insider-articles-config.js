/** Insider Editorial Engine — rollout phases, calendar, env flags. */
const PHASE = {
  SYNTHESIS_ONLY: 0,
  LLM_MANUAL: 1,
  HYBRID_AUTO: 2,
  LLM_AUTO: 3,
};

function rolloutPhase() {
  if (process.env.INSIDER_ARTICLE_LLM_AUTO === 'true') return PHASE.LLM_AUTO;
  if (process.env.INSIDER_ARTICLE_HYBRID_AUTO === 'true') return PHASE.HYBRID_AUTO;
  if (process.env.INSIDER_ARTICLE_LLM_ENABLED === 'true') return PHASE.LLM_MANUAL;
  return PHASE.SYNTHESIS_ONLY;
}

function isLlmAllowed() {
  const key = process.env.OPENAI_API_KEY || process.env.INSIDER_ARTICLE_LLM_KEY;
  if (!key) return false;
  return rolloutPhase() >= PHASE.LLM_MANUAL;
}

function isAutoWeeklyEnabled() {
  if (process.env.INSIDER_ARTICLE_AUTO_WEEKLY === 'false') return false;
  if (process.env.INSIDER_ARTICLE_AUTO_WEEKLY === 'true') return true;
  return rolloutPhase() >= PHASE.HYBRID_AUTO;
}

function isGameWeekAutoPublishEnabled() {
  return process.env.INSIDER_ARTICLE_GAMEWEEK_AUTO_PUBLISH === 'true';
}

const EDITORIAL_CALENDAR = {
  1: { articleType: 'Game Week', categories: ['game_week_preview', 'summer_preview'] },
  2: { articleType: 'Film Room', categories: ['depth_chart_movement', 'staff_intel'] },
  3: { articleType: 'War Room', categories: ['heat_check', 'official_visit_preview', 'post_visit_reaction'] },
  4: { articleType: 'Roster Analysis', categories: ['roster_analysis', 'depth_chart_movement'] },
  5: { articleType: 'Program Pulse', categories: ['program_pulse', 'staff_intel'] },
  0: { articleType: 'Analytics', categories: ['game_week_preview', 'program_pulse'] },
  6: { articleType: 'Insider', categories: ['staff_intel', 'insider'] },
};

function calendarForToday(date = new Date()) {
  const dow = date.getDay();
  return EDITORIAL_CALENDAR[dow] || EDITORIAL_CALENDAR[1];
}

function calendarBoost(topic, date = new Date()) {
  const cal = calendarForToday(date);
  if (!topic?.category) return 0;
  if (cal.categories.includes(topic.category)) return 15;
  if (topic.articleType === cal.articleType) return 10;
  return 0;
}

function engineStatus() {
  return {
    phase: rolloutPhase(),
    llmAllowed: isLlmAllowed(),
    autoWeekly: isAutoWeeklyEnabled(),
    gameWeekAutoPublish: isGameWeekAutoPublishEnabled(),
    llmModel: process.env.INSIDER_ARTICLE_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    hasApiKey: Boolean(process.env.OPENAI_API_KEY || process.env.INSIDER_ARTICLE_LLM_KEY),
  };
}

module.exports = {
  PHASE,
  rolloutPhase,
  isLlmAllowed,
  isAutoWeeklyEnabled,
  isGameWeekAutoPublishEnabled,
  EDITORIAL_CALENDAR,
  calendarForToday,
  calendarBoost,
  engineStatus,
};