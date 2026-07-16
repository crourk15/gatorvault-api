/** War Room recruiting battle generator. */
const THREAT_COPY = {
  OSU: "OSU's pitch: development track and playoff exposure.",
  'Ohio State': "OSU's pitch: development track and playoff exposure.",
  Miami: "Miami's NIL structure is UF's biggest obstacle in this battle.",
  Georgia: "Georgia sells national-title pipeline and immediate two-deep pressure.",
  UGA: "Georgia sells national-title pipeline and immediate two-deep pressure.",
  FSU: "FSU proximity and in-state branding keep this battle alive longer than RPM shows.",
  'Florida State': "FSU proximity and in-state branding keep this battle alive longer than RPM shows.",
  Bama: "Alabama's closing history forces UF to win the final visit window.",
  Alabama: "Alabama's closing history forces UF to win the final visit window.",
};

function computeMomentumScore(visit, intel) {
  let score = 0;
  if (visit.ovCount) score += visit.ovCount * 2;
  if (visit.uvCount) score += visit.uvCount;
  const notes = (intel.notes || []).join(' ').toLowerCase();
  if (notes.includes('trending_up') || notes.includes('momentum_up')) score += 3;
  if (notes.includes('trending_down') || notes.includes('momentum_down')) score -= 3;
  return score;
}

function computeVisitImpact(visit) {
  let impact = 0;
  if (visit.lastOv) impact += 4;
  if (visit.lastUv) impact += 2;
  return impact;
}

function computeThreatIndex(competitors, ufProb) {
  if (!competitors.length || ufProb == null) return null;
  const maxCompetitorProb = Math.max(...competitors.map((c) => Number(c.prob || c.pct || 0)));
  const uf = Number(ufProb);
  const ufNorm = uf > 1 ? uf / 100 : uf;
  const compNorm = maxCompetitorProb > 1 ? maxCompetitorProb / 100 : maxCompetitorProb;
  return compNorm - ufNorm;
}

function fmtPct(v) {
  if (v == null || Number.isNaN(Number(v))) return null;
  const n = Number(v);
  return Math.round(n > 1 ? n : n * 100);
}

function resolveTargetSlug(p) {
  return String(p.slug || p.playerSlug || p.id || '').trim().toLowerCase();
}

function isStaffOrCoachIdentity(player) {
  const name = String(player?.name || player?.playerName || '').trim();
  if (!name) return true;
  try {
    const { isStaffOrCoachName } = require('./recruiting-staff-directory');
    if (isStaffOrCoachName(name)) return true;
  } catch {
    /* optional */
  }
  const cat = String(player?.category || '').toLowerCase();
  if (cat === 'staff' || cat === 'coach') return true;
  if (player?.role && /coach|coordinator|director|personnel/i.test(String(player.role))) return true;
  return false;
}

function isEligibleRecruitTarget(p) {
  if (!p || isStaffOrCoachIdentity(p)) return false;
  if (p.committedTo && !/florida|gators/i.test(String(p.committedTo))) return false;
  const { isActiveUfTarget } = require('./recruiting-target-filters');
  if (!isActiveUfTarget(p)) return false;
  const identityValidator = require('./identity-record-validator');
  const idCheck = identityValidator.validatePlayerIdentityRecord(p);
  if (!idCheck.valid) return false;
  const sanitize = require('./insider-articles-sanitize');
  const name = sanitize.sanitizePlayerName(p.name || p.playerName);
  if (!name) return false;
  const cat = String(p.category || '').toLowerCase();
  if (cat === 'target' || cat === 'portal') return true;
  if (/target|watch/i.test(String(p.status || ''))) return true;
  return (p.stars || 0) >= 4 && !p.committedTo;
}

function normalizeCompetitors(list) {
  return (list || [])
    .map((c) => ({
      school: c.school || c.name,
      prob: c.pct ?? c.probability ?? c.prob ?? c.score ?? null,
    }))
    .filter((c) => c.school);
}

