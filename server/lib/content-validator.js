const fs = require('fs');
const path = require('path');

const OFFICIAL_PATH = path.join(__dirname, '..', 'data', 'official-names.json');
const LOG_PATH = path.join(__dirname, '..', 'data', 'content', 'validation-log.json');

const TOKEN_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadOfficialNames() {
  return readJson(OFFICIAL_PATH, { coaches: {}, staff: {}, players: [], blockedNames: [], ignoreTerms: [] });
}

function fmtField(value, prefix) {
  if (value == null || value === '' || value === 'null' || Number.isNaN(Number(value))) return '—';
  return prefix ? `${prefix}${value}` : String(value);
}

function resolveTokenPath(official, tokenPath) {
  const parts = String(tokenPath || '').split('.');
  if (!parts.length) return null;
  const root = parts[0];
  const key = parts[1];
  if (!key) return null;
  if (root === 'coach' && official.coaches && official.coaches[key]) {
    return official.coaches[key].name;
  }
  if (root === 'staff' && official.staff && official.staff[key]) {
    return official.staff[key].name;
  }
  if (root === 'former' && official.formerCoaches && official.formerCoaches[key]) {
    return official.formerCoaches[key].name;
  }
  if (root === 'player' && parts[1]) {
    const slug = parts.slice(1).join('.');
    const p = (official.players || []).find((x) => x.slug === slug);
    return p ? p.name : null;
  }
  return null;
}

function resolveTokens(text, official) {
  if (!text) return text;
  const data = official || loadOfficialNames();
  return String(text).replace(TOKEN_RE, (match, tokenPath) => {
    const resolved = resolveTokenPath(data, tokenPath);
    return resolved != null ? resolved : match;
  });
}

function mergeRecruitingPlayers(official) {
  const playersPath = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');
  const recruits = readJson(playersPath, []);
  const merged = { ...official, players: [...(official.players || [])] };
  const slugs = new Set(merged.players.map((p) => p.slug));
  recruits.forEach((r) => {
    const slug = r.slug || String(r.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (!slugs.has(slug) && r.name) {
      merged.players.push({ slug, name: r.name, pos: r.pos || '' });
      slugs.add(slug);
    }
  });
  return merged;
}

function buildAllowlist(official) {
  const names = new Set();
  const add = (n) => {
    if (n && String(n).trim()) names.add(String(n).trim());
  };

  Object.values(official.coaches || {}).forEach((c) => {
    add(c.name);
    (c.aliases || []).forEach(add);
    const parts = (c.name || '').split(' ');
    if (parts.length > 1) add(parts[parts.length - 1]);
  });
  Object.values(official.staff || {}).forEach((s) => {
    add(s.name);
    (s.aliases || []).forEach(add);
  });
  Object.values(official.formerCoaches || {}).forEach((c) => {
    add(c.name);
    (c.aliases || []).forEach(add);
  });
  (official.players || []).forEach((p) => {
    add(p.name);
    const parts = (p.name || '').split(' ');
    if (parts.length >= 2) add(parts[parts.length - 1].replace(/\.$/, ''));
  });
  (official.editorial?.authors || []).forEach(add);
  (official.editorial?.brands || []).forEach(add);
  (official.ignoreTerms || []).forEach(add);
  (official.knownPhrases || []).forEach(add);

  return names;
}

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function extractCandidateNames(text) {
  const plain = stripHtml(text).replace(TOKEN_RE, ' ');
  const found = new Set();
  const re = /\b([A-Z][a-z]+(?:[''][A-Z][a-z]+)?(?:\s+(?:Jr\.|III|II|IV|Sr\.))?|\b[A-Z]{2,3}\s+[A-Z][a-z]+(?:\s+Jr\.)?)/g;
  let m;
  while ((m = re.exec(plain)) !== null) {
    const name = m[0].trim();
    if (name.length >= 3) found.add(name);
  }
  const multiRe = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}(?:\s+Jr\.|\s+III|\s+II)?)\b/g;
  while ((m = multiRe.exec(plain)) !== null) {
    const name = m[1].trim();
    if (name.length >= 5) found.add(name);
  }
  return [...found];
}

const SC_CONTEXT_RE = /(?:S\s*&\s*C|strength\s*(?:&|and)\s*conditioning|strength\s+coach|director\s+of\s+strength|revamped\s+S\s*&\s*C)/i;

