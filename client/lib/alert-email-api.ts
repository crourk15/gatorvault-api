import { getApiBase } from '@/lib/big-board-api';
import { loadSession } from '@/lib/auth-api';
import type { AlertFreq, AlertMethod } from '@/lib/alert-prefs';

export type EmailAlertPrefsPayload = {
  method: AlertMethod;
  freq: AlertFreq;
  visit: boolean;
  followPlayers: string[];
};

function authHeaders(): HeadersInit {
  const session = loadSession();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  return headers;
}

export async function syncEmailAlertPrefs(
  prefs: EmailAlertPrefsPayload
): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(`${getApiBase()}/api/alerts/email-preferences`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ prefs }),
  });

  if (res.status === 401) return { ok: false, reason: 'sign_in' };
  if (res.status === 403) return { ok: false, reason: 'membership' };
  if (!res.ok) return { ok: false, reason: 'server' };

  return { ok: true };
}

/** Email + push a verified scheduled OV to the signed-in member (Brysen by default). */
export async function sendVisitAlertToMe(
  slug = 'brysen-wright'
): Promise<{ ok: boolean; reason?: string; hint?: string; emailSent?: boolean; pushSent?: number }> {
  const res = await fetch(`${getApiBase()}/api/alerts/send-visit-alert`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ slug }),
  });
  if (res.status === 401) return { ok: false, reason: 'sign_in' };
  if (res.status === 403) return { ok: false, reason: 'membership' };
  if (!res.ok) return { ok: false, reason: 'server' };
  const data = (await res.json()) as {
    ok?: boolean;
    hint?: string | null;
    email?: { sent?: boolean };
    push?: { sent?: number; error?: string };
  };
  return {
    ok: Boolean(data.ok),
    reason: data.push?.error === 'no_devices' ? 'no_devices' : undefined,
    hint: data.hint || undefined,
    emailSent: Boolean(data.email?.sent),
    pushSent: Number(data.push?.sent || 0),
  };
}