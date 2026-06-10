/**
 * Film Room Knowledge Engine — strict validation layer.
 * If ANY required field is missing → skip output. AI = translator only.
 * Charles Power / GatorVault Film Desk / AI are NOT valid knowledge sources.
 */
const store = require('./film-room-knowledge-store');
const sourcePolicy = require('./film-room-knowledge-source');

const SKIP = {
  CONCEPT_NOT_FOUND: 'concept_not_in_database',
  CONCEPT_INCOMPLETE: 'concept_missing_required_fields',
  SCHEME_NOT_FOUND: 'scheme_not_in_database',
  SCHEME_INCOMPLETE: 'scheme_missing_usage_description',
  TRAIT_NOT_FOUND: 'trait_not_in_database',
  TRAIT_INCOMPLETE: 'trait_missing_definition',
  OPPONENT_NOT_FOUND: 'opponent_tendency_not_in_database',
  OPPONENT_INCOMPLETE: 'opponent_tendency_incomplete',
  FIT_NOT_FOUND: 'recruiting_fit_rule_not_in_database',
  FIT_INCOMPLETE: 'recruiting_fit_rule_incomplete',
  LESSON_NOT_FOUND: 'lesson_not_in_database',
  LESSON_INCOMPLETE: 'lesson_missing_required_references',
  NOT_VERIFIED: 'record_not_human_verified',
  SOURCE_INCOMPLETE: 'source_missing_required_fields',
  SOURCE_LOW_CONFIDENCE: 'source_confidence_below_threshold',
  SOURCE_BLOCKED: 'source_blocked_not_coaching_verified',
  SOURCE_TYPE_INVALID: 'source_type_not_approved',
  EMPTY: 'empty_request'
};

function skip(reason, detail = null, extra = {}) {
  return { ok: false, skipped: true, reason, detail, ...extra };
}

function ok(data = {}) {
  return { ok: true, skipped: false, ...data };
}

function hasVerifiedTimestamp(row) {
  return !!(row?.last_verified && !Number.isNaN(new Date(row.last_verified).getTime()));
}

function validateSourceRow(row, table) {
  const check = sourcePolicy.validateSourceMetadata(row, { table });
  if (check.ok) return ok({ source: check.source });

  const reasonMap = {
    source_incomplete: SKIP.SOURCE_INCOMPLETE,
    source_low_confidence: SKIP.SOURCE_LOW_CONFIDENCE,
    source_blocked: SKIP.SOURCE_BLOCKED,
    source_type_invalid: SKIP.SOURCE_TYPE_INVALID
  };

  return skip(reasonMap[check.reason] || SKIP.SOURCE_INCOMPLETE, check.detail, {
    field: check.field,
    table: check.table || table,
    ...(check.blocked ? { blocked: check.blocked } : {}),
    ...(check.confidence != null ? { confidence: check.confidence, minimum: check.minimum } : {}),
    ...(check.value ? { value: check.value } : {})
  });
}

function validateConceptRow(concept, { requireCoachingPoints = true } = {}) {
  if (!concept) return skip(SKIP.CONCEPT_NOT_FOUND);
  if (!concept.definition || !String(concept.definition).trim()) {
    return skip(SKIP.CONCEPT_INCOMPLETE, concept.id, { field: 'definition' });
  }
  if (requireCoachingPoints) {
    const cp = concept.coaching_points;
    if (!Array.isArray(cp) || !cp.length || !cp.every((p) => String(p).trim().length >= 8)) {
      return skip(SKIP.CONCEPT_INCOMPLETE, concept.id, { field: 'coaching_points' });
    }
  }
  if (!hasVerifiedTimestamp(concept)) {
    return skip(SKIP.NOT_VERIFIED, concept.id, { table: 'football_concepts' });
  }
  const sourceCheck = validateSourceRow(concept, 'football_concepts');
  if (!sourceCheck.ok) return sourceCheck;
  return ok({ concept });
}

function validateSchemeRow(scheme) {
  if (!scheme) return skip(SKIP.SCHEME_NOT_FOUND);
  if (!scheme.usage_description || !String(scheme.usage_description).trim()) {
    return skip(SKIP.SCHEME_INCOMPLETE, scheme.id, { field: 'usage_description' });
  }
  const conceptCheck = validateConceptRow(store.getConcept(scheme.concept_id));
  if (!conceptCheck.ok) return conceptCheck;
  if (!hasVerifiedTimestamp(scheme)) {
    return skip(SKIP.NOT_VERIFIED, scheme.id, { table: 'uf_scheme_library' });
  }
  const sourceCheck = validateSourceRow(scheme, 'uf_scheme_library');
  if (!sourceCheck.ok) return sourceCheck;
  return ok({ scheme, concept: conceptCheck.concept });
}

