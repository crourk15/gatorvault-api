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

function buildBattleContextFromSignals(signals, context) {
  const players = signals?.recruiting?.players || [];
  const intelRows = signals?.intel?.all || signals?.intel?.recent || [];
  const targets = players
    .filter((p) => !p.committedTo || /target|watch/i.test(String(p.status || p.category || '')))
    .map((p, i) => ({
      id: p.slug || p.id || `target_${i}`,
      name: p.name || p.playerName,
      position: p.pos || p.position || 'UNK',
      priority: (p.stars || 0) >= 4 || p.priority === 'tier1' ? 'tier1' : 'tier2',
      urgency: Number(p.ufRpmPct ?? p.ufProbability ?? p.stars ?? 0),
      ufProb: p.ufRpmPct ?? p.ufProbability ?? null,
      competitors: (p.competingSchools || p.competitors || []).map((c) => ({
        school: c.school || c.name,
        prob: c.pct ?? c.probability ?? c.prob,
      })),
    }));

  const rpmData = {};
  const intelSignals = {};
  const visits = {};
  const schemeFits = {};
  const positionalNeeds = {};

  for (const t of targets) {
    rpmData[t.id] = { ufProb: t.ufProb, competitors: t.competitors };
    intelSignals[t.id] = { staffConfidence: t.ufProb >= 50 ? 'high' : t.ufProb >= 30 ? 'medium' : 'low', notes: [] };
    visits[t.id] = { ovCount: 0, uvCount: 0, lastOv: null, lastUv: null };
    schemeFits[t.id] = { schemeRole: t.position, fitScore: t.urgency >= 4 ? 8 : 6 };
    positionalNeeds[t.position] = { needLevel: 'high', schemeFitNotes: `${t.position} room shapes closing urgency` };
  }

  for (const row of intelRows) {
    const slug = row.playerSlug || row.slug;
    if (!slug || !intelSignals[slug]) continue;
    const et = String(row.eventType || '').toLowerCase();
    if (/official/.test(et)) {
      visits[slug].ovCount += 1;
      visits[slug].lastOv = row.timestamp || row.createdAt;
    }
    if (/unofficial|visit/.test(et)) {
      visits[slug].uvCount += 1;
      visits[slug].lastUv = row.timestamp || row.createdAt;
    }
    if (row.detail) intelSignals[slug].notes.push(String(row.detail).slice(0, 120));
  }

  const heat = context?.heatCheck || signals?.heatCheck?.rising || [];
  for (const h of heat) {
    const slug = h.slug || h.playerSlug;
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

  const priorityTargets = recruitingBoard
    .filter((t) => t.priority === 'tier1' || t.urgency >= 3)
    .sort((a, b) => (b.urgency || 0) - (a.urgency || 0))
    .slice(0, 3);

  const picked = priorityTargets.length >= 2 ? priorityTargets : recruitingBoard.slice(0, 3);

  return picked.map((target) => {
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
      positionalNeed: need.needLevel,
      positionalNeedNotes: need.schemeFitNotes,
      intelNotes: intel.notes || [],
    };
  });
}

function competitorThreatParagraph(battle) {
  const school = battle.topCompetitor?.school || battle.topCompetitor?.name;
  if (school && THREAT_COPY[school]) return THREAT_COPY[school];
  if (battle.threatIndex != null && battle.threatIndex > 0.08) {
    return `${school || 'The top competitor'} is in a real fight with Florida — RPM gap is tighter than the public narrative.`;
  }
  return 'Florida is in control unless momentum shifts after the next visit window.';
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
  return `Staff is monitoring ${battle.targetName} closely — this battle hinges on the next visit cycle.`;
}

function momentumLine(battle) {
  if (battle.momentumScore >= 4) return 'Momentum: trending up — recent visits moved Florida into the lead.';
  if (battle.momentumScore <= -2) return 'Momentum: trending down — competitor pressure is building.';
  return 'Momentum: neutral — next OV/UV likely decides the leader.';
}

function visitImpactLine(battle) {
  if (battle.visitImpact >= 4) return 'Visit impact: last official visit shifted UF into the closing window.';
  if (battle.visitImpact >= 2) return 'Visit impact: unofficial contact kept Florida in the conversation.';
  return 'Visit impact: Florida needs a live visit to reset the board.';
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
        : 'N/A';
      const tension = b.positionalNeed === 'high'
        ? `If Florida misses on ${b.targetName}, the ${b.position} pipeline becomes a multi-year repair problem.`
        : `The ${b.season || '2026'} ceiling depends on closing ${b.targetName} before fall camp.`;
      return `
<article class="war-room-battle">
  <h3>${b.targetName} (${b.position})</h3>
  <p><strong>UF probability:</strong> ${ufPct != null ? ufPct + '%' : 'unknown'}</p>
  <p><strong>Competitor percentages:</strong> ${compLines || topComp}</p>
  <p><strong>Top competitor:</strong> ${topComp}</p>
  <p><strong>${momentumLine(b)}</strong></p>
  <p><strong>${visitImpactLine(b)}</strong></p>
  <p><strong>Staff confidence:</strong> ${b.staffConfidence}</p>
  <p>${staffIntelLine(b)}</p>
  <p>${competitorThreatParagraph(b)}</p>
  <p><strong>Stakes:</strong> ${tension}</p>
  <p><strong>Scheme role:</strong> ${b.schemeRole || 'N/A'} (fit score: ${b.schemeFitScore ?? 'N/A'})</p>
  <p><strong>Positional need:</strong> ${b.positionalNeed ?? 'N/A'}${b.positionalNeedNotes ? ` — ${b.positionalNeedNotes}` : ''}</p>
</article>`;
    })
    .join('\n');
}

function validateWarRoomBattles(battles, html) {
  const reasons = [];
  if (!battles || battles.length < 2) reasons.push('war_room_insufficient_battles');
  const t = String(html || '').toLowerCase();
  if (!t.includes('uf probability')) reasons.push('war_room_missing_commit_likelihoods');
  if (!t.includes('competitor')) reasons.push('war_room_missing_competitor_analysis');
  if (!t.includes('momentum')) reasons.push('war_room_missing_momentum');
  if (!t.includes('visit impact')) reasons.push('war_room_missing_visit_impact');
  if (!t.includes('staff')) reasons.push('war_room_missing_staff_intel');
  if (!t.includes('war-room-battle')) reasons.push('war_room_missing_target_breakdown');
  return reasons;
}

module.exports = {
  generateRecruitingBattles,
  buildBattleContextFromSignals,
  renderBattlesHtml,
  validateWarRoomBattles,
  computeMomentumScore,
  computeVisitImpact,
  computeThreatIndex,
};