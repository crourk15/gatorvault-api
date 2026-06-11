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

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
const THREAD_REF_RE = /\bthread\b/i;
const COPY_FALLBACK_CLOSURE = 'Full details via the original report.';

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

function hasUrlOrThreadRef(text) {
  const t = String(text || '');
  URL_RE.lastIndex = 0;
  return URL_RE.test(t) || THREAD_REF_RE.test(t);
}

function extractUrls(text) {
  URL_RE.lastIndex = 0;
  return [
    ...new Set(
      (String(text || '').match(URL_RE) || []).map((u) => u.replace(/[.,;:!?)]+$/, ''))
    )
  ];
}

function normalizeUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 's'].forEach((p) =>
      u.searchParams.delete(p)
    );
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

function shortenUrlForDisplay(url) {
  const norm = normalizeUrl(url);
  if (!norm) return null;
  try {
    const u = new URL(norm);
    const host = u.hostname.replace(/^www\./i, '');
    if (host === 'x.com' || host === 'twitter.com') return 'x.com';
    if (host === 't.co') return norm;
    let path = u.pathname.replace(/\/$/, '');
    if (path.length > 24) {
      path = path.slice(0, 24).replace(/\/[^/]*$/, '') || path.slice(0, 24);
    }
    return path ? `${host}${path}` : host;
  } catch {
    return null;
  }
}