function enrichTargetRecord(p, intelRows = []) {
  const slug = resolveTargetSlug(p);
  const sanitize = require('./insider-articles-sanitize');
  const name = sanitize.sanitizePlayerName(p.name || p.playerName);
  if (!name) return null;

  let ufProb = p.ufRpmPct ?? p.ufProbability ?? p.ufScore ?? null;
  let competitors = normalizeCompetitors(p.competingSchools || p.competitors);

  try {
    const { extractRealCompetitors } = require('./recruiting-hub-competitors');
    const slugIntel = intelRows.filter(
      (r) => String(r.playerSlug || r.slug || '').toLowerCase() === slug
    );
    const real = extractRealCompetitors(p, slugIntel);
    if (real.length) {
      competitors = real.map((c) => ({
        school: c.school,
        prob: c.score ?? c.pct ?? c.probability ?? null,
      }));
    }
  } catch {
    /* optional */
  }

  try {
    const { resolveUfProbability } = require('./uf-probability-utils');
    const resolved = resolveUfProbability({
      boardPct: ufProb,
      modelPct: p.ufScore ?? p.confidence ?? null,
    });
    if (resolved?.pct != null && Number(resolved.pct) > 0) ufProb = resolved.pct;
  } catch {
    /* optional */
  }

  const intelNotes = [];
  try {
    const warRoom = require('./war-room-store');
    const bd = warRoom.getBreakdownBySlug(slug);
    if (bd?.staffNotes) intelNotes.push(String(bd.staffNotes).slice(0, 160));
    if (bd?.summary && !intelNotes.length) intelNotes.push(String(bd.summary).slice(0, 160));
  } catch {
    /* optional */
  }

  return {
    id: slug,
    slug,
    name,
    position: p.pos || p.position || 'UNK',
    classYear: p.classYear || null,
    stars: p.stars || 0,
    priority: (p.stars || 0) >= 4 || p.priority === 'tier1' ? 'tier1' : 'tier2',
    urgency: Number(ufProb ?? p.stars ?? 0),
    ufProb,
    competitors,
    intelNotes,
  };
}

function indexIntelBySlug(intelRows) {
  const map = new Map();
  for (const row of intelRows || []) {
    const slug = String(row.playerSlug || row.slug || '').toLowerCase();
    if (!slug) continue;
    if (!map.has(slug)) map.set(slug, []);
    map.get(slug).push(row);
  }
  return map;
}

function battleHasRealData(battle) {
  const uf = battle?.ufProb;
  const hasUf = uf != null && !Number.isNaN(Number(uf)) && Number(uf) > 0;
  const hasComp = (battle.competitors || []).some(
    (c) => c.school && (c.prob != null || c.pct != null)
  );
  const hasIntel = (battle.intelNotes || []).some((n) => String(n).trim().length >= 24);
  const hasVisitSignal = (battle.visitImpact || 0) > 0 || Math.abs(battle.momentumScore || 0) >= 2;
  return hasUf || (hasComp && hasIntel) || (hasComp && hasUf) || (hasIntel && hasVisitSignal);
}

function buildBattleContextFromSignals(signals, context) {
  const players = signals?.recruiting?.players || [];
  const intelRows = signals?.intel?.all || signals?.intel?.recent || [];
  const intelBySlug = indexIntelBySlug(intelRows);

  const targets = players
    .filter(isEligibleRecruitTarget)
    .map((p) => enrichTargetRecord(p, intelBySlug.get(resolveTargetSlug(p)) || intelRows))
    .filter(Boolean);

  const rpmData = {};
  const intelSignals = {};
  const visits = {};
  const schemeFits = {};
  const positionalNeeds = {};

  for (const t of targets) {
    rpmData[t.id] = { ufProb: t.ufProb, competitors: t.competitors };
    const uf = Number(t.ufProb || 0);
    intelSignals[t.id] = {
      staffConfidence: uf >= 50 ? 'high' : uf >= 30 ? 'medium' : t.intelNotes.length ? 'medium' : 'low',
      notes: [...(t.intelNotes || [])],
    };
    visits[t.id] = { ovCount: 0, uvCount: 0, lastOv: null, lastUv: null };
    schemeFits[t.id] = {
      schemeRole: t.position,
      fitScore: t.stars >= 4 ? 8 : 6,
      fitNotes:
        t.stars >= 4
          ? `${t.name} projects as a ${t.position} who can stress-test the ${t.position} room in fall camp.`
          : `${t.position} depth chart competition shapes how aggressively UF closes ${t.name}.`,
    };
    positionalNeeds[t.position] = {
      needLevel: t.priority === 'tier1' ? 'high' : 'medium',
      schemeFitNotes: `${t.position} pipeline urgency for ${context?.season || signals?.season || '2026'} roster math.`,
    };
  }

  for (const [slug, rows] of intelBySlug.entries()) {
    if (!intelSignals[slug]) continue;
    for (const row of rows) {
      const et = String(row.eventType || '').toLowerCase();
      if (/official/.test(et)) {
        visits[slug].ovCount += 1;
        visits[slug].lastOv = row.timestamp || row.createdAt;
      }
      if (/unofficial|visit/.test(et)) {
        visits[slug].uvCount += 1;
        visits[slug].lastUv = row.timestamp || row.createdAt;
      }
      const detail = require('./insider-articles-sanitize').sanitizeIntelDetail(row.detail || row.text);
      if (detail) intelSignals[slug].notes.push(detail);
    }
  }

  const heat = context?.heatCheck || signals?.heatCheck?.rising || [];
  for (const h of heat) {
    const slug = String(h.slug || h.playerSlug || '').toLowerCase();
    if (slug && intelSignals[slug]) intelSignals[slug].notes.push('trending_up');
  }

  return { recruitingBoard: targets, rpmData, intelSignals, visits, positionalNeeds, schemeFits };
}

