/**
 * Detectives strategy builder — voice-first; no weak beat_driven fallback when voice is required.
 */
const { SITE_URL } = require('./discovery-core');
const promote = require('./detectives-promote');
const voiceEngine = require('./voice-engine');
const store = require('./detectives-store');

const VOICE_SKIP_REASONS = new Set([
  'strategy_data_missing',
  'missing_situation',
  'copy_failed',
  'quality_gate',
  'recruiting_qa'
]);

function voiceRequiredForCase(caseItem, hints) {
  if (!voiceEngine.voiceEngineEnabled()) return false;
  if (process.env.X_AUTOPOST_VOICE_REQUIRED === 'false') return false;
  const skip = String(caseItem?.skipReason || '').toLowerCase();
  if (VOICE_SKIP_REASONS.has(skip)) return true;
  if (promote.hasPromotableMetrics(hints?.metrics)) return true;
  if (voiceEngine.voiceRequiredForRecruiting() && String(hints?.beatText || '').trim()) return true;
  return false;
}

function isVoiceLayeredCandidate(candidate) {
  if (!candidate?.validationMeta?.voiceEngine) return false;
  const blocks = candidate.validationMeta?.voiceBlocks || {};
  try {
    const voiceQa = require('./voice-qa');
    return voiceQa.hasVoiceLayers(blocks);
  } catch {
    return !!(blocks.context && blocks.strategy && blocks.hook && blocks.cta);
  }
}

