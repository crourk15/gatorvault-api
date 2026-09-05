/**
 * Member last-seen + short page trail (Admin Hub).
 * Separate durable JSON — never write users.json on navigation.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { signupChannelFromReq } = require('./member-attribution');

const BUNDLE_DIR = path.join(__dirname, '..', 'data', 'member-activity');
const RENDER_DIR = '/var/data/member-activity';
const FILE_NAME = 'activity.json';
const TRAIL_CAP = 40;
const RETAIN_MS = 14 * 24 * 60 * 60 * 1000;
const SAME_PATH_DEBOUNCE_MS = 8 * 1000;
const SESSION_DEBOUNCE_MS = 60 * 1000;
const MAX_PATH = 96;
const SYNTHETIC_PATHS = new Set(['/login', '/session']);

function resolveActivityDir() {
  const fromEnv = String(process.env.GV_MEMBER_ACTIVITY_DIR || '').trim();
  if (fromEnv) return fromEnv;
  const ops = String(process.env.GV_OPS_DATA_DIR || '').trim();
  if (ops) return path.join(ops, 'member-activity');
  try {
    if (process.env.NODE_ENV === 'production' && fs.existsSync('/var/data')) {
      return RENDER_DIR;
    }
  } catch {
    /* ignore */
  }
  return BUNDLE_DIR;
}

function activityPath() {
  return path.join(resolveActivityDir(), FILE_NAME);
}

function emptyDoc() {
  return { updatedAt: null, members: {} };
}

function readDoc() {
  try {
    const raw = JSON.parse(fs.readFileSync(activityPath(), 'utf8'));
    if (!raw || typeof raw !== 'object') return emptyDoc();
    if (!raw.members || typeof raw.members !== 'object') raw.members = {};
    return raw;
  } catch {
    return emptyDoc();
  }
}

function writeDoc(doc) {
  const dir = resolveActivityDir();
  fs.mkdirSync(dir, { recursive: true });
  const dest = activityPath();
  const tmp = `${dest}.${process.pid}.tmp`;
  const payload = JSON.stringify(doc);
  fs.writeFileSync(tmp, payload);
  fs.renameSync(tmp, dest);
}

/**
 * @param {unknown} raw
 * @returns {string|null}
 */
function sanitizeActivityPath(raw) {
  let s = String(raw == null ? '' : raw).trim();
  if (!s) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    try {
      s = new URL(s).pathname;
    } catch {
      return null;
    }
  }
  s = s.split('?')[0].split('#')[0];
  s = s.replace(/\\/g, '/');
  s = s.replace(/\/index\.html$/i, '/');
  s = s.replace(/\/{2,}/g, '/');
  if (s.length > 1) s = s.replace(/\/+$/, '');
  if (!s.startsWith('/')) s = `/${s}`;
  if (s.length > MAX_PATH) s = s.slice(0, MAX_PATH);
  if (SYNTHETIC_PATHS.has(s)) return s;
  if (!s.startsWith('/vault')) return null;
  const segs = s.split('/').slice(2);
  if (segs.some((seg) => !seg || seg === '.' || seg === '..')) return null;
  if (!/^\/vault(?:\/[A-Za-z0-9][A-Za-z0-9._~\-]*)*$/.test(s)) return null;
  return s;
}

/**
 * @param {unknown} raw
 * @returns {'ios'|'website'|'unknown'}
 */
