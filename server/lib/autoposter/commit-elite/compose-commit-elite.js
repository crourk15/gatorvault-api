/**
 * Commit Elite Compose v1 — research-backed commitment posts without voice/strategy gate.
 */
const template = require('../../x-autoposter-template');
const { extractCommitQuote } = require('../../beat-writer-filters');

const COMP_SCHOOLS_RE =
  /\b(?:chose|picked|selected)\s+(?:the\s+)?(?:florida|gators|\buf\b)\s+over\s+([A-Za-z0-9 .&'-]+?)(?:\s+and\s+([A-Za-z0-9 .&'-]+))?(?:[.!?,]|$)/i;
const CHOSE_OVER_RE = /\bover\s+([A-Za-z0-9 .&'-]+(?:\s+and\s+[A-Za-z0-9 .&'-]+)*)/i;
const BATTLE_SURGE_RE =
  /\b([A-Za-z0-9 .&'-]+)\s+surged\s+late\b[\s\S]{0,120}?\b(?:florida|gators|\buf\b)\s+(?:responded|regained|closed|sealed|won)/i;
const PRIORITY_RE =
  /\b(?:no\.?\s*\d+|#\d+)\s+(?:target|priority)\s+at\s+([a-z0-9 -]+)/i;
const MEASURE_RE = /\b(\d+'(?:\d+)?(?:\/\d+)?)\s*,?\s*(\d{2,3})\b/;

function normalizeBeat(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function eliteFirstName(fullName = '') {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return parts[0] || null;
}

function parseCompetingSchools(beatText = '', research = {}) {
  const beat = normalizeBeat(beatText);
  const out = [];
  const m = beat.match(COMP_SCHOOLS_RE);
  if (m) {
    for (const chunk of [m[1], m[2]].filter(Boolean)) {
      for (const school of String(chunk).split(/\s+and\s+/i)) {
        const s = school.trim().replace(/[.!?,]+$/, '');
        if (s && !/florida|gators|\buf\b/i.test(s)) out.push(s);
      }
    }
  }
  if (!out.length) {
    const over = beat.match(CHOSE_OVER_RE);
    if (over?.[1]) {
      for (const school of String(over[1]).split(/\s+and\s+/i)) {
        const s = school.trim().replace(/[.!?,]+$/, '');
        if (s && !/florida|gators|\buf\b/i.test(s)) out.push(s);
      }
    }
  }
  if (!out.length && Array.isArray(research.topSchools)) {
    for (const school of research.topSchools) {
      const s = String(school || '').trim();
      if (s && !/florida|gators|\buf\b/i.test(s)) out.push(s);
    }
  }
  return [...new Set(out.map((s) => s.replace(/\s+/g, ' ')))].slice(0, 3);
}

function parseBattleLine(beatText = '') {
  const beat = normalizeBeat(beatText);
  const surge = beat.match(BATTLE_SURGE_RE);
  if (surge?.[1]) {
    const rival = surge[1].trim();
    return `${rival} surged late, but Florida responded and closed it out.`;
  }
  if (/\bsurged late\b/i.test(beat) && /\b(?:responded|regained|sealed|closed)\b/i.test(beat)) {
    return 'Florida responded late and regained control to seal the commitment.';
  }
  return null;
}

function parsePriorityLine(beatText = '', research = {}) {
  const beat = normalizeBeat(beatText);
  const m = beat.match(PRIORITY_RE);
  if (m?.[1]) return `the Gators' priority target at ${m[1].trim()}`;
  const story = research.breakdown?.recruitingStory || research.breakdown?.staffNotes;
  if (story && String(story).length >= 20) {
    return template.stripEmojisHashtags(String(story)).slice(0, 110).replace(/[.!?]+$/, '');
  }
  if (research.ufPosition === 'staff priority') return 'a staff priority on the board';
  return null;
}

function parseMeasurements(beatText = '', ctx = {}) {
  if (ctx?.htWt) return ctx.htWt;
  const beat = normalizeBeat(beatText);
  const m = beat.match(MEASURE_RE);
  if (m) return `${m[1]}, ${m[2]}`;
  return null;
}

function extractCommitFacts(beatText = '', research = {}, ctx = {}) {
  return {
    quote: extractCommitQuote(beatText),
    competingSchools: parseCompetingSchools(beatText, research),
    battleLine: parseBattleLine(beatText),
    priorityLine: parsePriorityLine(beatText, research),
    measurements: parseMeasurements(beatText, ctx)
  };
}

function buildCommitIdentity(ctx, research, facts) {
  const enhanced = { ...ctx };
  if (facts.measurements && !enhanced.htWt) enhanced.htWt = facts.measurements;
  let identity = template.buildRecruitingIdentity(enhanced);
  const rankBits = [];
  if (research.player?.posRank > 0 && enhanced.pos) {
    rankBits.push(`On3 No. ${research.player.posRank} ${enhanced.pos}`);
  } else if (research.player?.natlRank > 0) {
    rankBits.push(`On3 No. ${research.player.natlRank}`);
  }
  if (research.player?.stateRank > 0) {
    rankBits.push(`No. ${research.player.stateRank} in ${research.player?.state || 'state'}`);
  }
  if (rankBits.length) identity += ` · ${rankBits.join(' · ')}`;
  return identity;
}

function buildCommitContext(research, facts, ctx) {
  const name = research.playerName || ctx.name || 'the verified recruit';
  const fn = eliteFirstName(name) || name;
  const yr = ctx.classYear || research.player?.classYear || '';
  const pos = ctx.pos || research.player?.pos || '';
  let context = `Florida lands a commitment from ${fn}${pos ? ` (${pos})` : ''}`;

  if (facts.priorityLine) {
    context += ` — ${facts.priorityLine}.`;
  } else if (yr && pos) {
    context += ` — a priority ${yr} ${pos} addition for the Gators.`;
  } else {
    context += '.';
  }

  const schools = facts.competingSchools;
  if (schools.length >= 2) {
    context += ` He chose Florida over ${schools.slice(0, 2).join(' and ')}.`;
  } else if (schools.length === 1) {
    context += ` He picked Florida over ${schools[0]}.`;
  }

  if (facts.battleLine && !context.toLowerCase().includes('surged late')) {
    context += ` ${facts.battleLine}`;
  }

  return context.replace(/\.\s+\./g, '.').replace(/\s+/g, ' ').trim();
}

function buildCommitInsider(research, facts) {
  if (facts.quote) {
    const q = facts.quote.replace(/[.!?]+$/, '');
    return `"${q}" — ${research.playerName || 'the new commit'}.`;
  }

  if (research.scouting?.scoutingSummary) {
    const line = template.extractSentences(template.stripEmojisHashtags(research.scouting.scoutingSummary))[0];
    if (line && line.length >= 24) {
      const analyst = research.scouting.analystName || 'Scouting';
      return `${analyst}: ${line.slice(0, 130).replace(/[.!?]+$/, '')}.`;
    }
  }

  const strength = research.breakdown?.strengths?.[0] || research.breakdown?.schemeFit;
  if (strength && String(strength).length >= 16) {
    const writer = research.breakdown?.sources?.[0]?.writer || 'War Room';
    return `${writer}: ${template.stripEmojisHashtags(String(strength)).slice(0, 130).replace(/[.!?]+$/, '')}.`;
  }

  if (facts.battleLine) return facts.battleLine;

  const schools = facts.competingSchools;
  if (schools[0]) {
    return `${schools[0]} was the main alternative before Gainesville won out.`;
  }

  return 'Staff closed a priority target once the fit and timing aligned for Florida.';
}

function composeCommitElite({ research, playerData, beatText = '', newsEvent = null } = {}) {
  if (!research?.playerName || !playerData?.ctx) return null;
  const ctx = playerData.ctx;
  if (!ctx?.name || !ctx?.pos) return null;

  const facts = extractCommitFacts(beatText, research, ctx);
  const identity = buildCommitIdentity(ctx, research, facts);
  const context = buildCommitContext(research, facts, ctx);
  const insider = buildCommitInsider(research, facts);
  if (!identity || !context || !insider) return null;

  const text = template.composeInsiderReport({ identity, context, insider });
  if (!text || !template.hasTemplateStructure(text)) return null;

  return {
    text,
    templateBlocks: { identity, context, insider },
    facts,
    commitElite: true,
    eventType: research.eventType || 'commit',
    newsEvent: newsEvent || 'committed to Florida'
  };
}

module.exports = {
  composeCommitElite,
  extractCommitFacts,
  buildCommitIdentity,
  buildCommitContext,
  buildCommitInsider
};