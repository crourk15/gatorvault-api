/**
 * X AutoPoster insider report template — identity · context · insider angle.
 * Formatting only; all facts must come from verified sources passed in.
 */
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u200d\uFE0F]/gu;
const HASHTAG_RE = /#\w+/g;

const INSIDER_SIGNAL_RE =
  /\b(staff|coaches?|loves|impressed|momentum|visit|timeline|decision|expected|pushing|rotation|depth chart|firmly in|early group|reached out|traction|standout|flashed|believes|summer decision|this weekend|soon|trend(?:ing)?\s+up|heating up|moving up|bigger role|in the mix)\b/i;

const FACTUAL_SIGNAL_RE =
  /\b(commit(?:ted|ment)?|decommit|flip(?:ped)?|portal|offer(?:ed|s)?|visit|cancel(?:led|ed)|injur(?:y|ed)|out for|depth chart|camp|practice|signed|enrolled|prediction|forecast|rpm|futurecast)\b/i;

const HEADLINE_ONLY_RE =
  /\b(UF trending|Gators offered|Florida offered|trending for florida|trending to florida)\b/i;

function stripEmojisHashtags(text) {
  return String(text || '')
    .split('\n')
    .map((line) =>
      line
        .replace(EMOJI_RE, '')
        .replace(HASHTAG_RE, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .join('\n')
    .trim();
}

function formatHtWt(htWt) {
  const s = String(htWt || '').trim();
  if (!s) return null;
  const dash = s.match(/(\d+)-(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
  if (dash) return `${dash[1]}'${dash[2]}", ${dash[3]}`;
  const quote = s.match(/(\d+)['′](\d+(?:\.\d+)?)["″]?\s*,?\s*(\d+)/);
  if (quote) return `${quote[1]}'${quote[2]}", ${quote[3]}`;
  return s.length <= 24 ? s : null;
}

function formatSchoolLabel(school) {
  const s = String(school || '').trim();
  return s || null;
}

function formatStarsLabel(stars) {
  const n = parseInt(stars, 10);
  if (!n || n < 1 || n > 5) return null;
  return `${n}★`;
}

function extractSentences(text) {
  return stripEmojisHashtags(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);
}

function shorten(s, max) {
  const t = stripEmojisHashtags(s);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1).replace(/\s+\S*$/, '');
  return `${cut}…`;
}

function buildRecruitingIdentity(ctx) {
  const lead = [];
  if (ctx.classYear) lead.push(String(ctx.classYear));
  if (ctx.starsLabel) lead.push(ctx.starsLabel);
  if (ctx.pos) lead.push(ctx.pos);
  lead.push(ctx.name);
  let line = lead.join(' ');
  const hw = formatHtWt(ctx.htWt);
  const school = formatSchoolLabel(ctx.school);
  if (hw || school) {
    const inner = [hw, school].filter(Boolean).join(' — ');
    line += ` (${inner})`;
  }
  if (ctx.natlRank > 0) {
    line += ` · On3 #${ctx.natlRank}`;
  }
  return line;
}

function buildPortalIdentity(ctx, portalStatus = 'Portal') {
  const status = String(portalStatus || 'Portal').trim();
  const lead = [status];
  if (ctx.pos) lead.push(ctx.pos);
  lead.push(ctx.name);
  let line = lead.join(' ');
  const hw = formatHtWt(ctx.htWt);
  const school = formatSchoolLabel(ctx.formerSchool || ctx.school);
  if (hw || school) {
    const inner = [hw, school].filter(Boolean).join(' — ');
    line += ` (${inner})`;
  }
  return line;
}

function buildTeamIdentity(ctx, teamContext) {
  const tc = String(teamContext || 'UF Update').trim();
  const lead = [];
  if (ctx.pos) lead.push(ctx.pos);
  lead.push(ctx.name);
  return `${lead.join(' ')} — ${tc}`;
}

function detectTeamContext(beatText) {
  const t = String(beatText || '').toLowerCase();
  if (/uniform|jersey|alternate|throwback|helmet combo/.test(t)) return 'Uniform Update';
  if (/hired|promoted|resigned|fired|named (?:as )?(?:coordinator|coach)|staff (?:update|change|addition)/.test(t)) {
    return 'Staff Update';
  }
  if (/schedule (?:update|change|release)|tv network|sec network|espn|abc|cbs|peacock/.test(t)) {
    return 'Schedule Update';
  }
  if (/kickoff|kick-off|start time|game time|tip(?:s)? off/.test(t)) return 'Kickoff Update';
  if (/fall camp|spring practice|practice report|spring game/.test(t)) return 'Fall Camp Update';
  if (/injur(?:y)? report|ruled out|game-time decision/.test(t)) return 'Injury Update';
  if (/depth chart|starter|rotation|two-deep/.test(t)) return 'Depth Chart Update';
  if (/roster (?:update|move)|walk-on|scholarship/.test(t)) return 'Roster Update';
  if (/game week|vs\.|matchup|pregame/.test(t)) return 'Game Week Update';
  return 'UF Update';
}

function teamEventLabel(teamEventType) {
  const labels = {
    kickoff: 'Kickoff Update',
    schedule: 'Schedule Update',
    uniform: 'Uniform Update',
    staff: 'Staff Update',
    depth_chart: 'Depth Chart Update',
    roster: 'Roster Update',
    game_week: 'Game Week Update',
    camp: 'Camp Update',
    injury: 'Injury Report',
    general: 'UF Update'
  };
  return labels[String(teamEventType || '').toLowerCase()] || labels.general;
}

function classifyBeatSentences(beatText) {
  const context = [];
  const insider = [];
  for (const sentence of extractSentences(beatText)) {
    if (HEADLINE_ONLY_RE.test(sentence)) continue;
    if (INSIDER_SIGNAL_RE.test(sentence)) {
      insider.push(sentence);
    } else if (FACTUAL_SIGNAL_RE.test(sentence)) {
      context.push(sentence);
    }
  }
  return { context, insider };
}

function contextFromNewsEvent(newsEvent, sourceLabel) {
  const event = String(newsEvent || '').trim().replace(/\.$/, '');
  const src = String(sourceLabel || '').trim();
  if (!event) return null;

  const lower = event.toLowerCase();
  if (/^committed to florida$/i.test(event)) {
    return src ? `Committed to Florida per ${src}.` : 'Committed to Florida.';
  }
  if (/^flipped to florida$/i.test(event)) {
    return src ? `Flipped to Florida per ${src}.` : 'Flipped to Florida.';
  }
  if (/portal.*uf target/i.test(event)) {
    return src
      ? `Entered the transfer portal; Florida is among the programs tracking per ${src}.`
      : 'Entered the transfer portal; Florida is among the programs tracking.';
  }
  if (/entered the transfer portal$/i.test(event)) {
    return src ? `Entered the transfer portal per ${src}.` : 'Entered the transfer portal.';
  }
  if (/picked up.*prediction|futurecast|rpm/i.test(event)) {
    return src ? `${event.charAt(0).toUpperCase()}${event.slice(1)} per ${src}.` : `${event.charAt(0).toUpperCase()}${event.slice(1)}.`;
  }
  if (/scheduled an ov to florida/i.test(event)) {
    return src ? `Scheduled an official visit to Florida per ${src}.` : 'Scheduled an official visit to Florida.';
  }
  if (/scheduled a visit to gainesville/i.test(event)) {
    return src ? `Scheduled a visit to Gainesville per ${src}.` : 'Scheduled a visit to Gainesville.';
  }
  if (/cancelled his ov/i.test(event)) {
    return src ? `Cancelled his official visit to Florida per ${src}.` : 'Cancelled his official visit to Florida.';
  }
  if (/received an offer from uf/i.test(event)) {
    return src ? `Received an offer from Florida per ${src}.` : 'Received an offer from Florida.';
  }
  if (/decommitted/i.test(event)) {
    return src ? `${event.charAt(0).toUpperCase()}${event.slice(1)} per ${src}.` : `${event.charAt(0).toUpperCase()}${event.slice(1)}.`;
  }
  if (/moved up on florida/i.test(event)) {
    return null;
  }
  if (src && !lower.includes(' per ')) {
    return `${event.charAt(0).toUpperCase()}${event.slice(1)} per ${src}.`;
  }
  return `${event.charAt(0).toUpperCase()}${event.slice(1)}.`;
}

function insiderFromIntel(intel) {
  if (!intel) return null;
  const detail = stripEmojisHashtags(intel.detail || intel.status || '');
  if (detail.length >= 20 && INSIDER_SIGNAL_RE.test(detail)) return shorten(detail, 140);
  if (intel.eventType === 'prediction' || intel.eventType === 'rivals_futurecast') {
    return null;
  }
  if (intel.analystName && detail.length >= 15) {
    return shorten(`${intel.analystName}: ${detail}`, 140);
  }
  return null;
}

function insiderFromScouting(entry) {
  if (!entry?.scoutingSummary) return null;
  const analyst = entry.analystName || 'Verified analyst';
  const first = extractSentences(entry.scoutingSummary)[0];
  if (!first || first.length < 20) return null;
  return shorten(`${analyst}: ${first}`, 140);
}

function insiderFromBreakdown(breakdown) {
  if (!breakdown) return null;
  const note =
    breakdown.staffNotes ||
    breakdown.recruitingStory ||
    (breakdown.strengths && breakdown.strengths[0]) ||
    breakdown.projection ||
    null;
  if (!note) return null;
  const writer = breakdown.sources?.[0]?.writer;
  const text = stripEmojisHashtags(note);
  if (text.length < 20) return null;
  return writer ? shorten(`${writer}: ${text}`, 140) : shorten(text, 140);
}

function verifiedRankInsider(ctx) {
  if (!ctx?.natlRank || ctx.natlRank <= 0) return null;
  return `On3 ranks him No. ${ctx.natlRank} nationally.`;
}

function composeInsiderReport({ identity, context, insider }) {
  const blocks = [identity, context, insider].map((b) => stripEmojisHashtags(b)).filter(Boolean);
  if (blocks.length < 2) return null;
  return blocks.join('\n');
}

function enforceTweetLimit(text, max = 280) {
  let t = stripEmojisHashtags(text);
  if (t.length <= max) return t;
  const lines = t.split('\n');
  if (lines.length <= 1) return shorten(t, max);
  const identity = lines[0];
  let context = lines[1] || '';
  let insider = lines.slice(2).join(' ') || '';
  const overhead = identity.length + 2;
  const budget = max - overhead;
  if (context.length + insider.length + 1 > budget) {
    if (insider) insider = shorten(insider, Math.max(40, Math.floor(budget * 0.45)));
    context = shorten(context, Math.max(40, budget - insider.length - 1));
  }
  return composeInsiderReport({ identity, context, insider });
}

function hasTemplateStructure(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length >= 3;
}

function isHeadlineOnlyPost(text) {
  const t = stripEmojisHashtags(text);
  if (HEADLINE_ONLY_RE.test(t)) return true;
  if (!t.includes('\n') && t.length < 100 && !/\(\d'/.test(t)) return true;
  return false;
}

module.exports = {
  stripEmojisHashtags,
  formatHtWt,
  formatStarsLabel,
  extractSentences,
  buildRecruitingIdentity,
  buildPortalIdentity,
  buildTeamIdentity,
  detectTeamContext,
  teamEventLabel,
  classifyBeatSentences,
  contextFromNewsEvent,
  insiderFromIntel,
  insiderFromScouting,
  insiderFromBreakdown,
  verifiedRankInsider,
  composeInsiderReport,
  enforceTweetLimit,
  hasTemplateStructure,
  isHeadlineOnlyPost,
  INSIDER_SIGNAL_RE,
  FACTUAL_SIGNAL_RE,
  HEADLINE_ONLY_RE
};
