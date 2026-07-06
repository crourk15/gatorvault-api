/** Known UF NIL collectives — unresolved entity blocks NIL posts. */
const NIL_ENTITIES = Object.freeze([
  { id: 'florida-victorious', names: ['Florida Victorious', 'Florida Victorious NIL'] },
  { id: 'gator-boost', names: ['Gator Boost', 'Gator Boost NIL'] },
  { id: 'gator-collective', names: ['Gator Collective', 'The Gator Collective'] },
  { id: 'gator-guard', names: ['Gator Guard', 'Gator Guard Collective'] },
  { id: 'gatorville-nil', names: ['Gatorville NIL', 'Gatorville'] }
]);

function resolveNilEntity(beatText = '') {
  const beat = String(beatText || '');
  for (const row of NIL_ENTITIES) {
    for (const name of row.names) {
      const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (re.test(beat)) return { id: row.id, name: row.names[0] };
    }
  }
  const m = beat.match(/\b([A-Z][A-Za-z0-9&' .-]{2,40}(?:Victorious|Collective|Boost|Guard|NIL))\b/);
  if (!m) return null;
  const candidate = String(m[1]).trim();
  for (const row of NIL_ENTITIES) {
    if (row.names.some((n) => n.toLowerCase() === candidate.toLowerCase())) {
      return { id: row.id, name: row.names[0] };
    }
  }
  return null;
}

module.exports = { NIL_ENTITIES, resolveNilEntity };