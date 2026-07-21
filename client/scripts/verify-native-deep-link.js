#!/usr/bin/env node
/**
 * Guard native deep-link path parsing (no browser needed).
 */
const assert = require('assert');

const OWN_HOSTS = new Set(['gatorvaultinsider.com', 'www.gatorvaultinsider.com', 'localhost']);

function toAppRelativeHref(href) {
  if (!href) return href;
  try {
    if (href.startsWith('/')) return href;
    const u = new URL(href);
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return href;
  }
}

function vaultPathFromOpenUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) {
    const path = toAppRelativeHref(trimmed);
    return path.startsWith('/') ? path : null;
  }
  try {
    const url = new URL(trimmed);
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
    if (isHttp) {
      if (!OWN_HOSTS.has(url.hostname) && url.hostname !== '127.0.0.1') return null;
      const path = toAppRelativeHref(`${url.pathname}${url.search}${url.hash}`);
      return path.startsWith('/') ? path : null;
    }
    const host = url.hostname || '';
    const combined = host
      ? `/${host}${url.pathname || '/'}${url.search}${url.hash}`
      : `${url.pathname || '/'}${url.search}${url.hash}`;
    const path = toAppRelativeHref(combined.startsWith('/') ? combined : `/${combined}`);
    return path.startsWith('/') ? path : null;
  } catch {
    return null;
  }
}

assert.strictEqual(
  vaultPathFromOpenUrl('https://gatorvaultinsider.com/vault/film-room/'),
  '/vault/film-room/'
);
assert.strictEqual(vaultPathFromOpenUrl('/vault/alerts/'), '/vault/alerts/');
assert.strictEqual(vaultPathFromOpenUrl('https://evil.example/vault/'), null);
assert.strictEqual(
  vaultPathFromOpenUrl('com.gatorvaultinsider.app://vault/recruiting/'),
  '/vault/recruiting/'
);

console.log('[verify-native-deep-link] OK');