function validateTraitRow(trait) {
  if (!trait) return skip(SKIP.TRAIT_NOT_FOUND);
  if (!trait.definition || !String(trait.definition).trim()) {
    return skip(SKIP.TRAIT_INCOMPLETE, trait.id, { field: 'definition' });
  }
  if (!hasVerifiedTimestamp(trait)) {
    return skip(SKIP.NOT_VERIFIED, trait.id, { table: 'player_traits' });
  }
  const sourceCheck = validateSourceRow(trait, 'player_traits');
  if (!sourceCheck.ok) return sourceCheck;
  return ok({ trait });
}

function validateTraitIds(ids) {
  if (!Array.isArray(ids) || !ids.length) return ok({ traits: [] });
  const traits = [];
  for (const id of ids) {
    const check = validateTraitRow(store.getTrait(id));
    if (!check.ok) return check;
    traits.push(check.trait);
  }
  return ok({ traits });
}

function validateOpponentRow(opp) {
  if (!opp) return skip(SKIP.OPPONENT_NOT_FOUND);
  if (!opp.usage_description || !String(opp.usage_description).trim()) {
    return skip(SKIP.OPPONENT_INCOMPLETE, opp.id, { field: 'usage_description' });
  }
  const conceptCheck = validateConceptRow(store.getConcept(opp.concept_id));
  if (!conceptCheck.ok) return conceptCheck;
  if (!hasVerifiedTimestamp(opp)) {
    return skip(SKIP.NOT_VERIFIED, opp.id, { table: 'opponent_tendencies' });
  }
  const sourceCheck = validateSourceRow(opp, 'opponent_tendencies');
  if (!sourceCheck.ok) return sourceCheck;
  return ok({ opponent: opp, concept: conceptCheck.concept });
}

function validateFitRuleRow(rule) {
  if (!rule) return skip(SKIP.FIT_NOT_FOUND);
  if (!rule.scheme_fit_notes || !String(rule.scheme_fit_notes).trim()) {
    return skip(SKIP.FIT_INCOMPLETE, rule.id, { field: 'scheme_fit_notes' });
  }
  if (!hasVerifiedTimestamp(rule)) {
    return skip(SKIP.NOT_VERIFIED, rule.id, { table: 'recruiting_fit_rules' });
  }
  const sourceCheck = validateSourceRow(rule, 'recruiting_fit_rules');
  if (!sourceCheck.ok) return sourceCheck;
  const required = rule.athletic_profile?.required_traits || [];
  const traitCheck = validateTraitIds(required);
  if (!traitCheck.ok) return traitCheck;
  return ok({ rule, traits: traitCheck.traits });
}

function validateLessonRow(lesson) {
  if (!lesson) return skip(SKIP.LESSON_NOT_FOUND);
  if (!lesson.summary || !String(lesson.summary).trim()) {
    return skip(SKIP.LESSON_INCOMPLETE, lesson.id, { field: 'summary' });
  }
  if (!hasVerifiedTimestamp(lesson)) {
    return skip(SKIP.NOT_VERIFIED, lesson.id, { table: 'film_room_lessons' });
  }
  const lessonSourceCheck = validateSourceRow(lesson, 'film_room_lessons');
  if (!lessonSourceCheck.ok) return lessonSourceCheck;

  const resolved = { lesson };

  if (lesson.concept_id) {
    const c = validateConceptRow(store.getConcept(lesson.concept_id));
    if (!c.ok) return c;
    resolved.concept = c.concept;
  } else if (['concept_breakdown', 'scheme_library', 'opponent_prep'].includes(lesson.lesson_type)) {
    return skip(SKIP.LESSON_INCOMPLETE, lesson.id, { field: 'concept_id' });
  }

  if (lesson.uf_scheme_id) {
    const s = validateSchemeRow(store.getScheme(lesson.uf_scheme_id));
    if (!s.ok) return s;
    resolved.scheme = s.scheme;
  }

  if (lesson.opponent_id) {
    const o = validateOpponentRow(store.getOpponentTendency(lesson.opponent_id));
    if (!o.ok) return o;
    resolved.opponent = o.opponent;
    resolved.opponentConcept = o.concept;
  }

  if (lesson.recruiting_fit_id) {
    const f = validateFitRuleRow(store.getFitRule(lesson.recruiting_fit_id));
    if (!f.ok) return f;
    resolved.fitRule = f.rule;
    resolved.fitTraits = f.traits;
  }

  const traitIds = lesson.player_trait_ids || [];
  if (traitIds.length) {
    const t = validateTraitIds(traitIds);
    if (!t.ok) return t;
    resolved.traits = t.traits;
  } else if (lesson.lesson_type === 'position_traits') {
    return skip(SKIP.LESSON_INCOMPLETE, lesson.id, { field: 'player_trait_ids' });
  }

  return ok(resolved);
}

function validateLessonId(lessonId) {
  if (!lessonId) return skip(SKIP.EMPTY);
  return validateLessonRow(store.getLesson(lessonId));
}

module.exports = {
  SKIP,
  skip,
  ok,
  validateSourceRow,
  validateConceptRow,
  validateSchemeRow,
  validateTraitRow,
  validateTraitIds,
  validateOpponentRow,
  validateFitRuleRow,
  validateLessonRow,
  validateLessonId
};
