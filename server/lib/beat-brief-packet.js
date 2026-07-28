/**
 * Beat Brief Desk — paste-ready player/UF packet for Charles → Cursor/Copilot → X.
 * Built from beat intel + recruiting store + inspect/compose context.
 */
const intelStore = require('./recruiting-intel-store');

function normalizeSlug(slug) {
  return String(slug || '').trim().toLowerCase();
}

function line(label, value) {
  if (value == null || value === '') return null;
  const v = String(value).trim();
  if (!v) return null;
  return `${label}: ${v}`;
}

function pct(n) {
  if (n == null || n === '') return null;
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  if (num <= 1) return `${Math.round(num * 100)}%`;
  return `${Math.round(num)}%`;
}

async function loadRecruitingPlayer(slug) {
  try {
    const store = require('./recruiting-store');
    return (await store.getPlayerBySlug(slug)) || null;
  } catch {
    return null;
  }
}

function rivalList(player = {}) {
  const raw =
    player.competingSchools ||
    player.rivals ||
    player.schoolsInvolved ||
    player.interestSchools ||
    [];
  if (Array.isArray(raw)) {
    return raw
      .map((s) => (typeof s === 'string' ? s : s?.name || s?.school || ''))
      .map((s) => String(s || '').trim())
      .filter(Boolean)
      .slice(0, 8);
  }
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  return [];
}

function formatBriefText({ slug, playerName, player, inspect, beatRows }) {
  const lines = [];
  lines.push('GATORVAULT BEAT BRIEF');
  lines.push('=====================');
  lines.push(line('Player', playerName || slug) || `Player: ${slug}`);
  lines.push(line('Slug', slug));
  lines.push(line('Class', player?.classYear || player?.year));
  lines.push(line('Position', player?.position || player?.pos));
  lines.push(line('Stars', player?.stars));
  lines.push(
    line(
      'School',
      player?.school || player?.highSchool || player?.fromSchool
    )
  );
  lines.push(line('Hometown / State', player?.hometown || player?.state || player?.hometownState));
  lines.push(line('National rank', player?.natlRank || player?.nationalRank));
  lines.push(line('Position rank', player?.posRank || player?.positionRank));
  lines.push(line('Composite / rating', player?.composite || player?.rating || player?.compositeScore));
  lines.push(line('UF likelihood', pct(player?.ufProbability ?? player?.ufConfidence ?? player?.floridaOdds)));
  lines.push(line('UF status', player?.ufStatus || player?.status));
  lines.push(line('Committed to', player?.committedTo));
  const rivals = rivalList(player);
  if (rivals.length) lines.push(line('Rivals / involved', rivals.join(', ')));
  lines.push(line('Visit / OV', player?.ufOvStatus || player?.visitStatus || player?.officialVisitStatus));
  lines.push(
    line(
      'Visit window',
      [player?.visitStart, player?.visitEnd].filter(Boolean).join(' → ') || null
    )
  );

  lines.push('');
  lines.push('BEAT INTEL (newest first)');
  lines.push('-------------------------');
  if (!beatRows.length) {
    lines.push('(No beat intel rows on file for this player.)');
  } else {
    beatRows.slice(0, 8).forEach((row, i) => {
      const when = row.reportedAt || row.createdAt || '';
      const src = row.source || 'beat';
      const text = String(row.detail || row.skinny || row.text || '').trim();
      lines.push(`${i + 1}. [${when}] (${src})`);
      lines.push(text || '(empty)');
      if (row.articleUrl || row.url) lines.push(`Source: ${row.articleUrl || row.url}`);
      lines.push('');
    });
  }

  const draftText =
    inspect?.fullCompose?.ok && inspect.fullCompose.text
      ? inspect.fullCompose.text
      : inspect?.drafts?.[0]?.textPreview || null;
  if (draftText) {
    lines.push('DRAFT SUGGESTION (optional)');
    lines.push('---------------------------');
    lines.push(String(draftText).trim());
    lines.push('');
  }

  lines.push('INSTRUCTIONS FOR AI');
  lines.push('-------------------');
  lines.push(
    'Write one sharp X/Twitter post for GatorVault Insider from this beat intel. Stay factual to the beat. No invented offers, visits, or rankings. UF voice, no banned claims. Keep it under 280 chars unless I ask for a thread.'
  );

  return lines.filter((l) => l !== null).join('\n');
}

/**
 * Full brief packet for Beat Desk UI + copy/paste.
 */
async function buildBeatBrief(slug, opts = {}) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return { ok: false, error: 'missing_slug' };

  const { inspectPlayer, isBeatIntel } = require('./post-studio-intel-inbox');

  await intelStore.initIntelStore().catch(() => {});

  // Desk needs facts + beat text fast. Skip heavy elite compose unless ?full=1.
  const wantFull = opts && opts.full === true;
  const [inspect, player] = await Promise.all([
    wantFull
      ? inspectPlayer(normalized).catch((err) => ({ ok: false, error: err.message }))
      : Promise.resolve({ ok: true, playerName: null, verdict: null, fullCompose: null, drafts: [] }),
    loadRecruitingPlayer(normalized),
  ]);

  const allIntel = intelStore.getIntelForPlayer({ playerSlug: normalized }) || [];
  const beatRows = allIntel
    .filter((r) => isBeatIntel(r) || r.ufRelevant === true)
    .sort(
      (a, b) =>
        new Date(b.reportedAt || b.createdAt || 0) - new Date(a.reportedAt || a.createdAt || 0)
    );

  const playerName =
    inspect?.playerName ||
    player?.name ||
    player?.fullName ||
    beatRows[0]?.playerName ||
    normalized;

  if (inspect && !inspect.playerName) inspect.playerName = playerName;

  const pasteText = formatBriefText({
    slug: normalized,
    playerName,
    player: player || {},
    inspect: inspect?.ok ? inspect : null,
    beatRows,
  });

  return {
    ok: true,
    slug: normalized,
    playerName,
    updatedAt: new Date().toISOString(),
    player: player
      ? {
          classYear: player.classYear || player.year || null,
          position: player.position || player.pos || null,
          stars: player.stars ?? null,
          school: player.school || player.highSchool || null,
          state: player.state || player.hometownState || null,
          ufProbability: player.ufProbability ?? player.ufConfidence ?? null,
          ufStatus: player.ufStatus || player.status || null,
          committedTo: player.committedTo || null,
          rivals: rivalList(player),
          natlRank: player.natlRank || player.nationalRank || null,
          visitStatus: player.ufOvStatus || player.visitStatus || null,
        }
      : null,
    beatCount: beatRows.length,
    primaryBeat: beatRows[0]
      ? {
          text: String(beatRows[0].detail || beatRows[0].skinny || '').trim(),
          source: beatRows[0].source || null,
          reportedAt: beatRows[0].reportedAt || beatRows[0].createdAt || null,
          articleUrl: beatRows[0].articleUrl || beatRows[0].url || null,
        }
      : null,
    draftSuggestion:
      inspect?.fullCompose?.ok && inspect.fullCompose.text
        ? {
            text: inspect.fullCompose.text,
            thin: !!inspect.fullCompose.thin,
            path: inspect.fullCompose.composePath || null,
          }
        : null,
    verdict: inspect?.verdict || null,
    pasteText,
  };
}

module.exports = {
  buildBeatBrief,
  formatBriefText,
};
