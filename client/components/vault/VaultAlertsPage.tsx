'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ALERT_CATEGORY_META,
  DEFAULT_ALERT_PREFS,
  loadAlertPrefs,
  loadLocalRecentAlerts,
  markLocalAlertsRead,
  saveAlertPrefs,
  type AlertCategoryId,
  type AlertFreq,
  type AlertMethod,
  type AlertPrefs,
  type LocalRecentAlert,
} from '@/lib/alert-prefs';
import { fetchAlerts, type FutureCastAlert } from '@/lib/alerts-api';
import { playerProfilePath } from '@/lib/player-routes';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

const REFRESH_MS = 60_000;

function ChoiceButtons<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}): React.ReactElement {
  return (
    <div className="gv-alert-choices" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`gv-alert-choice${value === opt.id ? ' is-active' : ''}`}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function VaultAlertsPage(): React.ReactElement {
  const [prefs, setPrefs] = useState<AlertPrefs>(DEFAULT_ALERT_PREFS);
  const [saved, setSaved] = useState(false);
  const [playerInput, setPlayerInput] = useState('');
  const [apiAlerts, setApiAlerts] = useState<FutureCastAlert[]>([]);
  const [localAlerts, setLocalAlerts] = useState<LocalRecentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPrefs(loadAlertPrefs());
    setLocalAlerts(loadLocalRecentAlerts());
  }, []);

  const loadFeed = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    }
    try {
      const rows = await fetchAlerts();
      setApiAlerts(rows);
      setLocalAlerts(loadLocalRecentAlerts());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load alerts.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function run(isInitial: boolean) {
      if (cancelled) return;
      await loadFeed(isInitial);
    }

    void run(true);
    timer = setInterval(() => void run(false), REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [loadFeed]);

  const toggleCategory = (id: AlertCategoryId) => {
    setPrefs((p) => ({
      ...p,
      types: { ...p.types, [id]: !p.types[id] },
    }));
    setSaved(false);
  };

  const handleSave = () => {
    saveAlertPrefs(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const addPlayer = () => {
    const name = playerInput.trim();
    if (!name) return;
    setPrefs((p) => {
      if (p.followPlayers.includes(name)) return p;
      return { ...p, followPlayers: [...p.followPlayers, name] };
    });
    setPlayerInput('');
    setSaved(false);
  };

  const removePlayer = (name: string) => {
    setPrefs((p) => ({
      ...p,
      followPlayers: p.followPlayers.filter((x) => x !== name),
    }));
    setSaved(false);
  };

  const handleMarkAllRead = () => {
    markLocalAlertsRead();
    setLocalAlerts(loadLocalRecentAlerts());
  };

  const categoryKeys = Object.keys(DEFAULT_ALERT_PREFS.types) as AlertCategoryId[];

  return (
    <div className="gv-vault-alerts" data-testid="vault-alerts">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">🔔 My Alerts</h1>
        <p className="gv-page-subtitle">
          Choose what matters to you — commits, portal moves, offers, articles, scores, and
          community threads delivered your way.
        </p>
      </div>

      <div className="gv-vault-alerts__layout">
        <section className="gv-vault-alerts__prefs">
          <h2 className="gv-vault-alerts__section-title">What You Want to Hear About</h2>
          <p className="gv-vault-alerts__section-hint">
            Tap a category to subscribe. Use Save Preferences for delivery settings.
          </p>

          <div className="gv-alert-toggles">
            {categoryKeys.map((id) => {
              const meta = ALERT_CATEGORY_META[id];
              const active = prefs.types[id];
              return (
                <button
                  key={id}
                  type="button"
                  className={`gv-alert-toggle${active ? ' is-active' : ''}`}
                  onClick={() => toggleCategory(id)}
                >
                  {meta.icon} {meta.label}
                </button>
              );
            })}
          </div>

          <div className="gv-vault-alerts__field">
            <p className="gv-vault-alerts__field-label">Notification Method</p>
            <ChoiceButtons<AlertMethod>
              ariaLabel="Notification method"
              value={prefs.method}
              onChange={(method) => {
                setPrefs((p) => ({ ...p, method }));
                setSaved(false);
              }}
              options={[
                { id: 'push', label: 'Push' },
                { id: 'email', label: 'Email' },
                { id: 'both', label: 'Both' },
              ]}
            />
          </div>

          <div className="gv-vault-alerts__field">
            <p className="gv-vault-alerts__field-label">Alert Frequency</p>
            <ChoiceButtons<AlertFreq>
              ariaLabel="Alert frequency"
              value={prefs.freq}
              onChange={(freq) => {
                setPrefs((p) => ({ ...p, freq }));
                setSaved(false);
              }}
              options={[
                { id: 'instant', label: 'Instant' },
                { id: 'daily', label: 'Daily Digest' },
                { id: 'weekly', label: 'Weekly Roundup' },
              ]}
            />
          </div>

          <div className="gv-vault-alerts__field">
            <p className="gv-vault-alerts__field-label">Favorite Players to Track</p>
            <div className="gv-alert-player-input">
              <input
                type="text"
                className="gv-alert-input"
                placeholder="Type a player name and press Enter"
                value={playerInput}
                onChange={(e) => setPlayerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPlayer();
                  }
                }}
              />
            </div>
            {prefs.followPlayers.length > 0 && (
              <ul className="gv-alert-player-tags">
                {prefs.followPlayers.map((name) => (
                  <li key={name} className="gv-alert-player-tag">
                    <span>{name}</span>
                    <button type="button" onClick={() => removePlayer(name)} aria-label={`Remove ${name}`}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button type="button" className="gv-alert-save-btn" onClick={handleSave}>
            {saved ? 'Preferences Saved ✓' : 'Save Preferences'}
          </button>
        </section>

        <section className="gv-vault-alerts__feed">
          <div className="gv-vault-alerts__feed-header">
            <h2 className="gv-vault-alerts__section-title">Your Feed</h2>
            <button type="button" className="gv-alert-mark-read" onClick={handleMarkAllRead}>
              Mark all as read
            </button>
          </div>

          {loading && <p className="gv-page-status">Loading alerts…</p>}

          {!loading && error && (
            <UiError
              title="Alerts unavailable"
              message={error}
              retry={() => void loadFeed(true)}
              backHref="/vault/futurecast/alerts"
              backLabel="← FutureCast Alerts"
            />
          )}

          {!loading && !error && (
            <div className="gv-vault-alerts__feed-list">
              {apiAlerts.map((alert) => (
                <article key={alert.id} className="gv-vault-alert-item">
                  <a
                    href={playerProfilePath(alert.playerSlug, alert.lifecycle, true)}
                    className="gv-vault-alert-item__message"
                  >
                    {alert.message}
                  </a>
                  <p className="gv-vault-alert-item__meta">
                    {alert.type} · {alert.playerName}
                  </p>
                </article>
              ))}

              {localAlerts.map((alert, idx) => (
                <article
                  key={`local-${idx}-${alert._ts ?? idx}`}
                  className={`gv-vault-alert-item${alert.read ? ' is-read' : ''}`}
                >
                  <p className="gv-vault-alert-item__message">{alert.title || alert.text}</p>
                  {alert.type ? (
                    <p className="gv-vault-alert-item__meta">{alert.type}</p>
                  ) : null}
                </article>
              ))}

              {apiAlerts.length === 0 && localAlerts.length === 0 && (
                <UiEmpty
                  message="No alerts yet."
                  hint="Turn on categories on the left, or follow players for personalized updates."
                />
              )}
            </div>
          )}

          <p className="gv-vault-alerts__fc-link">
            <a href="/vault/futurecast/alerts">View FutureCast movement alerts →</a>
          </p>
        </section>
      </div>
    </div>
  );
}
