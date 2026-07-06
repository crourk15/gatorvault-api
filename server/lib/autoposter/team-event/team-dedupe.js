/**
 * Team event post dedupe keys — kickoff / schedule / game week / staff.
 */
const crypto = require('crypto');
const { selectTeamArc } = require('./team-fact-extractor');

function slugPart(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function computeTeamDedupeKey(facts = {}) {
  const arc = selectTeamArc(facts);
  const parts = ['team', arc];
  if (arc === 'kickoff') {
    parts.push(slugPart(facts.opponent || 'opponent'));
    parts.push(slugPart(facts.kickoff_time || facts.network || 'kickoff'));
  } else if (arc === 'schedule') {
    parts.push(slugPart(facts.opponent || 'schedule'));
    parts.push(slugPart(facts.week_number || facts.network || 'week'));
  } else if (arc === 'game_week') {
    parts.push(slugPart(facts.opponent || 'matchup'));
    parts.push(slugPart(facts.home_away || 'home'));
  } else if (arc === 'staff') {
    parts.push(slugPart(facts.staff_name || 'staff'));
    parts.push(slugPart(facts.staff_role || facts.staff_action || 'move'));
  } else {
    parts.push(slugPart(facts.opponent || facts.event_type || 'general'));
  }
  const raw = parts.filter(Boolean).join('|');
  return crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16);
}

module.exports = { computeTeamDedupeKey, slugPart };