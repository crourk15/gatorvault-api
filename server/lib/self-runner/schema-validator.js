/**
 * Self-Runner 2.0 — schema validator for /data JSON files.
 */
const fs = require('fs');
const path = require('path');
const blueprint = require('./blueprint/canonical-blueprint');
const logger = require('./self-runner-logger');
const patches = require('./self-runner-patches');

const SNAPSHOT_DIR = path.join(patches.SERVER_ROOT, 'data', 'ops', 'self-runner-snapshots');

function readJsonRel(relPath) {
  const abs = patches.absPath(relPath);
  if (!fs.existsSync(abs)) return { ok: false, error: 'file_missing', path: relPath, data: null };
  try {
    const raw = fs.readFileSync(abs, 'utf8').trim();
    if (!raw || raw === '{}') {
      return { ok: true, path: relPath, data: null, empty: true, raw };
    }
    return { ok: true, path: relPath, data: JSON.parse(raw), empty: false };
  } catch (e) {
    return { ok: false, error: 'json_parse_error', path: relPath, detail: e.message, data: null };
  }
}

function checkType(value, spec) {
  if (value == null) return spec.required ? 'missing' : null;
  if (spec.type === 'string' && typeof value !== 'string') return 'wrong_type';
  if (spec.type === 'number' && typeof value !== 'number') return 'wrong_type';
  if (spec.type === 'array' && !Array.isArray(value)) return 'wrong_type';
  if (spec.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) return 'wrong_type';
  if (spec.type === 'string' && spec.minLength && String(value).length < spec.minLength) return 'too_short';
  if (spec.type === 'number' && spec.min != null && value < spec.min) return 'out_of_range';
  if (spec.type === 'number' && spec.max != null && value > spec.max) return 'out_of_range';
  if (spec.enum && !spec.enum.includes(value)) return 'invalid_enum';
  return null;
}

function validateItem(item, itemSchema, ctx) {
  const violations = [];
  Object.entries(itemSchema || {}).forEach(([field, spec]) => {
    const err = checkType(item?.[field], spec);
    if (err) {
      violations.push({
        path: ctx.path,
        field,
        issue: err,
        expected: spec.type,
        actual: typeof item?.[field]
      });
    }
  });
  return violations;
}

function validateSchemaFile(relPath, schema) {
  const loaded = readJsonRel(relPath);
  const violations = [];

  if (!loaded.ok) {
    violations.push({ severity: 'critical', path: relPath, issue: loaded.error, detail: loaded.detail });
    return { path: relPath, violations, loaded, critical: true };
  }

  if (loaded.empty || loaded.data == null) {
    if (schema.criticalIfEmpty) {
      violations.push({
        severity: 'critical',
        path: relPath,
        issue: 'empty_or_null',
        detail: `${relPath} is empty or {} — restore from snapshot`
      });
    }
    return { path: relPath, violations, loaded, critical: violations.some((v) => v.severity === 'critical') };
  }

  const data = loaded.data;

  if (schema.type === 'array') {
    if (!Array.isArray(data)) {
      violations.push({ severity: 'critical', path: relPath, issue: 'wrong_root_type', expected: 'array' });
    } else {
      if (schema.minItems != null && data.length < schema.minItems) {
        violations.push({
          severity: schema.criticalIfEmpty ? 'critical' : 'high',
          path: relPath,
          issue: 'too_few_items',
          count: data.length,
          min: schema.minItems
        });
      }
      data.slice(0, 500).forEach((item, i) => {
        violations.push(...validateItem(item, schema.itemSchema, { path: `${relPath}[${i}]` }));
      });
    }
  } else if (schema.type === 'object') {
    Object.entries(schema.fields || {}).forEach(([field, spec]) => {
      const err = checkType(data[field], spec);
      if (err) {
        violations.push({
          severity: 'high',
          path: relPath,
          field,
          issue: err,
          expected: spec.type
        });
      }
    });

    const arrField = schema.arrayField;
    if (arrField && Array.isArray(data[arrField])) {
      data[arrField].slice(0, 200).forEach((item, i) => {
        violations.push(...validateItem(item, schema.itemSchema, { path: `${relPath}.${arrField}[${i}]` }));
      });
    }

    const objField = schema.objectField;
    if (objField && data[objField] && typeof data[objField] === 'object') {
      Object.entries(data[objField]).slice(0, 200).forEach(([key, item]) => {
        violations.push(...validateItem(item, schema.itemSchema, { path: `${relPath}.${objField}.${key}` }));
      });
    }
  }

  return {
    path: relPath,
    violations: violations.map((v) => ({ severity: v.severity || 'medium', ...v })),
    loaded,
    critical: violations.some((v) => v.severity === 'critical')
  };
}

function saveSnapshot(relPath, data, reason) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const key = blueprint.json.SCHEMAS[relPath]?.snapshotKey || relPath.replace(/[^\w]+/g, '-');
  const file = path.join(SNAPSHOT_DIR, `${key}.json`);
  const payload = { savedAt: new Date().toISOString(), reason, path: relPath, data };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  logger.log.restore({ path: relPath, snapshot: file, reason });
  return file;
}

function restoreFromSnapshot(relPath) {
  const key = blueprint.json.SCHEMAS[relPath]?.snapshotKey || relPath.replace(/[^\w]+/g, '-');
  const file = path.join(SNAPSHOT_DIR, `${key}.json`);
  if (!fs.existsSync(file)) return { ok: false, error: 'no_snapshot' };
  const snap = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!snap.data) return { ok: false, error: 'snapshot_empty' };
  const abs = patches.absPath(relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(snap.data, null, 2));
  logger.log.restore({ path: relPath, from: file, action: 'restored' });
  return { ok: true, restoredAt: snap.savedAt, path: relPath };
}

