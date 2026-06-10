/**
 * Insider Articles Engine — weekly draft generation from program signals.
 * Template-based analysis only; never auto-publishes.
 */
const store = require('./insider-articles-store');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_WEEKLY = 3;
const MAX_WEEKLY = 5;
const MAX_CANDIDATES = 12;

function esc(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function paragraph(text) {
  return `<p>${text}</p>`;
}

function wordCount(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

function calcReadTime(body) {
  return Math.max(3, Math.min(12, Math.ceil(wordCount(body) / 200)));
}

function uniqueSources(list) {
  const seen = new Set();
  return (list || []).filter((s) => {
    const key = `${s.name}|${s.outlet}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return s.name && s.outlet;
  });
}

async function collectSignals() {
  const recruitingStore = require('./recruiting-store');
  const intelStore = require('./recruiting-intel-store');
  const rosterStore = require('./roster-store');
  const depthJobs = require('./depth-chart-jobs');
  const bettingLines = require('./betting-lines');

  const [players, events, portal, roster, depthMeta, lines] = await Promise.all([
    recruitingStore.getAllPlayers(),
    recruitingStore.getEvents({ limit: 40 }),
    recruitingStore.getPortalBoard(),
    Promise.resolve(rosterStore.getAllRosterPlayers()),
    Promise.resolve(depthJobs.getDepthChartMeta()),
    bettingLines.getBettingLines().catch(() => null)
  ]);

  let intel = [];
  try {
    intel = intelStore.listIntel({ limit: 30 }) || [];
  } catch {
    intel = [];
  }

  let heatCheck = null;
  try {
    const heat = require('./heat-check-store');
    heatCheck = await heat.buildHeatCheck();
  } catch {
    heatCheck = null;
  }

  const recentEvents = events.filter((e) => Date.now() - new Date(e.createdAt).getTime() < 14 * 86400000);
  const visits = intel.filter((i) => /visit|ov|trending|heat|prediction/i.test(i.eventType || ''));
  const portalIncoming = portal.incoming || [];
  const targets = players.filter((p) => p.category === 'target');
  const commits = players.filter((p) => p.status === 'committed' && /florida/i.test(p.committedTo || ''));

  const offense = roster.filter((p) => p.unit === 'offense');
  const defense = roster.filter((p) => p.unit === 'defense');

  return {
    collectedAt: new Date().toISOString(),
    recruiting: { players, events: recentEvents, targets, commits },
    portal: { incoming: portalIncoming, headliner: portal.headliner, count: portal.count },
    depthChart: { meta: depthMeta, rosterCount: roster.length, offense: offense.length, defense: defense.length },
    gameZone: { nextGame: lines?.nextGame || null, schedule: lines?.schedule || [] },
    intel: { visits, all: intel.slice(0, 20) },
    heatCheck,
    roster: { players: roster, offense, defense }
  };
}

function scoreTopic(topic) {
  const s = topic.scores || {};
  return (
    (s.relevance || 0) * 0.3 +
    (s.timeliness || 0) * 0.25 +
    (s.impact || 0) * 0.25 +
    (s.dataRichness || 0) * 0.12 +
    (s.freshness || 0) * 0.08
  );
}

function buildCandidateTopics(signals) {
  const topics = [];
  const push = (topic) => topics.push({ ...topic, totalScore: scoreTopic(topic) });

  if (signals.portal.count > 0) {
    const hl = signals.portal.headliner;
    push({
      topicKey: `insider_portal_${signals.portal.count}`,
      category: 'insider',
      title: hl
        ? `Portal Radar: ${hl.name} leads Florida's ${signals.portal.count}-man incoming class`
        : `Portal Radar: Florida tracking ${signals.portal.count} incoming portal targets`,
      scores: {
        relevance: 90,
        timeliness: 85,
        impact: hl ? 88 : 72,
        dataRichness: Math.min(95, 50 + signals.portal.count * 5),
        freshness: 90
      },
      signals: { portal: signals.portal, type: 'portal' },
      sources: [{ name: 'On3 Portal', outlet: 'On3' }, { name: 'GatorVault Tracking', outlet: 'GatorVault' }]
    });
  }

  const recentVisits = signals.intel.visits.slice(0, 5);
  if (recentVisits.length) {
    const lead = recentVisits[0];
    push({
      topicKey: `insider_visits_${lead.playerSlug || lead.playerName}`,
      category: 'insider',
      title: `Insider: ${lead.playerName || 'Top target'} visit intel shapes Florida's board`,
      scores: {
        relevance: 88,
        timeliness: 92,
        impact: 80,
        dataRichness: Math.min(90, 40 + recentVisits.length * 10),
        freshness: 95
      },
      signals: { visits: recentVisits, type: 'visits' },
      sources: uniqueSources(
        recentVisits.map((v) => ({
          name: v.sourceHandle || v.analystName || 'Beat Writer',
          outlet: v.source === 'beat_writer' ? 'X / Beat' : v.source || 'Recruiting Intel'
        }))
      )
    });
  }

  if (signals.heatCheck?.rising?.length) {
    const rising = signals.heatCheck.rising.slice(0, 4);
    const top = rising[0];
    push({
      topicKey: `insider_heat_${top.playerSlug || top.playerName}`,
      category: 'insider',
      title: `Heat Check: ${top.playerName} momentum among Florida's rising targets`,
      scores: {
        relevance: 86,
        timeliness: 88,
        impact: 78,
        dataRichness: Math.min(88, 45 + rising.length * 8),
        freshness: 92
      },
      signals: { rising, type: 'heat' },
      sources: [{ name: 'On3 RPM', outlet: 'On3' }, { name: 'GatorVault Heat Check', outlet: 'GatorVault' }]
    });
  }

  if (signals.depthChart.meta || signals.depthChart.rosterCount > 50) {
    push({
      topicKey: `depth_chart_${signals.depthChart.rosterCount}`,
      category: 'depth_chart_movement',
      title: 'Depth Chart Movement: Florida roster layers coming into focus',
      scores: {
        relevance: 82,
        timeliness: 70,
        impact: 75,
        dataRichness: Math.min(92, 40 + Math.floor(signals.depthChart.rosterCount / 10)),
        freshness: signals.depthChart.meta?.updatedAt ? 85 : 60
      },
      signals: { depthChart: signals.depthChart, type: 'depth' },
      sources: [{ name: 'Florida Roster Data', outlet: 'GatorVault' }, { name: 'Depth Chart Engine', outlet: 'GatorVault' }]
    });
  }

  if (signals.roster.offense.length && signals.roster.defense.length) {
    push({
      topicKey: `roster_analysis_${signals.roster.players.length}`,
      category: 'roster_analysis',
      title: `Roster Analysis: Florida's ${signals.roster.players.length}-man roster by unit`,
      scores: {
        relevance: 80,
        timeliness: 65,
        impact: 70,
        dataRichness: Math.min(90, 50 + Math.floor(signals.roster.players.length / 15)),
        freshness: 70
      },
      signals: { roster: signals.roster, type: 'roster' },
      sources: [{ name: 'GatorVault Roster Store', outlet: 'GatorVault' }]
    });
  }

  push({
    topicKey: 'summer_preview_camp_battles',
    category: 'summer_preview',
    title: 'Summer Preview: Camp battles to watch across Florida\'s two-deep',
    scores: {
      relevance: 78,
      timeliness: 80,
      impact: 72,
      dataRichness: 65,
      freshness: 75
    },
    signals: { roster: signals.roster, depthChart: signals.depthChart, type: 'summer' },
    sources: [{ name: 'GatorVault Staff', outlet: 'GatorVault' }, { name: 'Spring/Summer Reports', outlet: 'Public Beat' }]
  });

  const nextGame = signals.gameZone.nextGame;
  if (nextGame?.game || nextGame?.opponent) {
    const opp = nextGame.opponent || nextGame.game || 'Next Opponent';
    push({
      topicKey: `game_preview_${String(opp).replace(/\s+/g, '_').toLowerCase()}`,
      category: 'game_week_preview',
      title: `Game Week Preview: Florida vs ${opp.replace(/^Florida vs\s*/i, '')}`,
      scores: {
        relevance: 84,
        timeliness: nextGame.date ? 90 : 75,
        impact: 82,
        dataRichness: 70,
        freshness: 88
      },
      signals: { game: nextGame, schedule: signals.gameZone.schedule, type: 'game' },
      sources: uniqueSources([
        { name: 'Game Zone Lines', outlet: 'GatorVault' },
        nextGame.source ? { name: nextGame.source, outlet: nextGame.source } : null
      ].filter(Boolean))
    });
  }

  if (signals.recruiting.commits.length) {
    push({
      topicKey: `insider_commits_${signals.recruiting.commits.length}`,
      category: 'insider',
      title: `Insider: Florida's ${signals.recruiting.commits.length} commits — class pulse check`,
      scores: {
        relevance: 85,
        timeliness: 75,
        impact: 80,
        dataRichness: Math.min(85, 40 + signals.recruiting.commits.length),
        freshness: 78
      },
      signals: { commits: signals.recruiting.commits.slice(0, 8), events: signals.recruiting.events, type: 'commits' },
      sources: [{ name: 'On3', outlet: 'On3' }, { name: 'GatorVault Recruiting Board', outlet: 'GatorVault' }]
    });
  }

  if (signals.recruiting.targets.length >= 5) {
    push({
      topicKey: `insider_targets_${signals.recruiting.targets.length}`,
      category: 'insider',
      title: `Insider: ${signals.recruiting.targets.length} live targets on Florida's board`,
      scores: {
        relevance: 80,
        timeliness: 72,
        impact: 74,
        dataRichness: Math.min(82, 35 + signals.recruiting.targets.length),
        freshness: 76
      },
      signals: { targets: signals.recruiting.targets.slice(0, 10), type: 'targets' },
      sources: [{ name: 'On3', outlet: 'On3' }, { name: 'Rivals', outlet: 'Rivals' }]
    });
  }

  return topics
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, MAX_CANDIDATES);
}

