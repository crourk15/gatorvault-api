/**
 * Ensures Supabase lockdown SQL stays in repo for Advisor remediation.
 * Run: node --test server/tests/supabase-rls-lockdown.test.js
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

describe('supabase RLS lockdown', () => {
  it('ships paste-ready 024 migration with RLS + revoke + default privileges', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'migrations/024_lockdown_supabase_api.sql'),
      'utf8'
    );
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /push_subscriptions/);
    assert.match(sql, /push_device_tokens/);
    assert.match(sql, /alert_email_preferences/);
    assert.match(sql, /REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated/);
    assert.match(sql, /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon/);
    assert.match(sql, /sensitive_columns_exposed/);
  });

  it('lib + apply script cover sensitive tables + policy drop', () => {
    const lib = fs.readFileSync(path.join(ROOT, 'lib/supabase-rls-lockdown.js'), 'utf8');
    assert.match(lib, /SENSITIVE_PUBLIC_TABLES/);
    assert.match(lib, /push_device_tokens/);
    assert.match(lib, /DROP POLICY/);
    assert.match(lib, /scheduleSupabaseRlsLockdownOnBoot/);
    assert.match(lib, /applySupabaseRlsLockdown/);

    const js = fs.readFileSync(path.join(ROOT, 'scripts/apply-supabase-rls.js'), 'utf8');
    assert.match(js, /supabase-rls-lockdown/);
    assert.match(js, /024_lockdown_supabase_api/);
  });

  it('boot + admin hub wire lockdown apply', () => {
    const serverJs = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    assert.match(serverJs, /scheduleSupabaseRlsLockdownOnBoot/);

    const hub = fs.readFileSync(path.join(ROOT, 'lib/admin-hub-routes.js'), 'utf8');
    assert.match(hub, /\/api\/admin\/hub\/security\/rls-status/);
    assert.match(hub, /\/api\/admin\/hub\/security\/lockdown-rls/);
  });

  it('exports schedule/apply helpers', () => {
    const rls = require('../lib/supabase-rls-lockdown');
    assert.equal(typeof rls.applySupabaseRlsLockdown, 'function');
    assert.equal(typeof rls.getSupabaseRlsStatus, 'function');
    assert.equal(typeof rls.scheduleSupabaseRlsLockdownOnBoot, 'function');
    assert.ok(rls.SENSITIVE_PUBLIC_TABLES.includes('push_device_tokens'));
  });

  it('push/email table migrations enable RLS at create time', () => {
    for (const rel of [
      'migrations/020_create_push_subscriptions.sql',
      'migrations/021_create_alert_email_preferences.sql',
      'migrations/022_create_push_device_tokens.sql',
    ]) {
      const sql = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      assert.match(sql, /ENABLE ROW LEVEL SECURITY/, rel);
    }
  });
});
