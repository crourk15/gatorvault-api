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

  it('apply-supabase-rls script covers sensitive tables + policy drop', () => {
    const js = fs.readFileSync(path.join(ROOT, 'scripts/apply-supabase-rls.js'), 'utf8');
    assert.match(js, /SENSITIVE_PUBLIC_TABLES/);
    assert.match(js, /push_device_tokens/);
    assert.match(js, /DROP POLICY/);
    assert.match(js, /024_lockdown_supabase_api/);
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