function writeDraftBody(topic) {
  const paragraphs = [];
  const type = topic.signals?.type;

  paragraphs.push(
    paragraph(
      `<strong>${esc(topic.title)}</strong> — Original GatorVault analysis assembled from verified public recruiting, roster, and beat reporting. Nothing below is presented as a direct quote unless attributed.`
    )
  );

  if (type === 'portal') {
    const p = topic.signals.portal;
    paragraphs.push(
      paragraph(
        `Florida is tracking <strong>${p.count}</strong> incoming portal names on the GatorVault board${
          p.headliner ? `, headlined by <strong>${esc(p.headliner.name)}</strong> (${esc(p.headliner.pos || '')}, ${esc(p.headliner.stars || '')}★)` : ''
        }. Portal volume this cycle affects immediate two-deep planning and fall camp competition.`
      )
    );
    (p.incoming || []).slice(0, 4).forEach((pl) => {
      paragraphs.push(
        paragraph(
          `<strong>${esc(pl.name)}</strong> (${esc(pl.pos)}, ${pl.stars || '—'}★) — ${esc(pl.school || pl.fromSchool || 'portal entry')}. Status: ${esc(pl.status || 'tracking')}.`
        )
      );
    });
  }

  if (type === 'visits') {
    paragraphs.push(paragraph(`Visit and OV intel is the primary driver for this week's insider board movement:`));
    topic.signals.visits.forEach((v) => {
      paragraphs.push(
        paragraph(
          `<strong>${esc(v.playerName)}</strong> — ${esc(v.eventType || 'intel')}. ${esc(v.detail || 'Reported via beat/recruiting channels.')}`
        )
      );
    });
  }

  if (type === 'heat') {
    paragraphs.push(paragraph(`On3 RPM / Heat Check momentum flags the following rising names:`));
    topic.signals.rising.forEach((r) => {
      paragraphs.push(
        paragraph(
          `<strong>${esc(r.playerName)}</strong> (${esc(r.pos || '')}) — ${esc(r.triggerLabel || r.headline || 'Momentum uptick')}${
            r.predictionSchool ? ` · Crystal Ball lean: ${esc(r.predictionSchool)}` : ''
          }.`
        )
      );
    });
  }

  if (type === 'depth') {
    const d = topic.signals.depthChart;
    paragraphs.push(
      paragraph(
        `The GatorVault depth chart tracks <strong>${d.rosterCount || '—'}</strong> rostered players${
          d.meta?.updatedAt ? ` (last refresh ${new Date(d.meta.updatedAt).toLocaleDateString()})` : ''
        }. Offense: ${d.offense || '—'} · Defense: ${d.defense || '—'}.`
      )
    );
    paragraphs.push(
      paragraph(
        'Position groups with limited experienced depth tend to show the fastest summer movement — watch WR, EDGE, and secondary spots where young players can climb with strong camp reps.'
      )
    );
  }

  if (type === 'roster') {
    const r = topic.signals.roster;
    paragraphs.push(
      paragraph(
        `Florida lists <strong>${r.players.length}</strong> players across offense (${r.offense.length}), defense (${r.defense.length}), and special teams. Unit balance matters for both game-planning and portal/recruiting priorities.`
      )
    );
    paragraphs.push(
      paragraph(
        'This analysis maps where the roster is mature vs. where 2026 additions (portal + signing class) are most likely to earn snaps early.'
      )
    );
  }

  if (type === 'summer') {
    paragraphs.push(
      paragraph(
        'Summer preview pieces focus on camp battles — not depth-chart locks. Florida traditionally sees movement at receiver, defensive line, and nickel before fall camp.'
      )
    );
    paragraphs.push(
      paragraph(
        `With ${topic.signals.roster?.players?.length || '100+'} names on the official board, competition depth is sufficient for multiple position rooms to keep legitimate open battles into August.`
      )
    );
  }

  if (type === 'game') {
    const g = topic.signals.game;
    paragraphs.push(
      paragraph(
        `<strong>${esc(g.game || g.opponent || 'Next game')}</strong>${g.date ? ` · ${esc(g.date)}` : ''}${
          g.spread ? ` · Line: ${esc(g.spread)}` : ''
        }${g.total ? ` · O/U ${esc(g.total)}` : ''}.`
      )
    );
    paragraphs.push(
      paragraph(
        'Game-week previews combine GatorVault line data with roster availability context. Florida’s advantage paths typically run through trench play and explosive skill talent — verify injury/portal updates before kickoff.'
      )
    );
  }

  if (type === 'commits') {
    paragraphs.push(paragraph(`Florida holds <strong>${topic.signals.commits.length}</strong> committed recruits on the live board:`));
    topic.signals.commits.slice(0, 6).forEach((c) => {
      paragraphs.push(
        paragraph(`<strong>${esc(c.name)}</strong> (${esc(c.pos)}, ${c.classYear || '—'}) — ${c.stars || '—'}★ · ${esc(c.school || '')}`)
      );
    });
  }

  if (type === 'targets') {
    paragraphs.push(paragraph(`Live uncommitted targets (${topic.signals.targets.length} sampled):`));
    topic.signals.targets.slice(0, 6).forEach((t) => {
      paragraphs.push(
        paragraph(`<strong>${esc(t.name)}</strong> (${esc(t.pos)}, ${t.classYear || '—'}) — ${t.stars || '—'}★ · ${esc(t.school || '')}`)
      );
    });
  }

  while (paragraphs.length < 5) {
    paragraphs.push(
      paragraph(
        'GatorVault will refresh this analysis when new verified beat, portal, or roster signals land. Approve in GV-OM before any public publish.'
      )
    );
  }

  return paragraphs.slice(0, 10).join('\n');
}

