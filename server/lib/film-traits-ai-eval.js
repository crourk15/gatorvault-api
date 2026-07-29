'use strict';

/**
 * Vault AI film evaluation — generates traits for Beat Desk Copy Brief.
 * Charles does NOT write traits; the system does.
 *
 * Signals (best → fallback):
 * 1) OpenAI vision on Hudl frames (when OPENAI_API_KEY / INSIDER_ARTICLE_LLM_KEY set)
 * 2) On3 scoutingReport / journals + Hudl metadata, rewritten into Vault voice (no writer names)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const filmStore = require('./film-traits-store');
const { resolveHudlDirectMedia } = require('./hudl-embed-fetch');

function hasLlmKey() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.INSIDER_ARTICLE_LLM_KEY);
}

function llmModel() {
  return (
    process.env.FILM_TRAITS_MODEL ||
    process.env.OPENAI_VISION_MODEL ||
    process.env.OPENAI_MODEL ||
    'gpt-4o-mini'
  );
}

function stripWriterAttribution(text) {
  return String(text || '')
    .replace(/\bCharles Power\b/gi, '')
    .replace(/\bOn3 Dir(?:ector)? of Scouting\b/gi, '')
    .replace(/\baccording to\b[^.]*\./gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function sentences(text, limit = 8) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 28)
    .slice(0, limit);
}

async function fetchOn3ScoutContext(recruitSlug, classYear = 2028) {
  if (!recruitSlug) return { summaryText: null, journalTitle: null };
  try {
    const on3 = require('./on3-recruit-client');
    const clean = String(recruitSlug).replace(/^\/+|\/+$/g, '');
    const url = 'https://www.on3.com/rivals/' + clean + '/';
    const pp = await on3.fetchNextPageProps(url, classYear);
    const summaryText = pp?.scoutingReport?.summaryText || null;
    const journal = pp?.scoutingJournals?.list?.[0] || null;
    return {
      summaryText: summaryText ? stripWriterAttribution(summaryText) : null,
      journalTitle: journal?.title || null,
      journalBody: journal?.body ? stripWriterAttribution(journal.body).slice(0, 900) : null,
    };
  } catch {
    return { summaryText: null, journalTitle: null };
  }
}

function synthesizeTraitsFromScout({ playerName, position, scout, sources = [] }) {
  const blob = [scout?.summaryText, scout?.journalBody].filter(Boolean).join(' ');
  const traits = [];

  if (/man coverage|1-on-1|one-on-one|in-phase|shadowing/i.test(blob)) {
    traits.push('Man-coverage feet — stays in-phase and shadows receivers through the route');
  }
  if (/backpedal|flipping his hips|hip/i.test(blob)) {
    traits.push('Clean transition out of the backpedal with hip flip to run verticals');
  }
  if (/pass breakup|pbu|diving/i.test(blob)) {
    traits.push('Closes late and contests — diving PBU / ball disruption when slightly out of phase');
  }
  if (/compact|compactly built/i.test(blob)) {
    traits.push('Compact safety build — wins with polish and quickness more than length');
  }
  if (/competitive|instinctive|playmaker/i.test(blob)) {
    traits.push('Competitive / instinctive playmaker temperament shows up in camp and Friday nights');
  }
  if (/dominant|shut down|statement/i.test(blob)) {
    traits.push('High-end camp tape vs shifty WRs — coverage reps look starter-caliber for the class');
  }

  const labels = (sources || []).map((s) => String(s.label || '')).join(' ');
  if (!traits.length && /highlight/i.test(labels)) {
    traits.push('Highlight reel on file — athleticism package ready for Vault frame read');
  }

  while (traits.length < 3 && blob) {
    const extra = sentences(blob, 6).find((s) => !traits.some((t) => t.slice(0, 40) === s.slice(0, 40)));
    if (!extra) break;
    traits.push(extra.slice(0, 140));
  }

  const name = playerName || 'this prospect';
  const vaultFilmAngle = /compact|man coverage|in-phase/i.test(blob)
    ? 'Lead with coverage polish and man-match feet for ' + name + ' — Florida process story, not a star-count dump.'
    : 'Lead with 1-2 tape facts from the linked Hudl for ' + name + ', then Florida visits/staff.';

  return {
    traits: traits.slice(0, 6),
    vaultFilmAngle,
    doNotClaim: [
      'Do not invent tackle totals, INT counts, or grades not on the tape/scout signals',
      'Do not attribute this evaluation to On3 writers or name Charles Power in the post',
      'Do not overclaim NFL projection from camp/highlight reps alone',
    ],
    clipNotes:
      'Vault AI eval from On3 film/camp signals + Hudl links (' +
      (position || 'athlete') +
      '). Auto-generated for Copy Brief.',
    evaluatedBy: 'vault-ai-scout-synth',
    evalMode: 'on3_scout_rewrite',
  };
}

async function chatJson({ system, user, images = [] }) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.INSIDER_ARTICLE_LLM_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const content = [{ type: 'text', text: user }];
  for (const img of images.slice(0, 8)) {
    content.push({
      type: 'image_url',
      image_url: { url: img.startsWith('data:') ? img : 'data:image/jpeg;base64,' + img },
    });
  }
  const res = await fetch(baseUrl + '/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: llmModel(),
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error('film_eval_llm_' + res.status + ': ' + errText.slice(0, 200));
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || '';
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1] : raw);
}

async function downloadHudlFrames(hudlUrl, { maxFrames = 8 } = {}) {
  const resolved = await resolveHudlDirectMedia(hudlUrl);
  if (!resolved.ok || !resolved.mp4Url) {
    return { ok: false, error: resolved.error || 'no_mp4', frames: [], meta: resolved.meta };
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-film-'));
  const mp4Path = path.join(dir, 'clip.mp4');
  const frameDir = path.join(dir, 'frames');
  fs.mkdirSync(frameDir, { recursive: true });
  try {
    const mp4Res = await fetch(resolved.mp4Url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GatorVaultFilmBot/1.0)' },
    });
    if (!mp4Res.ok) throw new Error('mp4_' + mp4Res.status);
    fs.writeFileSync(mp4Path, Buffer.from(await mp4Res.arrayBuffer()));
    const outPattern = path.join(frameDir, 'f_%03d.jpg');
    const ff = spawnSync(
      'ffmpeg',
      ['-y', '-i', mp4Path, '-vf', 'fps=1/10', '-frames:v', String(maxFrames), outPattern],
      { encoding: 'utf8' }
    );
    if (ff.status !== 0) {
      return { ok: false, error: 'ffmpeg_failed', frames: [], meta: resolved.meta, dir };
    }
    const frames = fs
      .readdirSync(frameDir)
      .filter((f) => f.endsWith('.jpg'))
      .sort()
      .map((f) => path.join(frameDir, f));
    return { ok: true, frames, meta: resolved.meta, dir, mp4Url: resolved.mp4Url };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      frames: [],
      meta: resolved.meta,
      dir,
    };
  }
}

function framesToBase64(framePaths) {
  return (framePaths || []).slice(0, 8).map((p) => fs.readFileSync(p).toString('base64'));
}

async function evaluateWithVision({ playerName, position, classYear, scout, sources, framePaths }) {
  const system =
    "You are GatorVault's recruiting film analyst. Evaluate high-school football highlight frames. " +
    'Return JSON only: { "traits": string[3..6], "vaultFilmAngle": string, "doNotClaim": string[2..5], "clipNotes": string }. ' +
    'Traits must be concrete tape observations (coverage, burst, length, ball skills). ' +
    'Never name beat writers or On3 analysts. Never invent stats. Florida-recruiting context OK in vaultFilmAngle only.';

  const user = [
    'Player: ' + (playerName || 'Unknown'),
    'Position: ' + (position || '?'),
    'Class: ' + (classYear || '?'),
    sources?.length
      ? 'Highlight labels: ' + sources.map((s) => s.label).filter(Boolean).join(' | ')
      : '',
    scout?.summaryText
      ? 'Camp/scout signal (rewrite — do not cite): ' + scout.summaryText.slice(0, 700)
      : '',
    'Write Vault traits from the frames + signals.',
  ]
    .filter(Boolean)
    .join('\n');

  const images = framesToBase64(framePaths);
  const parsed = await chatJson({ system, user, images });
  return {
    traits: Array.isArray(parsed.traits) ? parsed.traits.map(String).filter(Boolean).slice(0, 6) : [],
    vaultFilmAngle: String(parsed.vaultFilmAngle || '').trim(),
    doNotClaim: Array.isArray(parsed.doNotClaim)
      ? parsed.doNotClaim.map(String).filter(Boolean).slice(0, 6)
      : [],
    clipNotes: String(parsed.clipNotes || 'Vault AI vision eval from Hudl frames.').trim(),
    evaluatedBy: 'vault-ai-vision',
    evalMode: 'hudl_frames_llm',
  };
}

async function evaluateFilmTraitsForSlug(slug, { force = false, player = null } = {}) {
  const key = filmStore.normalizeSlug(slug);
  if (!key) return { ok: false, error: 'missing_slug' };

  let entry = filmStore.getFilmTraitsBySlug(key);
  if (!entry) {
    const ingest = require('./film-traits-ingest');
    const hydrated = await ingest.hydrateFilmTraitsFromOn3({ slug: key, player, force: true });
    if (!hydrated.ok) return { ok: false, error: hydrated.error || 'hydrate_failed', hydrate: hydrated };
    entry = filmStore.getFilmTraitsBySlug(key);
  }

  if (!force && entry?.traits?.length && entry.evaluatedBy) {
    return { ok: true, skipped: true, reason: 'traits_already_evaluated', filmTraits: entry };
  }

  if (!player) {
    try {
      player = (await require('./recruiting-store').getPlayerBySlug(key)) || null;
    } catch {
      player = null;
    }
  }

  const recruitSlug = entry?.on3RecruitSlug || player?.on3Slug || key;
  const classYear = entry?.classYear || player?.classYear || 2028;
  const scout = await fetchOn3ScoutContext(recruitSlug, classYear);
  const sources = entry?.sources || [];
  const hudl = sources.find((s) => /hudl/i.test(s.type || s.url || ''));

  let evalResult = null;
  let frameInfo = null;

  if (hasLlmKey() && hudl?.url) {
    frameInfo = await downloadHudlFrames(hudl.url, { maxFrames: 8 });
    if (frameInfo.ok && frameInfo.frames.length) {
      try {
        evalResult = await evaluateWithVision({
          playerName: entry.playerName || player?.name,
          position: entry.position || player?.pos,
          classYear,
          scout,
          sources,
          framePaths: frameInfo.frames,
        });
      } catch (err) {
        evalResult = null;
        frameInfo.visionError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  if (!evalResult || !evalResult.traits?.length) {
    evalResult = synthesizeTraitsFromScout({
      playerName: entry.playerName || player?.name,
      position: entry.position || player?.pos,
      scout,
      sources,
    });
    if (frameInfo?.visionError) {
      evalResult.clipNotes += ' (vision fallback: ' + frameInfo.visionError + ')';
    } else if (!hasLlmKey()) {
      evalResult.clipNotes +=
        ' (LLM key not set — used On3 film/camp signals rewritten into Vault voice)';
    }
  }

  if (!evalResult.traits?.length) {
    return { ok: false, error: 'eval_produced_no_traits', scout, frameInfo };
  }

  filmStore.upsertFilmTraits(key, {
    playerName: entry.playerName,
    position: entry.position,
    classYear: entry.classYear,
    sources: entry.sources,
    traits: evalResult.traits,
    vaultFilmAngle: evalResult.vaultFilmAngle,
    doNotClaim: evalResult.doNotClaim,
    clipNotes: evalResult.clipNotes,
    ingestStatus: 'traits_ready',
    on3RecruitSlug: entry.on3RecruitSlug || recruitSlug,
    on3ProfileUrl: entry.on3ProfileUrl,
    lastIngestAt: entry.lastIngestAt,
  });

  try {
    const doc = filmStore.loadFilmTraitsDoc();
    if (doc.bySlug[key]) {
      doc.bySlug[key].evaluatedBy = evalResult.evaluatedBy;
      doc.bySlug[key].evalMode = evalResult.evalMode;
      doc.bySlug[key].evaluatedAt = new Date().toISOString();
      doc.bySlug[key].ingestStatus = 'traits_ready';
      filmStore.saveFilmTraitsDoc(doc);
    }
  } catch {
    /* optional */
  }

  return {
    ok: true,
    slug: key,
    filmTraits: filmStore.getFilmTraitsBySlug(key),
    evalMode: evalResult.evalMode,
    traitCount: evalResult.traits.length,
    usedVision: evalResult.evalMode === 'hudl_frames_llm',
  };
}

module.exports = {
  hasLlmKey,
  fetchOn3ScoutContext,
  synthesizeTraitsFromScout,
  downloadHudlFrames,
  evaluateFilmTraitsForSlug,
  stripWriterAttribution,
};
