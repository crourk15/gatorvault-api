/**
 * Self-Runner 2.0 — JSON schema definitions for /data files.
 */

const SCHEMAS = {
  'data/roster/players.json': {
    label: 'UF Roster',
    type: 'array',
    itemSchema: {
      slug: { type: 'string', required: true, minLength: 2 },
      name: { type: 'string', required: true, minLength: 2 },
      pos: { type: 'string', required: true },
      year: { type: 'string', required: false },
      class: { type: 'string', required: false },
      rating: { type: 'number', required: false, min: 0, max: 100 },
      stars: { type: 'number', required: false, min: 0, max: 5 },
      strengths: { type: 'array', required: false },
      weaknesses: { type: 'array', required: false },
      projection: { type: 'string', required: false },
      schemeFit: { type: 'string', required: false }
    },
    minItems: 1,
    criticalIfEmpty: true,
    snapshotKey: 'roster-players'
  },
  'data/coaching-staff.json': {
    label: 'Coaching Staff',
    type: 'object',
    fields: {
      version: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
      coaches: { type: 'array', required: true, minLength: 1 }
    },
    itemSchema: {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      title: { type: 'string', required: true },
      unit: { type: 'string', required: true },
      bio: { type: 'string', required: true }
    },
    arrayField: 'coaches',
    criticalIfEmpty: true,
    snapshotKey: 'coaching-staff'
  },
  'data/live/feed-items.json': {
    label: 'Live Feed Items',
    type: 'array',
    itemSchema: {
      id: { type: 'string', required: true },
      type: { type: 'string', required: true },
      title: { type: 'string', required: true },
      createdAt: { type: 'string', required: true },
      dedupeKey: { type: 'string', required: false },
      hash: { type: 'string', required: false },
      hashWindowSec: { type: 'number', required: false }
    },
    minItems: 0,
    criticalIfEmpty: false,
    snapshotKey: 'feed-items'
  },
  'data/recruiting/players.json': {
    label: 'Recruiting Board',
    type: 'array',
    itemSchema: {
      slug: { type: 'string', required: true, minLength: 2 },
      name: { type: 'string', required: true, minLength: 2 },
      pos: { type: 'string', required: false },
      classYear: { type: 'number', required: false, min: 2024, max: 2032 },
      stars: { type: 'number', required: false, min: 0, max: 5 },
      rating: { type: 'number', required: false, min: 0, max: 100 },
      status: { type: 'string', required: false },
      category: { type: 'string', required: false }
    },
    minItems: 0,
    criticalIfEmpty: false,
    snapshotKey: 'recruiting-players',
    alias: 'data/recruiting-board.json'
  },
  'data/war-room/breakdowns.json': {
    label: 'War Room Breakdowns',
    type: 'object',
    fields: {
      version: { type: 'number', required: false },
      updatedAt: { type: 'string', required: false },
      breakdowns: { type: 'object', required: true }
    },
    criticalIfEmpty: false,
    snapshotKey: 'war-room-breakdowns',
    alias: 'data/war-room.json'
  },
  'data/war-room/scouting-database.json': {
    label: 'Scouting Database',
    type: 'object',
    fields: {
      version: { type: 'number', required: false },
      updatedAt: { type: 'string', required: false },
      entries: { type: 'object', required: true }
    },
    itemSchema: {
      playerId: { type: 'string', required: true },
      playerSlug: { type: 'string', required: true },
      playerName: { type: 'string', required: true },
      analystName: { type: 'string', required: false },
      sourceType: { type: 'string', required: false, enum: ['NFL', 'College'] },
      timestamp: { type: 'string', required: false },
      scoutingSummary: { type: 'string', required: false }
    },
    objectField: 'entries',
    criticalIfEmpty: false,
    snapshotKey: 'scouting-database',
    alias: 'data/scouting-reports.json'
  }
};

const RELATIONSHIPS = [
  {
    id: 'war-room-roster',
    description: 'War Room roster players must exist in roster/players.json',
    from: 'data/war-room/breakdowns.json',
    fromPath: 'breakdowns.*.playerSlug',
    to: 'data/roster/players.json',
    toPath: 'slug',
    when: (entry) => entry?.playerType === 'roster'
  },
  {
    id: 'war-room-recruiting',
    description: 'War Room recruit/commit players must exist in recruiting/players.json',
    from: 'data/war-room/breakdowns.json',
    fromPath: 'breakdowns.*.playerSlug',
    to: 'data/recruiting/players.json',
    toPath: 'slug',
    when: (entry) => ['recruit', 'commit', 'target', 'portal'].includes(entry?.playerType)
  },
  {
    id: 'scouting-db-recruiting',
    description: 'Scouting DB college entries must map to recruiting or roster',
    from: 'data/war-room/scouting-database.json',
    fromPath: 'entries.*.playerSlug',
    to: 'data/recruiting/players.json',
    toPath: 'slug',
    when: (entry) => entry?.playerType !== 'roster'
  }
];

function allSchemaPaths() {
  return Object.keys(SCHEMAS);
}

function resolveSchemaPath(relPath) {
  const norm = relPath.replace(/^\//, '');
  if (SCHEMAS[norm]) return norm;
  const hit = Object.entries(SCHEMAS).find(([, s]) => s.alias === norm);
  return hit ? hit[0] : null;
}

module.exports = {
  SCHEMAS,
  RELATIONSHIPS,
  allSchemaPaths,
  resolveSchemaPath
};