function generateRecruitingBattles(context) {
  const {
    recruitingBoard = [],
    rpmData = {},
    intelSignals = {},
    visits = {},
    positionalNeeds = {},
    schemeFits = {},
  } = context || {};

  const candidates = recruitingBoard
    .filter((t) => t.priority === 'tier1' || t.urgency >= 30 || (t.competitors || []).length)
    .sort((a, b) => (b.urgency || 0) - (a.urgency || 0));

  const battles = candidates.map((target) => {
    const rpm = rpmData[target.id] || {};
    const intel = intelSignals[target.id] || {};
    const visit = visits[target.id] || {};
    const scheme = schemeFits[target.id] || {};
    const need = positionalNeeds[target.position] || {};
    const ufProb = rpm.ufProb ?? target.ufProb ?? null;
    const competitors = rpm.competitors ?? target.competitors ?? [];
    const topCompetitor = [...competitors].sort((a, b) => (Number(b.prob || b.pct || 0)) - (Number(a.prob || a.pct || 0)))[0] || null;
    const momentumScore = computeMomentumScore(visit, intel);
    const visitImpact = computeVisitImpact(visit);
    const threatIndex = computeThreatIndex(competitors, ufProb);
    const staffConfidence = intel.staffConfidence ?? 'unknown';
    return {
      targetName: target.name,
      position: target.position,
      ufProb,
      competitors,
      topCompetitor,
      momentumScore,
      visitImpact,
      threatIndex,
      staffConfidence,
      schemeRole: scheme.schemeRole,
      schemeFitScore: scheme.fitScore,
      schemeFitNotes: scheme.fitNotes,
      positionalNeed: need.needLevel,
      positionalNeedNotes: need.schemeFitNotes,
      intelNotes: intel.notes || [],
    };
  });

  const quality = battles.filter(battleHasRealData);
  return quality.length >= 2 ? quality.slice(0, 3) : [];
}

function competitorThreatParagraph(battle) {
  const school = battle.topCompetitor?.school || battle.topCompetitor?.name;
  if (school && THREAT_COPY[school]) return THREAT_COPY[school];
  if (battle.threatIndex != null && battle.threatIndex > 0.08) {
    return `${school || 'The top competitor'} is in a real fight with Florida — RPM gap is tighter than the public narrative.`;
  }
  if (school && battle.ufProb != null) {
    return `Florida holds a measurable edge on ${battle.targetName}, but ${school} remains the primary obstacle if visit momentum stalls.`;
  }
  return null;
}

function staffIntelLine(battle) {
  if (battle.intelNotes?.length) {
    return `Staff intel: ${battle.intelNotes[0]}`;
  }
  if (battle.staffConfidence === 'high') {
    return `Staff believes ${battle.targetName} is closable before fall camp.`;
  }
  if (battle.staffConfidence === 'medium') {
    return `Internally, UF is more confident in ${battle.targetName} than external RPM shows.`;
  }
  return null;
}

function momentumLine(battle) {
  if (battle.momentumScore >= 4) {
    return `Momentum: trending up — recent visits moved Florida into the lead on ${battle.targetName}.`;
  }
  if (battle.momentumScore <= -2) {
    return `Momentum: trending down — competitor pressure is building on ${battle.targetName}.`;
  }
  if (battle.momentumScore >= 2) {
    return `Momentum: slight edge — ${battle.targetName} has recent Florida contact on the board.`;
  }
  return null;
}

