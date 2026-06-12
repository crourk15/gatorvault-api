/**
 * Self-Runner 3.0 — JSON schemas loaded from blueprints/json-schemas.json
 */
const loader = require('./blueprint-loader');

const SCHEMAS = loader.jsonSchemas();

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
  resolveSchemaPath,
  predeploySchemaPaths: loader.predeploySchemaPaths
};
