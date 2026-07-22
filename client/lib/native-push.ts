/**
 * Capacitor Push Notifications (APNs) for the App Store shell.
 */
import { getApiBase } from '@/lib/api-base';
import { loadSession } from '@/lib/auth-api';
import { navigateVaultHref } from '@/lib/navigate-vault-href';
import type { AlertPushPrefs } from '@/lib/push-alerts-api';

type TokenWaiter = {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
};

let registrationWired = false;
let tapHandlerWired = false;
let tokenWaiters: TokenWaiter[] = [];

function authHeaders(): HeadersInit {
  const session = loadSession();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  return headers;
}

async function postDeviceToken(
  token: string,
  prefs: AlertPushPrefs,
  options: { confirm?: boolean } = {}
) {
  const res = await fetch(`${getApiBase()}/api/push/device`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      token,
      platform: 'ios',
      prefs,
      // Default true: Save Preferences proves APNs on existing App Store builds.
      confirm: options.confirm !== false,
    }),
  });
  if (res.status === 401) return { ok: false as const, reason: 'sign_in' };
  if (res.status === 403) return { ok: false as const, reason: 'membership' };
  if (!res.ok) return { ok: false as const, reason: 'server' };
  return { ok: true as const };
}

async function ensureRegistrationListeners(
  PushNotifications: typeof import('@capacitor/push-notifications').PushNotifications
): Promise<void> {
  if (registrationWired) return;
  registrationWired = true;
  await PushNotifications.addListener('registration', (token) => {
    const waiters = tokenWaiters;
    tokenWaiters = [];
    for (const w of waiters) {
      clearTimeout(w.timeout);
      w.resolve(token.value);
    }
  });
  await PushNotifications.addListener('registrationError', (err) => {
    const waiters = tokenWaiters;
    tokenWaiters = [];
    for (const w of waiters) {
      clearTimeout(w.timeout);
      w.reject(err);
    }
  });
}

export async function registerNativePush(
  prefs: AlertPushPrefs,
  options: { confirm?: boolean } = {}
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

    await ensureRegistrationListeners(PushNotifications);

    const token = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('token_timeout')), 20_000);
      tokenWaiters.push({ resolve, reject, timeout });
      void PushNotifications.register();
    });

    await initNativePushTapHandler();
    return postDeviceToken(token, prefs, options);
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
    registrationWired = false;
    tapHandlerWired = false;
    tokenWaiters = [];
  } catch {
    /* plugin missing */
  }
}

/** Deep-link when user taps a notification (call from native shell boot). */
export async function initNativePushTapHandler(): Promise<void> {
  if (tapHandlerWired) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    tapHandlerWired = true;
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = (action.notification?.data || {}) as { url?: string; path?: string };
      const raw = data.url || data.path || '/vault/alerts/';
      navigateVaultHref(String(raw));
    });
  } catch {
    tapHandlerWired = false;
  }
}