function visitImpactLine(battle) {
  if (battle.visitImpact >= 4) {
    return `Visit impact: ${battle.targetName}'s last official visit shifted UF into the closing window.`;
  }
  if (battle.visitImpact >= 2) {
    return `Visit impact: unofficial contact kept Florida in the conversation for ${battle.targetName}.`;
  }
  return null;
}

function renderBattlesHtml(battles) {
  return (battles || [])
    .map((b) => {
      const ufPct = fmtPct(b.ufProb);
      const compLines = (b.competitors || [])
        .slice(0, 4)
        .map((c) => `${c.school || c.name} ${fmtPct(c.prob ?? c.pct) ?? '?'}%`)
        .join(', ');
      const topComp = b.topCompetitor
        ? `${b.topCompetitor.school || b.topCompetitor.name} (${fmtPct(b.topCompetitor.prob ?? b.topCompetitor.pct) ?? '?'}%)`
        : null;
      const momentum = momentumLine(b);
      const visit = visitImpactLine(b);
      const staff = staffIntelLine(b);
      const threat = competitorThreatParagraph(b);
      const tension =
        b.positionalNeed === 'high'
          ? `If Florida misses on ${b.targetName}, the ${b.position} pipeline becomes a multi-year repair problem.`
          : `Closing ${b.targetName} before fall camp stabilizes the ${b.position} room for ${b.classYear || '2027'}.`;
      const schemeLine =
        b.schemeFitNotes ||
        `${b.schemeRole || b.position} fit drives how ${b.targetName} projects in the ${b.position} room.`;
      const parts = [
        `<article class="insider-recruiting-battle">`,
        `<h3>${b.targetName} (${b.position})</h3>`,
        `<p><strong>UF probability:</strong> ${ufPct != null ? `${ufPct}%` : 'data pending'}</p>`,
        `<p><strong>Competitor percentages:</strong> ${compLines || 'No verified competitor split yet'}</p>`,
      ];
      if (topComp) parts.push(`<p><strong>Top competitor:</strong> ${topComp}</p>`);
      if (momentum) parts.push(`<p><strong>${momentum}</strong></p>`);
      if (visit) parts.push(`<p><strong>${visit}</strong></p>`);
      parts.push(`<p><strong>Staff confidence:</strong> ${b.staffConfidence}</p>`);
      if (staff) parts.push(`<p>${staff}</p>`);
      if (threat) parts.push(`<p>${threat}</p>`);
      parts.push(`<p><strong>Stakes:</strong> ${tension}</p>`);
      parts.push(
        `<p><strong>Scheme role:</strong> ${schemeLine}${b.schemeFitScore != null ? ` (fit score: ${b.schemeFitScore})` : ''}</p>`
      );
      if (b.positionalNeedNotes) {
        parts.push(
          `<p><strong>Positional need:</strong> ${b.positionalNeed ?? 'medium'} — ${b.positionalNeedNotes}</p>`
        );
      }
      parts.push(`</article>`);
      return parts.join('\n');
    })
    .join('\n');
}

function validateWarRoomBattles(battles, html) {
  const reasons = [];
  if (!battles || battles.length < 2) reasons.push('war_room_insufficient_battles');
  for (const b of battles || []) {
    if (isStaffOrCoachIdentity({ name: b.targetName })) reasons.push('war_room_staff_as_target');
    if (!battleHasRealData(b)) reasons.push('war_room_placeholder_battle');
  }
  const t = String(html || '').toLowerCase();
  if (!t.includes('uf probability')) reasons.push('war_room_missing_commit_likelihoods');
  if (!t.includes('competitor')) reasons.push('war_room_missing_competitor_analysis');
  if (!t.includes('staff')) reasons.push('war_room_missing_staff_intel');
  if (!t.includes('insider-recruiting-battle') && !t.includes('war-room-battle')) {
    reasons.push('war_room_missing_target_breakdown');
  }
  if (t.includes('>unknown<') || t.includes(': unknown')) reasons.push('war_room_unknown_probability');
  if ((t.match(/florida needs a live visit/g) || []).length > 0) reasons.push('war_room_visit_fallback');
  if ((t.match(/momentum: neutral/g) || []).length > 0) reasons.push('war_room_neutral_momentum_fallback');
  return [...new Set(reasons)];
}

module.exports = {
  generateRecruitingBattles,
  buildBattleContextFromSignals,
  renderBattlesHtml,
  validateWarRoomBattles,
  battleHasRealData,
  isEligibleRecruitTarget,
  isStaffOrCoachIdentity,
  computeMomentumScore,
  computeVisitImpact,
  computeThreatIndex,
};