function isScContext(text, name) {
  const raw = String(text || '');
  const idx = raw.toLowerCase().indexOf(String(name).toLowerCase());
  if (idx < 0) return false;
  const window = raw.slice(Math.max(0, idx - 140), Math.min(raw.length, idx + name.length + 140));
  return SC_CONTEXT_RE.test(window) || /S&C\s+staff/i.test(window) || /under\s+{{?\s*staff\.SC/i.test(raw);
}

function validateScMisuse(fieldName, text, official) {
  const errors = [];
  const raw = String(text || '');
  const blockedSc = official.blockedScNames || ['Anthony Harris', 'Coach Harris'];

  blockedSc.forEach((name) => {
    if (!raw.includes(name)) return;
    if (isScContext(raw, name)) {
      errors.push({
        field: fieldName,
        type: 'blocked_sc_coach',
        message:
          `${name} is the DBs coach, not S&C. Use {{ staff.SC }} for Rusty Whitt (or {{ coach.DB }} for DB references).`
      });
    }
  });

  if (/Anthony\s+Harris/i.test(raw) && SC_CONTEXT_RE.test(raw)) {
    const already = errors.some((e) => e.type === 'blocked_sc_coach');
    if (!already) {
      errors.push({
        field: fieldName,
        type: 'blocked_sc_coach',
        message:
          'Anthony Harris named in S&C context. Use {{ staff.SC }} for Rusty Whitt (head S&C coach).'
      });
    }
  }

  return errors;
}

function isCoachLikeName(name, official) {
  const lower = name.toLowerCase();
  if (lower.includes('faulkner') && !official.coaches?.OC?.name?.toLowerCase().includes(name.toLowerCase())) {
    return true;
  }
  if (/^coach\s/i.test(name) && !/^coach\s+harris$/i.test(name)) return true;
  return false;
}

function validateTextField(fieldName, text, official, allowlist) {
  const errors = [];
  const raw = String(text || '');

  (official.blockedNames || []).forEach((blocked) => {
    if (raw.includes(blocked)) {
      errors.push({ field: fieldName, type: 'blocked', message: `Blocked name: ${blocked}` });
    }
  });

  errors.push(...validateScMisuse(fieldName, raw, official));

  const withoutTokens = raw.replace(TOKEN_RE, ' ');
  extractCandidateNames(withoutTokens).forEach((name) => {
    if (allowlist.has(name)) return;
    if ((official.ignoreTerms || []).some((t) => t.toLowerCase() === name.toLowerCase())) return;

    const coachBucket = { ...official.coaches, ...official.staff, ...official.formerCoaches };
    const looksLikePerson = /^[A-Z]/.test(name) && name.split(' ').length <= 4;

    if (!looksLikePerson) return;

    if (isCoachLikeName(name, official)) {
      errors.push({
        field: fieldName,
        type: 'unknown_coach',
        message: `Unknown coach name: ${name}. Use tokens like {{ coach.OC }} or add to official-names.json.`
      });
      return;
    }

    if (name.split(' ').length >= 2) {
      errors.push({
        field: fieldName,
        type: 'unknown_name',
        message: `Unknown name: ${name}. Add to official-names.json or use a token.`
      });
    }
  });

  TOKEN_RE.lastIndex = 0;
  let tm;
  while ((tm = TOKEN_RE.exec(raw)) !== null) {
    const resolved = resolveTokenPath(official, tm[1]);
    if (resolved == null) {
      errors.push({
        field: fieldName,
        type: 'invalid_token',
        message: `Unknown token: {{ ${tm[1]} }}`
      });
    }
  }

  return errors;
}

function validateContentItem(item, official) {
  const data = mergeRecruitingPlayers(official || loadOfficialNames());
  const allowlist = buildAllowlist(data);
  const errors = [];
  const fields = {
    title: item.title,
    excerpt: item.excerpt,
    body: item.body
  };
  if (Array.isArray(item.takeaways)) {
    item.takeaways.forEach((t, i) => {
      fields[`takeaways[${i}]`] = t;
    });
  }

  Object.entries(fields).forEach(([field, text]) => {
    if (!text) return;
    errors.push(...validateTextField(field, text, data, allowlist));
  });

  return {
    valid: errors.length === 0,
    errors,
    resolved: resolveContentItem(item, data)
  };
}

function resolveContentItem(item, official) {
  const data = official || loadOfficialNames();
  const out = { ...item };
  ['title', 'excerpt', 'body'].forEach((k) => {
    if (out[k]) out[k] = resolveTokens(out[k], data);
  });
  if (Array.isArray(out.takeaways)) {
    out.takeaways = out.takeaways.map((t) => resolveTokens(t, data));
  }
  return out;
}

function logValidationFailure(entry) {
  const log = readJson(LOG_PATH, []);
  const row = {
    ts: new Date().toISOString(),
    ...entry
  };
  log.unshift(row);
  writeJson(LOG_PATH, log.slice(0, 200));
  console.warn('[content-validation]', row.message || row.action, row.errors || '');
  return row;
}

module.exports = {
  loadOfficialNames,
  resolveTokens,
  resolveTokenPath,
  resolveContentItem,
  validateContentItem,
  validateTextField,
  logValidationFailure,
  fmtField,
  TOKEN_RE,
  OFFICIAL_PATH,
  LOG_PATH
};
