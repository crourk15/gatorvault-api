'use client';

import { getApiBase, isNativeApp } from './api-base';
import { loadSession } from './auth-api';

const AUTH_ONLY = ['/vault/login', '/vault/auth/callback', '/auth/callback', '/join'];
const SAME_PATH_MS = 8_000;

let lastPath = '';
let lastAt = 0;

function sanitizePath(raw?: string | null): string | null {
  if (typeof window === 'undefined') return null;
  let s = String(raw || window.location.pathname || '').trim();
  if (!s) return null;
  s = s.split('?')[0].split('#')[0].replace(/\/index\.html$/i, '/');
  if (s.length > 1) s = s.replace(/\/+$/, '');
  if (!s.startsWith('/vault')) return null;
  if (AUTH_ONLY.some((p) => s === p || s.startsWith(`${p}/`))) return null;
  return s;
}

/** Fire-and-forget page ping for Admin Hub last-seen / trail. Never throws. */
export function pingMemberActivity(pathname?: string | null): void {
  if (typeof window === 'undefined') return;
  const session = loadSession();
  if (!session?.token || !session.email) return;

  const path = sanitizePath(pathname);
  if (!path) return;

  const now = Date.now();
  if (path === lastPath && now - lastAt < SAME_PATH_MS) return;
  lastPath = path;
  lastAt = now;

  const run = async () => {
    try {
      await fetch(`${getApiBase()}/api/member-activity/ping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
          'X-GV-Client': isNativeApp() ? 'ios' : 'website',
        },
        body: JSON.stringify({
          path,
          client: isNativeApp() ? 'ios' : 'website',
        }),
        cache: 'no-store',
        keepalive: true,
      });
    } catch {
      /* ignore — last-seen is best-effort */
    }
  };

  void run();
}
