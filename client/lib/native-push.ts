/**
 * Capacitor Push Notifications (APNs) for the App Store shell.
 */
import { getApiBase, nativeNavigationUrl } from '@/lib/api-base';
import { loadSession } from '@/lib/auth-api';
import type { AlertPushPrefs } from '@/lib/push-alerts-api';

function authHeaders(): HeadersInit {
  const session = loadSession();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  return headers;
}

async function postDeviceToken(token: string, prefs: AlertPushPrefs) {
  const res = await fetch(`${getApiBase()}/api/push/device`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      token,
      platform: 'ios',
      prefs,
    }),
  });
  if (res.status === 401) return { ok: false as const, reason: 'sign_in' };
  if (res.status === 403) return { ok: false as const, reason: 'membership' };
  if (!res.ok) return { ok: false as const, reason: 'server' };
  return { ok: true as const };
}

export async function registerNativePush(
  prefs: AlertPushPrefs
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      return { ok: false, reason: 'denied' };
    }

    const tokenPromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('token_timeout')), 20_000);
      void PushNotifications.addListener('registration', (token) => {
        clearTimeout(timeout);
        resolve(token.value);
      });
      void PushNotifications.addListener('registrationError', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    await PushNotifications.register();
    const token = await tokenPromise;
    return postDeviceToken(token, prefs);
  } catch {
    return { ok: false, reason: 'unsupported' };
  }
}

export async function unregisterNativePush(): Promise<void> {
  try {
    await fetch(`${getApiBase()}/api/push/device/unregister`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ platform: 'ios' }),
    }).catch(() => undefined);
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.removeAllListeners().catch(() => undefined);
  } catch {
    /* plugin missing */
  }
}

/** Deep-link when user taps a notification (call from native shell boot). */
export async function initNativePushTapHandler(): Promise<void> {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = (action.notification?.data || {}) as { url?: string; path?: string };
      const raw = data.url || data.path || '/vault/alerts/';
      const href = String(raw).startsWith('http')
        ? String(raw)
        : nativeNavigationUrl(String(raw));
      window.location.href = href;
    });
  } catch {
    /* ok on web */
  }
}