function sanitizeUrlsInText(text, { removeOnFailure = true } = {}) {
  const urls = extractUrls(text);
  if (!urls.length) {
    return { text: String(text || '').trim(), urls: [], urlLabels: [] };
  }
  let working = String(text || '');
  const urlLabels = [];
  for (const raw of urls) {
    const label = shortenUrlForDisplay(raw);
    if (label) {
      urlLabels.push(label);
      working = working.split(raw).join(label);
    } else if (removeOnFailure) {
      working = working.split(raw).join(' ');
    }
  }
  working = working
    .replace(/^INTEL:\s*/i, '')
    .replace(/\b(https?|htt|http)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { text: working, urls, urlLabels };
}

function endsCompleteSentence(s) {
  return /[.!?]["')\]]*\s*$/.test(String(s || '').trim());
}

function isIdentityLine(s) {
  const t = String(s || '').trim();
  if (!t) return false;
  if (/^Florida Gators —/.test(t)) return true;
  if (/^Portal /.test(t)) return true;
  if (/^[\d★]/.test(t)) return true;
  if (/ — UF Update$/.test(t)) return true;
  if (/^Florida .+\bcoach\b/i.test(t)) return true;
  return false;
}

function isUrlLine(s) {
  const t = String(s || '').trim();
  return /^https?:\/\//i.test(t) || /gatorvaultinsider\.com/i.test(t);
}

function isStatsContextLine(s) {
  const t = String(s || '').trim();
  return /\b(FutureCast|RPM|confidence)\b/i.test(t) || / · \d+%/.test(t);
}

function hasBrokenEnding(s) {
  const t = String(s || '').trim();
  if (!t) return true;
  if (isIdentityLine(t) || isUrlLine(t)) return false;
  if (isStatsContextLine(t)) return false;
  if (/%["')\]]*$/.test(t)) return false;
  if (/…|\.\.\.$/.test(t)) return true;
  if (/\b(https?|htt|http)$/i.test(t)) return true;
  if (/\d[\u2013\u2014-]\d*$/.test(t)) return true;
  if (!endsCompleteSentence(t)) return true;
  return false;
}

function isRecruitingDiscussionText(text) {
  const lower = String(text || '').toLowerCase();
  if (THREAD_REF_RE.test(text)) return true;
  return /still working|still chasing|weekend ahead|several targets|recruiting well|busy weekend|in the hunt|on the trail/i.test(
    lower
  );
}

function disableEllipsisForCopy(meta = {}) {
  const { triggerType, postKind, teamEventType, beatText, text } = meta;
  if (triggerType === 'program_news' || postKind === 'program_news') return true;
  if (triggerType === 'team_event' || postKind === 'team_event') return true;
  if (teamEventType === 'general') return true;
  if (postKind === 'recruiting_discussion') return true;
  if (beatText && isRecruitingDiscussionText(beatText)) return true;
  const combined = [text, beatText].filter(Boolean).join(' ');
  return hasUrlOrThreadRef(combined);
}

function ensureCompleteSentence(text, fallback = COPY_FALLBACK_CLOSURE, meta = {}) {
  const fb = meta.eliteMode ? '' : fallback;
  let t = sanitizeUrlsInText(text, { removeOnFailure: true }).text;
  t = stripEmojisHashtags(t).replace(/…+/g, '').replace(/\.{3,}/g, '').trim();
  if (!t) return fb || null;
  if (isIdentityLine(t)) return t;
  if (isUrlLine(t)) return t;

  const completeOnly = extractSentences(t).filter((s) => endsCompleteSentence(s) && !hasBrokenEnding(s));
  if (completeOnly.length) {
    const rebuilt = completeOnly.join(' ');
    if (endsCompleteSentence(rebuilt) && !hasBrokenEnding(rebuilt)) return rebuilt;
  }

  while (t.length > 0 && (hasBrokenEnding(t) || !endsCompleteSentence(t))) {
    const prev = t;
    t = t.replace(/\s+\S*$/, '').trim();
    t = t.replace(/[\u2013\u2014-]+$/, '').trim();
    if (t === prev) break;
  }

  if (!t || t.length < 12) return fb || (meta.eliteMode ? null : fallback);
  if (endsCompleteSentence(t) && !hasBrokenEnding(t)) return t;

  t = t.replace(/[,;:\u2013\u2014-]+$/, '').trim();
  if (!t) return fb || (meta.eliteMode ? null : fallback);
  if (meta.eliteMode) return `${t}.`;
  return `${t}. ${fallback}`;
}

function sanitizeCopyLine(text, maxLen, meta = {}) {
  const fallback = meta.eliteMode ? '' : COPY_FALLBACK_CLOSURE;
  const noEllipsis = disableEllipsisForCopy({ ...meta, text });
  let working = sanitizeUrlsInText(text, { removeOnFailure: true }).text;
  working = stripEmojisHashtags(working);
  if (!working) return fallback || (meta.eliteMode ? '' : COPY_FALLBACK_CLOSURE);

  if (working.length <= maxLen) {
    return ensureCompleteSentence(working, fallback, meta);
  }

  if (noEllipsis || hasUrlOrThreadRef(text)) {
    const sentences = extractSentences(working);
    let out = '';
    for (const sent of sentences) {
      const candidate = out ? `${out} ${sent}` : sent;
      if (candidate.length <= maxLen) out = candidate;
      else break;
    }
    if (out && out.length >= Math.min(40, Math.floor(maxLen * 0.25))) {
      return ensureCompleteSentence(out, fallback, meta);
    }
    const trimmed = working.slice(0, maxLen).replace(/\s+\S*$/, '').trim();
    return ensureCompleteSentence(trimmed, fallback, meta);
  }

  const trimmed = working.slice(0, maxLen).replace(/\s+\S*$/, '').trim();
  return ensureCompleteSentence(trimmed, fallback, meta);
}

function finalizeAutoposterCopy(text, meta = {}) {
  const fallback = meta.eliteMode ? '' : COPY_FALLBACK_CLOSURE;
  let t = sanitizeUrlsInText(text, { removeOnFailure: true }).text;
  t = stripEmojisHashtags(t);
  if (!t) return fallback || '';
  const lines = t
    .split('\n')
    .map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (idx === 0 && isIdentityLine(trimmed)) return trimmed;
      if (isUrlLine(trimmed)) return trimmed;
      return ensureCompleteSentence(trimmed, fallback, meta);
    })
    .filter(Boolean);
  t = lines.join('\n');
  if (isTruncatedCopy(t)) {
    t = lines
      .map((line, idx) =>
        idx === 0 && isIdentityLine(line)
          ? line
          : isUrlLine(line)
            ? line
            : isTruncatedCopy(line)
              ? ensureCompleteSentence(line, fallback, meta)
              : line
      )
      .join('\n');
  }
  return t;
}

function isTruncatedCopy(text) {
  const t = String(text || '');
  if (!t.trim()) return true;
  if (/…|\.\.\./.test(t)) return true;
  return t.split('\n').some((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (idx === 0 && isIdentityLine(trimmed)) return false;
    if (isUrlLine(trimmed)) return false;
    return hasBrokenEnding(trimmed);
  });
}

function shorten(s, max, meta = {}) {
  return sanitizeCopyLine(s, max, meta);
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

function programNewsLabel(programNewsType) {
  const labels = {
    stadium_facility: 'Stadium & Facility News',
    athletic_release: 'Athletic Department Release',
    nil_infrastructure: 'NIL Infrastructure Update',
    program_update: 'Program Update',
    sec_tv: 'SEC / TV Announcement',
    realignment: 'Conference Realignment',
    branding: 'Uniform & Branding',
    general: 'Program News'
  };
  return labels[String(programNewsType || '').toLowerCase()] || labels.general;
}

function inferProgramNewsEvent(beatText, programNewsType) {
  const t = String(beatText || '').replace(/\s+/g, ' ').trim();
  const type = String(programNewsType || '').toLowerCase();

  if (type === 'stadium_facility') {
    if (/\$[\d,.]+\s*(?:b(?:illion)?|m(?:illion)?)/i.test(t)) {
      const amt = t.match(/\$[\d,.]+\s*(?:b(?:illion)?|m(?:illion)?)/i)?.[0];
      if (/ben hill griffin|the swamp/i.test(t)) {
        return `${amt} Ben Hill Griffin Stadium renovation plans`;
      }
      if (/renovation/i.test(t)) return `${amt} stadium renovation plans`;
      return `${amt} facility capital project`;
    }
    if (/ben hill griffin|the swamp/i.test(t)) return 'Ben Hill Griffin Stadium renovation plans';
    if (/renovation/i.test(t)) return 'major stadium renovation plans';
    return 'major facility upgrades';
  }
  if (type === 'athletic_release') return 'an athletic department announcement';
  if (type === 'nil_infrastructure') return 'NIL infrastructure updates';
  if (type === 'program_update') return 'a major football program update';
  if (type === 'sec_tv') return 'SEC scheduling and TV updates';
  if (type === 'realignment') return 'conference realignment news';
  if (type === 'branding') return 'a uniform and branding reveal';

  const sentences = extractSentences(t);
  const factual = sentences.find((s) => s.length >= 30 && !HEADLINE_ONLY_RE.test(s));
  if (factual) {
    const trimmed = sanitizeCopyLine(factual, 90, { triggerType: 'program_news', postKind: 'program_news' });
    return trimmed.replace(/^Florida (?:has |is )?/i, '').replace(/\.$/, '') || 'a program-level update';
  }
  return programNewsLabel(type).toLowerCase();
}

function detectProgramNewsContext(beatText) {
  const t = String(beatText || '').toLowerCase();
  if (/ben hill griffin|the swamp|stadium|renovation|facilit/.test(t)) return 'Stadium & Facility News';
  if (/nil|collective|name,? image and likeness/.test(t)) return 'NIL Infrastructure Update';
  if (/realignment|sec expansion/.test(t)) return 'Conference Realignment';
  if (/uniform|jersey|branding|helmet reveal/.test(t)) return 'Uniform & Branding';
  if (/sec network|tv announcement|broadcast|flex schedule/.test(t)) return 'SEC / TV Announcement';
  if (/athletic department|florida athletics|uaa/.test(t)) return 'Athletic Department Release';
  return 'Program News';
}

function classifyBeatSentences(beatText) {
  const cleaned = sanitizeUrlsInText(beatText, { removeOnFailure: true }).text.replace(/^INTEL:\s*/i, '');
  const context = [];
  const insider = [];
  for (const sentence of extractSentences(cleaned)) {
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

function insiderFromIntel(intel, meta = {}) {
  if (!intel) return null;
  const detail = stripEmojisHashtags(intel.detail || intel.status || '');
  const lineMeta = { ...meta, beatText: detail, text: detail };
  if (detail.length >= 20 && INSIDER_SIGNAL_RE.test(detail)) return shorten(detail, 140, lineMeta);
  if (intel.eventType === 'prediction' || intel.eventType === 'rivals_futurecast') {
    return null;
  }
  if (intel.analystName && detail.length >= 15) {
    return shorten(`${intel.analystName}: ${detail}`, 140, lineMeta);
  }
  return null;
}

function insiderFromScouting(entry, meta = {}) {
  if (!entry?.scoutingSummary) return null;
  const analyst = entry.analystName || 'Verified analyst';
  const first = extractSentences(entry.scoutingSummary)[0];
  if (!first || first.length < 20) return null;
  return shorten(`${analyst}: ${first}`, 140, { ...meta, beatText: first, text: first });
}

function insiderFromBreakdown(breakdown, meta = {}) {
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
  return writer
    ? shorten(`${writer}: ${text}`, 140, { ...meta, beatText: text, text })
    : shorten(text, 140, { ...meta, beatText: text, text });
}

function verifiedRankInsider(ctx) {
  if (!ctx?.natlRank || ctx.natlRank <= 0) return null;
  return `On3 ranks him No. ${ctx.natlRank} nationally.`;
}

function composeInsiderReport({ identity, context, insider, heat = null, confidence = null }) {
  const blocks = [identity, context, insider].map((b) => stripEmojisHashtags(b)).filter(Boolean);
  if (heat?.header) blocks.push(String(heat.header).trim());
  if (heat?.explanation) blocks.push(stripEmojisHashtags(heat.explanation));
  if (confidence?.header) blocks.push(stripEmojisHashtags(confidence.header));
  if (confidence?.explanation) blocks.push(stripEmojisHashtags(confidence.explanation));
  if (blocks.length < 2) return null;
  return blocks.join('\n');
}

function composeInsiderReportWithMeters({ identity, context, insider, heatMeter = null, confidenceMeter = null }) {
  const heat = heatMeter ? { header: heatMeter.header, explanation: heatMeter.explanation } : null;
  const confidence = confidenceMeter
    ? { header: confidenceMeter.header, explanation: confidenceMeter.explanation }
    : null;
  return composeInsiderReport({ identity, context, insider, heat, confidence });
}

/** @deprecated use composeInsiderReportWithMeters */
function composeInsiderReportWithConfidence({ identity, context, insider, confidenceMeter }) {
  return composeInsiderReportWithMeters({ identity, context, insider, confidenceMeter });
}

function preserveMeterEmojis(original, composed) {
  let out = String(composed || '');
  const src = String(original || '');
  if (/Heat Meter:\s*RISING/i.test(src)) {
    out = out.replace(/Heat Meter:\s*RISING/i, 'Heat Meter: RISING \uD83D\uDD25');
  }
  if (/Heat Meter:\s*HOLDING/i.test(src)) {
    out = out.replace(/Heat Meter:\s*HOLDING/i, 'Heat Meter: HOLDING \u26AA');
  }
  if (/Heat Meter:\s*COOLING/i.test(src)) {
    out = out.replace(/Heat Meter:\s*COOLING/i, 'Heat Meter: COOLING \u2744\uFE0F');
  }
  return out;
}

function enforceTweetLimit(text, max = 280, meta = {}) {
  const original = String(text || '');
  let t = stripEmojisHashtags(original);
  if (t.length <= max) return preserveMeterEmojis(original, finalizeAutoposterCopy(t, meta));
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= 1) return finalizeAutoposterCopy(shorten(t, max, { ...meta, text: t }), meta);

  const heatIdx = lines.findIndex((l) => /^Heat Meter:/i.test(l));
  const confidenceIdx = lines.findIndex((l) => /^Confidence Meter:/i.test(l));
  const meterStart = [heatIdx, confidenceIdx].filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? lines.length;

  const identity = stripEmojisHashtags(lines[0]);
  const meterLines = lines.slice(meterStart);
  const middle = lines.slice(1, meterStart).map((l) => stripEmojisHashtags(l));
  let context = middle[0] || '';
  let insider = middle.slice(1).join(' ') || '';

  let heat = null;
  let confidence = null;
  for (let i = 0; i < meterLines.length; i += 1) {
    const line = meterLines[i];
    if (/^Heat Meter:/i.test(line)) {
      heat = { header: line, explanation: stripEmojisHashtags(meterLines[i + 1] || '') };
      i += 1;
    } else if (/^Confidence Meter:/i.test(line)) {
      confidence = { header: stripEmojisHashtags(line), explanation: stripEmojisHashtags(meterLines[i + 1] || '') };
      i += 1;
    }
  }

  const reserved =
    identity.length +
    2 +
    (heat ? heat.header.length + 2 + (heat.explanation?.length || 0) + 2 : 0) +
    (confidence ? confidence.header.length + 2 + (confidence.explanation?.length || 0) + 2 : 0);
  const budget = max - reserved;
  const lineMeta = { ...meta, text: t, eliteMode: true };
  if (context.length + insider.length + 1 > budget) {
    if (insider) insider = shorten(insider, Math.max(32, Math.floor(budget * 0.45)), lineMeta);
    context = shorten(context, Math.max(32, budget - insider.length - 1), lineMeta);
  }

  return preserveMeterEmojis(
    original,
    finalizeAutoposterCopy(composeInsiderReport({ identity, context, insider, heat, confidence }), meta)
  );
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
  programNewsLabel,
  inferProgramNewsEvent,
  detectProgramNewsContext,
  classifyBeatSentences,
  contextFromNewsEvent,
  insiderFromIntel,
  insiderFromScouting,
  insiderFromBreakdown,
  verifiedRankInsider,
  composeInsiderReport,
  composeInsiderReportWithMeters,
  composeInsiderReportWithConfidence,
  enforceTweetLimit,
  finalizeAutoposterCopy,
  sanitizeCopyLine,
  ensureCompleteSentence,
  sanitizeUrlsInText,
  extractUrls,
  normalizeUrl,
  shortenUrlForDisplay,
  hasUrlOrThreadRef,
  hasBrokenEnding,
  isTruncatedCopy,
  disableEllipsisForCopy,
  isIdentityLine,
  endsCompleteSentence,
  COPY_FALLBACK_CLOSURE,
  hasTemplateStructure,
  isHeadlineOnlyPost,
  INSIDER_SIGNAL_RE,
  FACTUAL_SIGNAL_RE,
  HEADLINE_ONLY_RE
};
