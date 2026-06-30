/**
 * Multi-Source Elite Autoposter — caption synthesis.
 * Short, specific, insider tone. No generic fallback closures.
 */
const template = require('./x-autoposter-template');
const researchEngine = require('./x-autoposter-elite-research');
const eliteLog = require('./x-autoposter-elite-log');
const playerContext = require('./x-autoposter-player-context');
const quoteRewriter = require('./x-autoposter-recruiting-quote-rewriter');

const GENERIC_INSIDER_RE = /^per .+ report\.?$/i;
const GENERIC_CLOSURE_RE = /full details via the original report/i;

function eliteFirstName(name) {
  return String(name || '').split(/\s+/)[0] || 'the prospect';
}

/** Original angles from GV data (visits, RPM, scouting) — not beat paraphrase. */
function pickBestEliteAngle(research, beatText) {
  if (!research?.playerName) return null;
  const angles = [];
  const fn = eliteFirstName(research.playerName);

  const visits = (research.intelRows || []).filter((r) => /visit/i.test(String(r.eventType || '')));
  if (visits.length >= 2) {
    angles.push({
      context: `${fn} has ${visits.length} Florida trips logged in recent weeks.`,
      insider: visits.some((r) => /official/i.test(String(r.eventType || '')))
        ? 'Staff is treating the next OV as a decision checkpoint, not a courtesy visit.'
        : 'Repeat Gainesville time is building real momentum behind the scenes.'
    });
  } else if (research.timing?.visitWindow) {
    angles.push({
      context: `${fn} has a Gainesville window on the books (${research.timing.visitWindow}).`,
      insider: 'Position coaches have been active on this one ahead of the trip.'
    });
  }

  const schools = (research.topSchools || []).filter((s) => !/florida|gators/i.test(String(s || '')));
  const pred = research.predictions?.[0];
  const ufPct = pred?.confidencePct || pred?.ufRpmPct || research.player?.ufRpmPct;
  if (schools.length && ufPct != null) {
    angles.push({
      context: `Florida sits at ${Math.round(ufPct)}% in the model with ${schools.slice(0, 2).join(' and ')} still in the mix.`,
      insider: `The gap is closable if UF wins the next campus sequence with ${fn}.`
    });
  } else if (schools.length) {
    angles.push({
      context: `${schools[0]} still shares the lead cluster, but UF is pushing for separation.`,
      insider: `Staff contact has picked up as ${fn} narrows his list.`
    });
  }

  const heat = (research.heatSignals || []).find((h) =>
    /staff_momentum|uf_leads|prediction|crystal_ball/i.test(String(h.trigger || ''))
  );
  if (heat) {
    angles.push({
      context: `Board momentum shifted on ${research.playerName} after the latest analyst input.`,
      insider: 'Florida is trending up in the insider model, not just holding steady.'
    });
  }

  if (research.scouting?.scoutingSummary) {
    const line = template.extractSentences(template.stripEmojisHashtags(research.scouting.scoutingSummary))[0];
    if (line && line.length >= 24) {
      const analyst = research.scouting.analystName || 'War Room';
      angles.push({
        context: `${research.playerName} profiles as a scheme fit in this cycle.`,
        insider: `${analyst}: ${line.slice(0, 120)}.`
      });
    }
  }

  if (research.breakdown) {
    const note =
      research.breakdown.staffNotes ||
      research.breakdown.recruitingStory ||
      (research.breakdown.strengths && research.breakdown.strengths[0]);
    if (note && String(note).length >= 20) {
      const writer = research.breakdown.sources?.[0]?.writer || 'Verified analyst';
      angles.push({
        context: `Board intel on ${research.playerName} points to a priority fit.`,
        insider: `${writer}: ${template.stripEmojisHashtags(String(note)).slice(0, 120)}.`
      });
    }
  }

  if (research.player?.natlRank && research.player?.classYear) {
    angles.push({
      context: `On3 has him at No. ${research.player.natlRank} nationally in the ${research.player.classYear} class.`,
      insider: `UF needs ${String(research.player.pos || 'position').toUpperCase()} volume in that cycle — staff is not letting this one drift.`
    });
  }

  if (!angles.length) return null;

  const src = String(beatText || research.combinedText || '').toLowerCase();
  let best = angles[0];
  let bestScore = -1;
  for (const a of angles) {
    const combined = `${a.context} ${a.insider}`.toLowerCase();
    const words = combined.split(/\s+/);
    let overlap = 0;
    if (src) {
      for (const w of words) {
        if (w.length > 4 && src.includes(w)) overlap += 1;
      }
    }
    const score = words.length - overlap * 4;
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}

function pickBestFactualSentence(research) {
  if (quoteRewriter.isRewriterEnabled() && research?.combinedText) {
    const rewritten = quoteRewriter.rewriteBeatUpdate({
      beatText: research.combinedText,
      ctx: research.player ? playerContext.formatPlayerContext(research.player) : null,
      intel: research.intel,
      research,
      eventType: research.eventType,
      newsEvent: research.explicitNewsEvent,
      sourceLabel: research.primarySource,
      postKind: 'recruiting',
      sport: 'football',
      rewriteMetrics: research.rewriteMetrics || null
    });
    if (rewritten.ok && rewritten.contextLine) {
      return rewritten.contextLine;
    }
  }

  if (quoteRewriter.isRewriterEnabled()) {
    return buildEventSpecificContext(research);
  }

  const classified = template.classifyBeatSentences(research.combinedText);
  if (classified.context[0] && classified.context[0].length >= 28) return classified.context[0];
  if (classified.insider[0] && classified.insider[0].length >= 28 && !GENERIC_INSIDER_RE.test(classified.insider[0])) {
    return classified.insider[0];
  }
  const sentences = template.extractSentences(research.combinedText);
  const factual = sentences.find(
    (s) =>
      s.length >= 32 &&
      !template.HEADLINE_ONLY_RE.test(s) &&
      (template.FACTUAL_SIGNAL_RE.test(s) || template.INSIDER_SIGNAL_RE.test(s)) &&
      !GENERIC_CLOSURE_RE.test(s)
  );
  if (factual) return factual;

  for (const row of research.intelRows) {
    const d = template.stripEmojisHashtags(row.detail || '');
    if (d.length >= 28 && !/trending for florida only/i.test(d)) return d;
  }
  return null;
}

function buildEventSpecificContext(research) {
  const name = research.playerName || 'Target';
  const pos = research.player?.pos || research.intel?.pos || '';
  const schools = research.topSchools.filter((s) => !/florida|gators/i.test(s)).slice(0, 3);
  const schoolPhrase = schools.length ? ` with ${schools.join(', ')} also in the mix` : '';
  const visit = research.timing?.visitWindow;
  const pred = research.predictions[0];
  const conf = pred?.confidencePct || pred?.ufRpmPct;

  switch (research.eventType) {
    case 'commit':
      return `Florida lands ${name}${pos ? ` (${pos})` : ''} — staff closed out a priority target in the ${research.player?.classYear || '2026'} cycle.`;
    case 'flip':
      return `${name} flips to Florida${schoolPhrase ? ` after serious looks from ${schools[0]}` : ''}.`;
    case 'decommit':
      return `${name} is back on the market — UF is expected to stay engaged${schoolPhrase}.`;
    case 'official_visit':
      return `${name} sets an official visit to The Swamp${visit ? ` (${visit})` : ''}${schoolPhrase}.`;
    case 'unofficial_visit':
      return `${name} plans a Gainesville visit${visit ? ` ${visit}` : ''} as Florida pushes in the ${research.player?.classYear || '2026'} class.`;
    case 'visit_cancelled': {
      const cancelled = research.intelRows.find((r) => r.cancelledSchool || r.nextVisitSchool);
      const next = cancelled?.nextVisitSchool;
      return next
        ? `${name} cancels the Florida OV and pivots to ${next} this weekend.`
        : `${name} drops the Florida official visit — timing shift to watch.`;
    }
    case 'offer':
      return `Florida extends an offer to ${name}${pos ? ` (${pos})` : ''}${research.player?.natlRank ? ` · On3 #${research.player.natlRank}` : ''}.`;
    case 'prediction':
    case 'rivals_futurecast':
      return conf
        ? `${name} now has a ${conf}% Florida FutureCast${pred?.source ? ` (${pred.source})` : ''}.`
        : `${name} picks up fresh Crystal Ball momentum toward Florida.`;
    case 'portal_in':
      return `${name} hits the portal — Florida is among the programs monitoring closely.`;
    case 'portal_out':
      return `${name} enters the transfer portal from ${research.player?.school || 'his program'}.`;
    case 'trending':
      return `${name} is trending up with Florida${research.ufPosition === 'staff priority' ? ' — staff has him on the short list' : ''}.`;
    case 'flip_risk':
      return `${name} remains committed elsewhere but Florida is a flip-risk watch.`;
    case 'staff_push':
      return `UF staff is pushing hard for ${name}${schoolPhrase}.`;
    default:
      return null;
  }
}

function buildEliteInsiderLine(research, contextLine) {
  if (quoteRewriter.isRewriterEnabled() && research?.combinedText) {
    const rewritten = quoteRewriter.rewriteBeatUpdate({
      beatText: research.combinedText,
      ctx: research.player ? playerContext.formatPlayerContext(research.player) : null,
      intel: research.intel,
      research,
      eventType: research.eventType,
      newsEvent: research.explicitNewsEvent,
      sourceLabel: research.primarySource,
      postKind: 'recruiting',
      sport: 'football',
      rewriteMetrics: research.rewriteMetrics || null
    });
    if (rewritten.ok && rewritten.insiderLine) {
      const insider = quoteRewriter.sanitizeRewrittenLine(rewritten.insiderLine, research.combinedText, 140);
      if (insider) return insider;
    }
  }

  const classified = template.classifyBeatSentences(research.combinedText);
  const contextNorm = template.stripEmojisHashtags(contextLine || '').toLowerCase();

  if (!quoteRewriter.isRewriterEnabled()) {
    for (const s of classified.insider) {
      const norm = template.stripEmojisHashtags(s).toLowerCase();
      if (norm !== contextNorm && s.length >= 24 && !GENERIC_INSIDER_RE.test(s)) return s;
    }
  }

  if (research.scouting?.scoutingSummary) {
    const first = template.extractSentences(research.scouting.scoutingSummary)[0];
    if (first && first.length >= 20) {
      const analyst = research.scouting.analystName || 'Verified analyst';
      return `${analyst}: ${first}`;
    }
  }

  if (research.breakdown) {
    const note =
      research.breakdown.staffNotes ||
      research.breakdown.recruitingStory ||
      (research.breakdown.strengths && research.breakdown.strengths[0]);
    if (note && String(note).length >= 20) {
      const writer = research.breakdown.sources?.[0]?.writer || 'War Room';
      return `${writer}: ${template.stripEmojisHashtags(note).slice(0, 120)}`;
    }
  }

  for (const row of research.intelRows) {
    const d = template.stripEmojisHashtags(row.detail || '');
    if (d.length >= 20 && template.INSIDER_SIGNAL_RE.test(d) && d.toLowerCase() !== contextNorm) {
      return row.analystName ? `${row.analystName}: ${d}` : d;
    }
  }

  if (research.predictions.length) {
    const p = research.predictions[0];
    const pct = p.confidencePct || p.ufRpmPct;
    if (pct) {
      return `${p.analystName || p.source || 'Analyst'} has Florida at ${pct}% in the Crystal Ball mix.`;
    }
  }

  if (research.player?.natlRank && research.eventType !== 'prediction') {
    return `On3 has him at No. ${research.player.natlRank} nationally — UF fits the timeline.`;
  }

  if (research.ufPosition === 'staff priority') {
    return 'Sumrall staff has made this one a priority on the board.';
  }
  if (research.ufPosition === 'leading') {
    return 'Florida sits in the lead group with momentum building.';
  }
  if (research.ufPosition === 'hosting OV') {
    return 'Official visit window should clarify where UF stands.';
  }

  const beatInsider = research.beatMentions.find((b) => template.INSIDER_SIGNAL_RE.test(b.text));
  if (beatInsider && !quoteRewriter.isRewriterEnabled()) return beatInsider.text.slice(0, 140);

  const hayes = research.hayesMentions?.[0];
  if (hayes?.text && !quoteRewriter.isRewriterEnabled()) return hayes.text.slice(0, 140);

  return 'Florida is actively tracking — more clarity expected soon.';
}

function formatAttributionTag(sourceLabel) {
  const src = String(sourceLabel || '').trim();
  if (!src || /^on3$/i.test(src)) return null;
  if (/inside the gators/i.test(src)) return 'via ITG';
  if (/247/i.test(src)) return 'via 247';
  if (/rivals/i.test(src)) return 'via Rivals';
  if (/hayes fawcett/i.test(src)) return 'via Hayes Fawcett';
  return `via ${src.length > 22 ? src.split(' ')[0] : src}`;
}

function trimLine(text, max = 140) {
  let t = template.stripEmojisHashtags(text);
  if (t.length <= max) return t.endsWith('.') ? t : `${t.replace(/[.!?]+$/, '')}.`;
  const sentences = template.extractSentences(t);
  let out = '';
  for (const s of sentences) {
    const candidate = out ? `${out} ${s}` : s;
    if (candidate.length <= max) out = candidate;
    else break;
  }
  if (out) return out.endsWith('.') ? out : `${out}.`;
  t = t.slice(0, max).replace(/\s+\S*$/, '').trim();
  return t.endsWith('.') ? t : `${t}.`;
}

async function buildElitePlayerPost(input = {}) {
  const dataLayer = require('./x-autoposter-data-layer');
  const intelInput = {
    playerName: input.playerName || input.intel?.playerName,
    playerSlug: input.playerSlug || input.intel?.playerSlug,
    beatText: input.beatText || input.intel?.detail || null,
    detail: input.beatText || input.intel?.detail || null,
    timestamp:
      require('./x-autoposter-data-layer').resolveIntelTimestamp(input.intel || input) ||
      input.intel?.timestamp ||
      input.intel?.sourceEventCreatedAt ||
      input.intel?.publishedAt ||
      input.intel?.created_at ||
      input.intel?.createdAt ||
      input.publishedAt ||
      null,
    eventType: input.intel?.eventType,
    source: input.intel?.source || input.source,
    sourceHandle: input.intel?.sourceHandle || null,
    directlyInvolvesUF: input.intel?.directlyInvolvesUF
  };

  const playerData = await dataLayer.fetchAutoposterPlayerData(intelInput);
  if (!playerData.ok) {
    eliteLog.logEliteCaption({
      skipped: true,
      skipReason: playerData.skipReason,
      playerName: intelInput.playerName,
      eventType: intelInput.eventType,
      reason: playerData.reason
    });
    return { ok: false, skipped: true, reason: playerData.skipReason, dataLayer: playerData };
  }

  const research = await researchEngine.researchUpdate({
    ...input,
    playerName: playerData.data.name,
    playerSlug: playerData.data.playerSlug,
    patch: null,
    rewriteMetrics: playerData.rewriteMetrics || null
  });

  if (!research.hasUsableSignal) {
    eliteLog.logEliteCaption({
      skipped: true,
      skipReason: 'no_usable_signal',
      playerName: playerData.data.name,
      eventType: playerData.data.situation,
      sourcesUsed: research.sourcesUsed,
      context: research
    });
    return { ok: false, skipped: true, reason: 'no_usable_signal', research };
  }

  const ctx = playerData.ctx;

  const kind = input.postKind || playerContext.resolvePostKind(ctx, {
    newsEvent: input.newsEvent,
    intel: input.intel,
    beatText: input.beatText
  });

  let identity;
  if (kind === 'portal') {
    identity = template.buildPortalIdentity(ctx, input.portalStatus || 'Portal');
  } else if (kind === 'team') {
    identity = template.buildTeamIdentity(ctx, input.teamContext || template.detectTeamContext(input.beatText));
  } else if (ctx.hasFullIdentity || ctx.hasMinimumContext) {
    identity = template.buildRecruitingIdentity(ctx);
  } else {
    identity = `${research.playerName}${research.player?.pos ? ` · ${research.player.pos}` : ''}${research.player?.classYear ? ` · '${String(research.player.classYear).slice(-2)}` : ''}`;
  }

  let contextLine = null;
  let insiderLine = null;

  const digestAngle = pickBestEliteAngle(research, input.beatText);
  if (digestAngle) {
    contextLine = trimLine(digestAngle.context, 160);
    insiderLine = trimLine(digestAngle.insider, 140);
  }

  if (!contextLine) {
    contextLine =
      pickBestFactualSentence(research) ||
      buildEventSpecificContext(research) ||
      (quoteRewriter.isRewriterEnabled()
        ? buildEventSpecificContext(research)
        : trimLine(research.article?.headline || research.combinedText.slice(0, 120), 160));
  }

  if (!contextLine || GENERIC_CLOSURE_RE.test(contextLine)) {
    contextLine =
      buildEventSpecificContext(research) ||
      (quoteRewriter.isRewriterEnabled() ? null : trimLine(research.combinedText.slice(0, 100), 160));
  }
  if (!contextLine) {
    return { ok: false, skipped: true, reason: 'no_usable_signal', research };
  }

  contextLine = trimLine(contextLine, 160);
  if (!insiderLine) {
    insiderLine = trimLine(buildEliteInsiderLine(research, contextLine), 140);
  } else {
    insiderLine = trimLine(insiderLine, 140);
  }

  if (quoteRewriter.isRewriterEnabled() && input.beatText) {
    const combined = `${contextLine} ${insiderLine}`;
    if (quoteRewriter.exceedsOverlap(combined, input.beatText)) {
      const retry = quoteRewriter.rewriteBeatUpdate({
        beatText: input.beatText,
        ctx,
        intel: input.intel,
        research,
        eventType: research.eventType,
        newsEvent: input.newsEvent,
        sourceLabel: research.primarySource,
        postKind: kind,
        sport: 'football',
        rewriteMetrics: playerData.rewriteMetrics || research.rewriteMetrics || null
      });
      if (retry.ok) {
        contextLine = trimLine(retry.contextLine, 160);
        insiderLine = trimLine(retry.insiderLine, 140);
      } else {
        eliteLog.logEliteCaption({
          pass: false,
          skipReason: 'verbatim_overlap',
          playerName: research.playerName,
          eventType: research.eventType,
          sourcesUsed: research.sourcesUsed,
          overlap: retry.overlap
        });
        return { ok: false, skipped: true, reason: 'verbatim_overlap', research };
      }
    }
  }

  const attr = formatAttributionTag(research.primarySource);
  if (
    attr &&
    !insiderLine.toLowerCase().includes(attr.toLowerCase()) &&
    !digestAngle &&
    !quoteRewriter.isRewriterEnabled()
  ) {
    insiderLine = `${insiderLine.replace(/\.$/, '')} · ${attr}.`;
  }

  const copyMeta = {
    postKind: kind,
    triggerType: research.eventType,
    beatText: input.beatText,
    eliteMode: true
  };

  const confidenceMeterMod = require('./x-autoposter-confidence-meter');
  const heatMeterMod = require('./x-autoposter-heat-meter');
  const meterInput = {
    identity: playerData.identity,
    ctx,
    situation: playerData.data.situation,
    beatText: input.beatText,
    intel: input.intel,
    autoposterData: playerData.data,
    research,
    newsEvent: input.newsEvent,
    playerSlug: playerData.data.playerSlug
  };
  const heatMeter = heatMeterMod.isEnabled() ? heatMeterMod.computeHeatMeter(meterInput) : null;
  const confidenceMeter = confidenceMeterMod.isEnabled()
    ? confidenceMeterMod.computeConfidenceMeter(meterInput)
    : null;

  const raw = template.composeInsiderReportWithMeters({
    identity,
    context: contextLine,
    insider: insiderLine,
    heatMeter,
    confidenceMeter
  });
  if (!raw) {
    eliteLog.logEliteCaption({
      pass: false,
      skipReason: 'compose_failed',
      playerName: research.playerName,
      eventType: research.eventType,
      sourcesUsed: research.sourcesUsed,
      context: { identity, contextLine, insiderLine }
    });
    return { ok: false, skipped: true, reason: 'compose_failed', research };
  }

  const text = template.enforceTweetLimit(raw, 280, copyMeta);
  if (!text || GENERIC_CLOSURE_RE.test(text)) {
    eliteLog.logEliteCaption({
      pass: false,
      skipReason: 'truncation_generic',
      playerName: research.playerName,
      eventType: research.eventType,
      sourcesUsed: research.sourcesUsed,
      finalCaption: text
    });
    return { ok: false, skipped: true, reason: 'truncation_generic', research };
  }

  eliteLog.logEliteCaption({
    pass: true,
    playerName: research.playerName,
    playerSlug: research.playerSlug,
    eventType: research.eventType,
    eventTypeConfidence: research.eventTypeConfidence,
    ufPosition: research.ufPosition,
    sourcesUsed: research.sourcesUsed,
    context: {
      topSchools: research.topSchools,
      timing: research.timing,
      eventTypeSource: research.eventTypeSource
    },
    templateBlocks: {
      identity,
      context: contextLine,
      insider: insiderLine,
      heatHeader: heatMeter?.header || null,
      heatExplanation: heatMeter?.explanation || null,
      confidenceHeader: confidenceMeter?.header || null,
      confidenceExplanation: confidenceMeter?.explanation || null
    },
    finalCaption: text
  });

  return {
    ok: true,
    text,
    playerName: ctx.name || research.playerName,
    playerSlug: research.playerSlug || playerData.data.playerSlug || null,
    context: ctx,
    postKind: kind,
    autoposterData: {
      ...playerData.data,
      heatState: heatMeter?.state ?? null,
      heatTotal: heatMeter?.total ?? null,
      confidenceScore: confidenceMeter?.score ?? null,
      confidenceLabel: confidenceMeter?.label ?? null
    },
    templateBlocks: {
      identity,
      context: contextLine,
      insider: insiderLine,
      heatHeader: heatMeter?.header || null,
      heatExplanation: heatMeter?.explanation || null,
      confidenceHeader: confidenceMeter?.header || null,
      confidenceExplanation: confidenceMeter?.explanation || null
    },
    validationMeta: {
      eliteMode: true,
      situation: playerData.data.situation,
      autoposterData: playerData.data,
      heatMeter,
      confidenceMeter,
      identitySource: playerData.data.identitySource,
      ufStatus: playerData.data.ufStatus,
      contextHint: playerData.data.context,
      eventType: research.eventType,
      ufPosition: research.ufPosition,
      sourcesUsed: research.sourcesUsed.map((s) => s.label),
      eliteCompose: true,
      eliteDigest: !!digestAngle,
      beatText: input.beatText || null,
      intelDetail: input.intel?.detail || null,
      rewrittenFromQuote: true,
      quoteOverlapRatio: quoteRewriter.sourceOverlapRatio(`${contextLine} ${insiderLine}`, input.beatText || '')
    },
    research
  };
}

function buildProgramImpactLine(research) {
  const name = research.playerName || 'This target';
  const yr = research.player?.classYear || '2026';
  const pos = research.player?.pos || research.intel?.pos || '';

  switch (research.eventType) {
    case 'commit':
      return `Program impact: Florida secures a ${yr}-cycle ${pos || 'priority'} — board depth improves immediately.`;
    case 'flip':
      return `Program impact: Flip win for Sumrall's staff — momentum shift in the ${yr} class.`;
    case 'decommit':
      return `Program impact: Opens a board spot — UF expected to re-engage quickly.`;
    case 'official_visit':
      return `Program impact: OV window is a decision-point moment for Napier's ${yr} board.`;
    case 'unofficial_visit':
      return `Program impact: Campus touchpoint as Florida pushes in the ${yr} cycle.`;
    case 'visit_cancelled':
      return `Program impact: Visit timing shift — UF's position in the race needs monitoring.`;
    case 'offer':
      return `Program impact: Offer extends UF's footprint with ${name} in the ${yr} class.`;
    case 'prediction':
    case 'rivals_futurecast':
      return `Program impact: Crystal Ball movement signals rising UF leverage with ${name}.`;
    case 'portal_in':
      return `Program impact: Portal entry — Florida among programs positioned to move.`;
    case 'portal_out':
      return `Program impact: Roster math changes — depth chart ripple effect possible.`;
    case 'trending':
      return `Program impact: Momentum building on Florida's ${yr} priority board.`;
    case 'flip_risk':
      return `Program impact: Flip-risk watch — UF remains a live option.`;
    case 'staff_push':
      return `Program impact: Staff priority signal — UF pushing hard on the trail.`;
    case 'program_news':
      return `Program impact: Infrastructure/staff move that shapes the Napier era trajectory.`;
    case 'team_event':
      return `Program impact: Roster/schedule intel that affects how Florida is positioned this season.`;
    default:
      return `Program impact: ${name} remains on Florida's radar in the ${yr} cycle.`;
  }
}

async function buildEliteQuoteRetweet(input = {}) {
  const sourceText = template.stripEmojisHashtags(input.sourcePost?.text || input.beatText || '');
  const built = await buildElitePlayerPost({
    ...input,
    beatText: sourceText || input.beatText,
    headline: sourceText.slice(0, 140),
    body: input.beatText || sourceText
  });

  if (!built?.ok || !built.text) return built;

  const programImpact = trimLine(buildProgramImpactLine(built.research || { eventType: input.eventType, playerName: input.playerName }), 140);

  let insiderLine = built.templateBlocks?.insider || '';
  if (programImpact && !insiderLine.toLowerCase().includes('program impact')) {
    insiderLine = programImpact;
  }

  const identity = built.templateBlocks?.identity || '';
  const contextLine = built.templateBlocks?.context || '';
  const copyMeta = { eliteMode: true, quoteRetweet: true, triggerType: input.eventType };

  const raw = template.composeInsiderReport({ identity, context: contextLine, insider: insiderLine });
  if (!raw) return { ok: false, skipped: true, reason: 'compose_failed', research: built.research };

  const text = template.enforceTweetLimit(raw, 280, copyMeta);
  if (!text || GENERIC_CLOSURE_RE.test(text)) {
    return { ok: false, skipped: true, reason: 'truncation_generic', research: built.research };
  }

  return {
    ...built,
    text,
    programImpact,
    templateBlocks: { identity, context: contextLine, insider: insiderLine },
    validationMeta: {
      ...(built.validationMeta || {}),
      quoteRetweet: true,
      clusterId: input.clusterId || null,
      duplicateCount: input.duplicateCount || 0,
      sourceTweetId: input.sourcePost ? require('./x-autoposter-event-cluster').extractTweetId(input.sourcePost) : null
    }
  };
}

function isEliteModeEnabled() {
  return process.env.X_AUTOPOST_ELITE_MODE !== 'false';
}

module.exports = {
  buildElitePlayerPost,
  buildEliteQuoteRetweet,
  buildProgramImpactLine,
  isEliteModeEnabled,
  pickBestFactualSentence,
  buildEventSpecificContext,
  buildEliteInsiderLine,
  formatAttributionTag,
  GENERIC_CLOSURE_RE,
  GENERIC_INSIDER_RE
};