function writeDraftFromTopic(topic) {
  const body = writeDraftBody(topic);
  const summary = topic.title.replace(/^[^:]+:\s*/, '').slice(0, 220);
  const meta = store.CATEGORIES[topic.category] || store.CATEGORIES.insider;

  return store.normalizeArticle({
    title: topic.title,
    category: topic.category,
    byline: meta.byline,
    summary,
    body,
    readTimeMinutes: calcReadTime(body),
    sources: uniqueSources(topic.sources),
    topicKey: topic.topicKey,
    status: 'draft',
    createdAt: new Date().toISOString()
  });
}

async function generateWeeklyDrafts({ force = false, maxDrafts = MAX_WEEKLY } = {}) {
  const createdThisWeek = store.draftsCreatedSince(WEEK_MS).filter((a) => a.status === 'draft');
  const pending = store.countDraftsPending();

  if (!force && createdThisWeek.length >= maxDrafts) {
    return {
      ok: true,
      skipped: true,
      reason: 'weekly_cap_reached',
      createdThisWeek: createdThisWeek.length,
      pending
    };
  }

  const signals = await collectSignals();
  const candidates = buildCandidateTopics(signals);
  const existingKeys = new Set(
    [...store.listDrafts({ status: 'draft' }), ...store.listPublished()].map((a) => a.topicKey).filter(Boolean)
  );

  const slots = Math.max(0, maxDrafts - createdThisWeek.length);
  const selected = [];
  for (const topic of candidates) {
    if (selected.length >= slots) break;
    if (existingKeys.has(topic.topicKey)) continue;
    selected.push(topic);
    existingKeys.add(topic.topicKey);
  }

  if (selected.length < MIN_WEEKLY && !force && candidates.length >= MIN_WEEKLY) {
    for (const topic of candidates) {
      if (selected.length >= MIN_WEEKLY) break;
      if (selected.some((s) => s.topicKey === topic.topicKey)) continue;
      selected.push(topic);
    }
  }

  const drafts = selected.map((topic) => store.addDraft(writeDraftFromTopic(topic)));

  store.logEvent('weekly_generation', {
    candidateCount: candidates.length,
    selectedCount: drafts.length,
    draftIds: drafts.map((d) => d.id)
  });

  return {
    ok: true,
    signalsAt: signals.collectedAt,
    candidates: candidates.length,
    selected: drafts.length,
    drafts,
    pending: store.countDraftsPending()
  };
}

async function refreshArticleContent(article) {
  const signals = await collectSignals();
  const candidates = buildCandidateTopics(signals);
  let topic = candidates.find((t) => t.topicKey === article.topicKey);
  if (!topic) {
    topic = {
      topicKey: article.topicKey || article.id,
      category: article.category,
      title: article.title,
      signals: { type: 'roster', roster: signals.roster },
      sources: article.sources
    };
  }
  const body = writeDraftBody(topic);
  return {
    summary: article.summary,
    body,
    readTimeMinutes: calcReadTime(body),
    sources: uniqueSources(topic.sources || article.sources)
  };
}

module.exports = {
  WEEK_MS,
  MIN_WEEKLY,
  MAX_WEEKLY,
  collectSignals,
  buildCandidateTopics,
  writeDraftFromTopic,
  generateWeeklyDrafts,
  refreshArticleContent
};
