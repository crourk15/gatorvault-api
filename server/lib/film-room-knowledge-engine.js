/**
 * Film Room Knowledge Engine — translator-only composer.
 * All output text is assembled from verified database fields. No AI invention.
 */
const store = require('./film-room-knowledge-store');
const validator = require('./film-room-knowledge-validator');
const sourcePolicy = require('./film-room-knowledge-source');

function bullets(items) {
  return (items || []).filter(Boolean).map((s) => `• ${String(s).trim()}`);
}

function section(title, lines) {
  const body = (lines || []).filter(Boolean);
  if (!body.length) return null;
  return `${title}\n${body.join('\n')}`;
}

function composeLessonContent(resolved) {
  const parts = [];
  const { lesson, concept, scheme, opponent, fitRule, traits, fitTraits } = resolved;

  parts.push(lesson.summary);

  if (concept) {
    parts.push(
      section('Concept', [
        `${concept.name}: ${concept.definition}`,
        ...bullets(concept.coaching_points),
        concept.strengths?.length ? `Strengths: ${concept.strengths.join('; ')}` : null,
        concept.weaknesses?.length ? `Weaknesses: ${concept.weaknesses.join('; ')}` : null,
        concept.examples?.length ? `Examples: ${concept.examples.join('; ')}` : null
      ])
    );
  }

  if (scheme) {
    parts.push(
      section('UF Scheme Usage', [
        `Unit: ${scheme.unit}`,
        scheme.usage_description,
        scheme.notes ? `Notes: ${scheme.notes}` : null,
        scheme.frequency != null ? `Frequency: ${scheme.frequency}% of install` : null
      ])
    );
  }

  if (opponent) {
    parts.push(
      section('Opponent Tendency', [
        `${opponent.opponent}: ${opponent.usage_description}`,
        opponent.notes ? `Notes: ${opponent.notes}` : null,
        opponent.frequency != null ? `Frequency: ${opponent.frequency}%` : null
      ])
    );
  }

  if (fitRule) {
    parts.push(
      section('Recruiting Fit', [
        `Position: ${fitRule.position}`,
        fitRule.scheme_fit_notes,
        fitRule.body_type ? `Body type: ${fitRule.body_type}` : null,
        fitRule.technical_requirements?.length
          ? `Technical: ${fitRule.technical_requirements.join('; ')}`
          : null
      ])
    );
  }

  const allTraits = [...(traits || []), ...(fitTraits || [])];
  const seen = new Set();
  const uniqueTraits = allTraits.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
  if (uniqueTraits.length) {
    parts.push(
      section('Position Traits', uniqueTraits.map((t) => `${t.trait_name} (${t.position}): ${t.definition}`))
    );
  }

  const citations = sourcePolicy.collectSourcesFromResolved(resolved);
  if (citations.length) {
    parts.push(
      section(
        'Verified Sources',
        citations.map((s) => sourcePolicy.formatSourceCitation(s))
      )
    );
  }

  return parts.filter(Boolean).join('\n\n');
}

function buildDiagramSpec(resolved) {
  const { concept, scheme, opponent } = resolved;
  const nodes = [];
  const edges = [];

  if (concept) nodes.push({ id: concept.id, label: concept.name, type: 'concept' });
  if (scheme) {
    nodes.push({ id: scheme.id, label: `${scheme.unit} usage`, type: 'scheme' });
    if (concept) edges.push({ from: scheme.id, to: concept.id, label: 'implements' });
  }
  if (opponent) {
    nodes.push({ id: opponent.id, label: opponent.opponent, type: 'opponent' });
    if (concept) edges.push({ from: opponent.id, to: concept.id, label: 'attacks with' });
  }

  if (!nodes.length) return null;
  return { type: 'concept_map', nodes, edges };
}

function renderLesson(lessonId) {
  const check = validator.validateLessonId(lessonId);
  if (!check.ok) return check;

  const body = composeLessonContent(check);
  const diagram = buildDiagramSpec(check);

  const sources = sourcePolicy.collectSourcesFromResolved(check);

  return {
    ok: true,
    skipped: false,
    mode: 'translator',
    id: check.lesson.id,
    lessonType: check.lesson.lesson_type,
    category: store.lessonTypeLabel(check.lesson.lesson_type),
    title: check.concept?.name || check.lesson.summary.slice(0, 80),
    summary: check.lesson.summary,
    body,
    diagram,
    lastVerified: check.lesson.last_verified,
    sources,
    references: {
      conceptId: check.lesson.concept_id,
      ufSchemeId: check.lesson.uf_scheme_id,
      opponentId: check.lesson.opponent_id,
      recruitingFitId: check.lesson.recruiting_fit_id,
      playerTraitIds: check.lesson.player_trait_ids || []
    }
  };
}

function listValidatedLessons() {
  const lessons = store.listLessons();
  const published = [];
  for (const lesson of lessons) {
    const rendered = renderLesson(lesson.id);
    if (rendered.ok) published.push(rendered);
  }
  return published;
}

function getPolicy() {
  const manifest = store.loadKnowledge().manifest;
  return {
    engine: 'film-room-knowledge-engine',
    version: manifest.version,
    mode: 'translator_only',
    description: manifest.description,
    validationPolicy: manifest.validationPolicy,
    approvedSources: manifest.approvedSources,
    charlesExcluded: true,
    catalog: store.listCatalog(),
    noExternalVideo: true
  };
}

module.exports = {
  composeLessonContent,
  buildDiagramSpec,
  renderLesson,
  listValidatedLessons,
  getPolicy
};
