function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Display name when ingest left `name` blank (e.g. merrick-ham → Merrick Ham). */
function nameFromSlug(slug) {
  const base = String(slug || '')
    .trim()
    .replace(/-\d+$/, '');
  if (!base) return '';
  return base
    .split('-')
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 2) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

module.exports = { slugify, nameFromSlug };