function sanitizeActivityClient(raw) {
  const key = String(raw == null ? '' : raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (key === 'ios' || key === 'iphone' || key === 'ipad' || key === 'native' || key === 'app') {
    return 'ios';
  }
  if (key === 'web' || key === 'website' || key === 'browser') return 'website';
  return 'unknown';
}

function activityClientFromReq(req) {
  return sanitizeActivityClient(signupChannelFromReq(req));
}

function pruneDoc(doc, nowMs) {
  const cutoff = nowMs - RETAIN_MS;
  const next = {};
  for (const [email, row] of Object.entries(doc.members || {})) {
    if (!row || typeof row !== 'object') continue;
    const last = Date.parse(row.lastSeenAt || '');
    if (!Number.isFinite(last) || last < cutoff) continue;
    const trail = Array.isArray(row.trail) ? row.trail : [];
    row.trail = trail
      .filter((hit) => {
        const at = Date.parse(hit?.at || '');
        return Number.isFinite(at) && at >= cutoff;
      })
      .slice(0, TRAIL_CAP);
    next[email] = row;
  }
  doc.members = next;
}

/**
 * @param {{ email: string, name?: string|null, path?: string|null, client?: string|null, at?: string }} opts
 */
function recordMemberActivity(opts) {
  const email = String(opts?.email || '')
    .trim()
    .toLowerCase();
  if (!email || !email.includes('@')) return { recorded: false, reason: 'email' };

  const pathKey = sanitizeActivityPath(opts?.path);
  if (!pathKey) return { recorded: false, reason: 'path' };

  const client = sanitizeActivityClient(opts?.client);
  const at = opts?.at && Number.isFinite(Date.parse(opts.at)) ? new Date(opts.at).toISOString() : new Date().toISOString();
  const atMs = Date.parse(at);
  const name = String(opts?.name || '').trim().slice(0, 80) || null;

  const doc = readDoc();
  pruneDoc(doc, atMs);
  const prev = doc.members[email] || null;
  const lastAt = prev ? Date.parse(prev.lastSeenAt || '') : NaN;
  const debounceMs = pathKey === '/session' ? SESSION_DEBOUNCE_MS : SAME_PATH_DEBOUNCE_MS;
  if (
    prev &&
    prev.lastPath === pathKey &&
    Number.isFinite(lastAt) &&
    atMs - lastAt < debounceMs
  ) {
    return { recorded: false, reason: 'debounce', email, path: pathKey };
  }

  const hit = { at, path: pathKey, client };
  const trail = Array.isArray(prev?.trail) ? prev.trail.slice() : [];
  trail.unshift(hit);
  if (trail.length > TRAIL_CAP) trail.length = TRAIL_CAP;

  doc.members[email] = {
    email,
    name: name || prev?.name || null,
    lastSeenAt: at,
    lastPath: pathKey,
    lastClient: client,
    trail,
  };
  doc.updatedAt = at;
  writeDoc(doc);
  return { recorded: true, email, path: pathKey, client, at };
}

function recordFromReq(req, opts) {
  return recordMemberActivity({
    email: opts?.email,
    name: opts?.name,
    path: opts?.path,
    client: opts?.client || activityClientFromReq(req),
    at: opts?.at,
  });
}

function safeRecordFromReq(req, opts) {
  try {
    return recordFromReq(req, opts);
  } catch (err) {
    console.warn('member-activity record failed', err?.message || err);
    return { recorded: false, reason: 'error' };
  }
}

/**
 * @param {{ sinceMs?: number, limit?: number }} opts
 */
function listActivity(opts = {}) {
  const sinceMs = Number.isFinite(opts.sinceMs) ? opts.sinceMs : Date.now() - 24 * 60 * 60 * 1000;
  const limit = Math.min(Math.max(parseInt(String(opts.limit ?? 80), 10) || 80, 1), 200);
  const doc = readDoc();
  const rows = Object.values(doc.members || {})
    .filter((row) => {
      const last = Date.parse(row?.lastSeenAt || '');
      return Number.isFinite(last) && last >= sinceMs;
    })
    .sort((a, b) => Date.parse(b.lastSeenAt || '') - Date.parse(a.lastSeenAt || ''));

  return {
    updatedAt: doc.updatedAt || null,
    members: rows.slice(0, limit),
    total: rows.length,
    returned: Math.min(rows.length, limit),
  };
}

function trailHitsSince(row, sinceMs) {
  const trail = Array.isArray(row?.trail) ? row.trail : [];
  return trail.filter((hit) => {
    const at = Date.parse(hit?.at || '');
    return Number.isFinite(at) && at >= sinceMs;
  });
}

module.exports = {
  sanitizeActivityPath,
  sanitizeActivityClient,
  activityClientFromReq,
  recordMemberActivity,
  recordFromReq,
  safeRecordFromReq,
  listActivity,
  trailHitsSince,
  SAME_PATH_DEBOUNCE_MS,
  SESSION_DEBOUNCE_MS,
  TRAIL_CAP,
};