function maybeSnapshotGood(relPath, loaded) {
  if (!loaded?.data || loaded.empty) return null;
  const schema = blueprint.json.SCHEMAS[relPath];
  if (!schema) return null;
  const result = validateSchemaFile(relPath, schema);
  if (result.critical || result.violations.length > 10) return null;
  return saveSnapshot(relPath, loaded.data, 'known_good');
}

function validateRelationships(fileData) {
  const violations = [];
  const slugSets = {};

  function loadSlugs(relPath, field) {
    if (slugSets[relPath]) return slugSets[relPath];
    const loaded = readJsonRel(relPath);
    if (!loaded.ok || !loaded.data) {
      slugSets[relPath] = new Set();
      return slugSets[relPath];
    }
    let slugs = [];
    if (Array.isArray(loaded.data)) {
      slugs = loaded.data.map((r) => r[field || 'slug']).filter(Boolean);
    }
    slugSets[relPath] = new Set(slugs);
    return slugSets[relPath];
  }

  blueprint.json.RELATIONSHIPS.forEach((rel) => {
    const fromLoaded = fileData[rel.from] || readJsonRel(rel.from);
    const fromData = fromLoaded.data || fromLoaded;
    if (!fromData) return;

    const targetSlugs = loadSlugs(rel.to, rel.toPath);

    if (rel.from.includes('breakdowns') && fromData.breakdowns) {
      Object.values(fromData.breakdowns).forEach((entry) => {
        if (rel.when && !rel.when(entry)) return;
        if (entry?.playerSlug && !targetSlugs.has(entry.playerSlug)) {
          violations.push({
            severity: 'high',
            relationship: rel.id,
            issue: 'broken_relationship',
            playerSlug: entry.playerSlug,
            from: rel.from,
            to: rel.to,
            detail: rel.description
          });
        }
      });
    }

    if (rel.from.includes('scouting-database') && fromData.entries) {
      Object.values(fromData.entries).forEach((entry) => {
        if (rel.when && !rel.when(entry)) return;
        const rosterSlugs = loadSlugs('data/roster/players.json', 'slug');
        const recruitSlugs = loadSlugs('data/recruiting/players.json', 'slug');
        const ok = rosterSlugs.has(entry.playerSlug) || recruitSlugs.has(entry.playerSlug);
        if (entry?.playerSlug && !ok) {
          violations.push({
            severity: 'medium',
            relationship: rel.id,
            issue: 'orphan_scouting_entry',
            playerSlug: entry.playerSlug,
            detail: rel.description
          });
        }
      });
    }
  });

  return violations;
}

function validateAllDataFiles() {
  const results = [];
  const allViolations = [];

  blueprint.json.allSchemaPaths().forEach((relPath) => {
    const schema = blueprint.json.SCHEMAS[relPath];
    const result = validateSchemaFile(relPath, schema);
    results.push(result);
    allViolations.push(...result.violations.map((v) => ({ ...v, file: relPath })));

    if (!result.critical && result.loaded?.data && !result.loaded.empty) {
      maybeSnapshotGood(relPath, result.loaded);
    }

    if (result.critical && result.loaded?.empty && schema.snapshotKey) {
      const restored = restoreFromSnapshot(relPath);
      if (restored.ok) {
        allViolations.push({
          severity: 'info',
          file: relPath,
          issue: 'auto_restored_from_snapshot',
          restoredAt: restored.restoredAt
        });
      }
    }

    result.violations.forEach((v) => {
      logger.log.schema({ file: relPath, ...v });
    });
  });

  const relViolations = validateRelationships({});
  allViolations.push(...relViolations);

  return {
    ok: !allViolations.some((v) => v.severity === 'critical'),
    results,
    violations: allViolations,
    criticalCount: allViolations.filter((v) => v.severity === 'critical').length
  };
}

function buildSchemaPatch(violation) {
  const relPath = violation.file || violation.path;
  if (!relPath) return null;

  if (violation.issue === 'empty_or_null') {
    return {
      patchType: 'schema-restore',
      riskLevel: 'medium',
      edits: [{ file: relPath, type: 'restore-json-snapshot', snapshotKey: blueprint.json.SCHEMAS[relPath]?.snapshotKey }],
      suggestedFix: `Restore ${relPath} from last known good snapshot`
    };
  }

  if (violation.field && violation.issue === 'missing') {
    const defaults = {
      slug: 'pending-slug',
      name: 'Pending Name',
      pos: 'ATH',
      createdAt: new Date().toISOString(),
      id: `sr_${Date.now()}`,
      type: 'unknown',
      title: 'Untitled',
      version: 1,
      updatedAt: new Date().toISOString()
    };
    return {
      patchType: 'schema-field',
      riskLevel: 'low',
      edits: [
        {
          file: relPath,
          type: 'json-add-field',
          itemPath: violation.path,
          field: violation.field,
          value: defaults[violation.field] ?? null
        }
      ],
      suggestedFix: `Add missing field "${violation.field}" to ${violation.path}`
    };
  }

  return null;
}

module.exports = {
  SNAPSHOT_DIR,
  readJsonRel,
  validateSchemaFile,
  validateAllDataFiles,
  validateRelationships,
  saveSnapshot,
  restoreFromSnapshot,
  buildSchemaPatch
};