async function buildStrategyCandidates(
  caseItem,
  hints,
  identity,
  platformContext,
  opts,
  helpers
) {
  const {
    markDetectivesCandidate,
    buildBeatDrivenCandidate,
    formatResearchContextLine,
    formatResearchInsiderLine
  } = helpers;

  const strategies = [];
  const beatText = hints.beatText;
  const slug = identity.playerSlug;
  const name = identity.playerName;
  const copyMod = require('../x-autoposter-copy');
  const qa = require('./recruiting-post-qa');
  const beatDrivenOnly = !!(platformContext && !platformContext.hasFutureCastContext);
  const m = hints.metrics || {};
  const voiceRequired = voiceRequiredForCase(caseItem, hints);

  if (beatText) {
    try {
      if (promote.hasPromotableMetrics(m) || voiceRequired) {
        const voiceRaw = await promote.buildVoicePromoteCandidate({
          caseItem,
          hints,
          identity,
          platformContext,
          research: opts.research || null
        });
        if (voiceRaw?.text) {
          const marked = markDetectivesCandidate(voiceRaw, caseItem, 'voice_promote', hints, platformContext);
          if (qa.passesPublishGate(marked)) {
            strategies.push(marked);
          } else if (caseItem?.id) {
            store.appendLog(caseItem.id, {
              phase: 'strategy_reject',
              path: 'voice_promote',
              reason: qa.rejectReason(marked)
            });
          }
        }
      }
    } catch {
      /* optional */
    }
  }

  if (beatText && (slug || name)) {
    try {
      const eliteCaption = require('../x-autoposter-elite-caption');
      const built = await eliteCaption.buildElitePlayerPost({
        playerName: name,
        playerSlug: slug,
        beatText,
        publishedAt: hints.publishedAt,
        intel: {
          playerName: name,
          playerSlug: slug,
          eventType: 'recruiting',
          detail: beatText,
          classYear: identity.classYear,
          sourceEventCreatedAt: hints.publishedAt,
          sourcePublishedAt: hints.publishedAt,
          publishedAt: hints.publishedAt,
          ufRpmPct: m.rpm,
          visitStart: m.visitDate || m.visitStart,
          rewriteMetrics: m
        },
        sourceLabel: hints.writerName || 'Beat intel'
      });
      if (built?.ok && built.text && built.validationMeta?.voiceEngine) {
        const marked = markDetectivesCandidate(
          {
            text: built.text,
            category: 'news',
            topic: 'recruiting',
            urgencyLabel: 'major_beat',
            sourceEventType: 'detectives_elite_caption',
            sources: [
              { label: 'On3', url: SITE_URL },
              { label: hints.writerName || 'Beat', url: hints.url || SITE_URL }
            ],
            playerName: built.playerName || name,
            playerSlug: built.playerSlug || slug,
            templateBlocks: built.templateBlocks,
            validationMeta: built.validationMeta,
            identityConfirmed: true
          },
          caseItem,
          'elite_caption',
          hints,
          platformContext
        );
        if (qa.passesPublishGate(marked)) strategies.push(marked);
      }
    } catch {
      /* optional */
    }
  }

  if (!voiceRequired) {
    if (beatText && name && slug && copyMod.isValidPlayerName(name)) {
      if (beatDrivenOnly || !strategies.length) {
        const beatDriven = buildBeatDrivenCandidate(caseItem, hints, identity, platformContext);
        if (beatDriven) strategies.push(beatDriven);
      }
    }

    if (!beatDrivenOnly) {
      try {
        const research = require('../x-autoposter-elite-research');
        const pack = await research.researchUpdate({
          playerSlug: slug,
          playerName: name,
          beatText,
          sourceLabel: hints.writerName || 'Beat',
          eventType: 'recruiting'
        });
        if (
          pack?.hasUsableSignal &&
          platformContext?.hasFutureCastContext &&
          slug &&
          name &&
          copyMod.isValidPlayerName(name)
        ) {
          const insiderLine = formatResearchInsiderLine(pack.breakdown?.recruitingStory, beatText, hints, identity);
          if (insiderLine) {
            const contextLine = formatResearchContextLine(pack.ufPosition, beatText, hints, identity);
            if (contextLine) {
              const idLine = `${identity.classYear ? `${identity.classYear} ` : ''}${name}${identity.pos ? ` ${identity.pos}` : ''}`.trim();
              if (idLine && qa.identityLineValid(idLine, name)) {
                const url = `${SITE_URL}/vault/futurecast/player/${slug}`;
                const marked = markDetectivesCandidate(
                  {
                    text: [idLine, contextLine, insiderLine, url].join('\n'),
                    category: 'news',
                    topic: 'recruiting',
                    urgencyLabel: 'major_beat',
                    sourceEventType: 'detectives_elite_research',
                    sources: [{ label: 'On3', url: SITE_URL }],
                    playerName: pack.playerName || name,
                    playerSlug: pack.playerSlug || slug,
                    templateBlocks: { identity: idLine, context: contextLine, insider: insiderLine },
                    identityConfirmed: true
                  },
                  caseItem,
                  'elite_research',
                  hints,
                  platformContext
                );
                if (qa.passesPublishGate(marked)) strategies.push(marked);
              }
            }
          }
        }
      } catch {
        /* optional */
      }

      try {
        const ladder = require('./research-ladder');
        const raw = {
          text: beatText,
          beatText,
          playerName: name,
          playerSlug: slug,
          source: 'auto:beat-intel',
          sourceEventType: 'beat_intel',
          sourceLabel: hints.writerName || 'Beat',
          sources: [{ label: 'On3', url: SITE_URL }],
          sourceEventCreatedAt: hints.publishedAt || new Date().toISOString()
        };
        const ladderCand = await ladder.buildResearchLadderCandidate(raw, caseItem.skipReason || 'beat_skip');
        if (ladderCand?.text && qa.passesPublishGate(ladderCand)) {
          strategies.push(markDetectivesCandidate(ladderCand, caseItem, 'research_ladder', hints, platformContext));
        }
      } catch {
        /* optional */
      }
    }

    if (slug && name && copyMod.isValidPlayerName(name)) {
      try {
        const entry = require('../scouting-database').getEntryBySlug(slug);
        if (entry?.scoutingSummary) {
          const idLine = `${identity.classYear ? `${identity.classYear} ` : ''}${entry.playerName || name}${entry.pos ? ` ${entry.pos}` : ''}`.trim();
          if (qa.identityLineValid(idLine, entry.playerName || name)) {
            const contextLine = `Florida scout file on ${entry.playerName || name} matches the beat momentum on this board name.`;
            const insiderLine = String(entry.scoutingSummary).trim().slice(0, 140);
            const url = beatDrivenOnly
              ? platformContext?.url || require('./detectives-platform').resolvePlayerPlatformUrl(slug, false)
              : `${SITE_URL}/vault/futurecast/player/${slug}`;
            const marked = markDetectivesCandidate(
              {
                text: [idLine, contextLine, insiderLine, url].join('\n'),
                category: 'news',
                topic: 'recruiting',
                urgencyLabel: 'analysis',
                sourceEventType: 'detectives_scouting',
                sources: [{ label: 'GatorVault Scout', url: SITE_URL }],
                playerName: entry.playerName || name,
                playerSlug: slug,
                templateBlocks: { identity: idLine, context: contextLine, insider: insiderLine },
                identityConfirmed: true
              },
              caseItem,
              'scouting_db',
              hints,
              platformContext
            );
            if (qa.passesPublishGate(marked)) strategies.push(marked);
          }
        }
      } catch {
        /* optional */
      }
    }
  }

  let filtered = strategies.filter((s) => s?.text && qa.passesPublishGate(s));
  if (voiceRequired) {
    filtered = filtered.filter((s) => isVoiceLayeredCandidate(s));
  }
  return filtered;
}

module.exports = {
  voiceRequiredForCase,
  isVoiceLayeredCandidate,
  buildStrategyCandidates
};
