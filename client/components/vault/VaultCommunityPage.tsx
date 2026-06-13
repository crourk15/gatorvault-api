'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  createCommunityThread,
  fetchCommunityCategories,
  fetchCommunityPulse,
  fetchCommunityThread,
  fetchCommunityThreads,
  fetchLiveRooms,
  type CommunityCategory,
  type CommunityPost,
  type CommunityPulse,
  type CommunityThread,
  type LiveRoom,
} from '@/lib/community-api';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

type SortId = 'trending' | 'recent' | 'active' | 'replies';

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function VaultCommunityPage(): React.ReactElement {
  const [sort, setSort] = useState<SortId>('trending');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<CommunityCategory[]>([]);
  const [threads, setThreads] = useState<CommunityThread[]>([]);
  const [pulse, setPulse] = useState<CommunityPulse | null>(null);
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newCategory, setNewCategory] = useState('locker');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, rows, pulseData, liveRooms] = await Promise.all([
        fetchCommunityCategories(),
        fetchCommunityThreads({ sort, category: category || undefined, limit: 40 }),
        fetchCommunityPulse(),
        fetchLiveRooms(),
      ]);
      setCategories(cats);
      setThreads(rows);
      setPulse(pulseData);
      setRooms(liveRooms);
      if (cats.length && !newCategory) setNewCategory(cats[0].slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load community.');
    } finally {
      setLoading(false);
    }
  }, [sort, category, newCategory]);

  useEffect(() => {
    void load();
  }, [load]);

  const openThread = useCallback(async (id: string) => {
    setSelectedId(id);
    try {
      const data = await fetchCommunityThread(id);
      setSelectedPosts(data.posts);
    } catch {
      setSelectedPosts([]);
    }
  }, []);

  const submitThread = async () => {
    if (!newTitle.trim() || !newBody.trim()) return;
    setPosting(true);
    setPostError(null);
    try {
      await createCommunityThread({
        title: newTitle.trim(),
        body: newBody.trim(),
        category: newCategory,
      });
      setNewTitle('');
      setNewBody('');
      setShowForm(false);
      await load();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Could not post thread.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="gv-community" data-testid="vault-community">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Community</h1>
        <p className="gv-page-subtitle">
          Member-led talk, game week analysis, recruiting debate, and insider reaction.
        </p>
      </div>

      <div className="gv-community__layout">
        <div className="gv-community__main">
          <div className="gv-community__toolbar">
            <div className="gv-alert-choices">
              {(['trending', 'recent', 'active', 'replies'] as SortId[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`gv-alert-choice${sort === s ? ' is-active' : ''}`}
                  onClick={() => setSort(s)}
                >
                  {s === 'trending' ? '🔥 Trending' : s === 'recent' ? '🕐 Recent' : s === 'active' ? '📈 Active' : '💬 Replies'}
                </button>
              ))}
            </div>
            <select
              className="gv-community__select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
            <button type="button" className="gv-community__new-btn" onClick={() => setShowForm((v) => !v)}>
              + New Thread
            </button>
          </div>

          {showForm && (
            <div className="gv-community__form">
              <input
                className="gv-alert-input"
                placeholder="Thread title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                maxLength={200}
              />
              <textarea
                className="gv-alert-input gv-community__textarea"
                placeholder="Start the conversation…"
                rows={3}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
              />
              <select
                className="gv-community__select"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
              {postError ? <p className="gv-community__post-error">{postError}</p> : null}
              <button type="button" className="gv-alert-save-btn" disabled={posting} onClick={() => void submitThread()}>
                {posting ? 'Posting…' : 'Post Thread'}
              </button>
            </div>
          )}

          {loading && <p className="gv-page-status">Loading threads…</p>}
          {error && !loading && (
            <UiError message={error} retry={() => void load()} backHref="/vault" backLabel="← Vault" />
          )}

          {!loading && !error && selectedId && (
            <div className="gv-community__thread-detail">
              <button type="button" className="gv-film-back" onClick={() => setSelectedId(null)}>
                ← All threads
              </button>
              <ul className="gv-community__posts">
                {selectedPosts.map((p) => (
                  <li key={p.id} className="gv-community__post">
                    <p className="gv-community__post-author">{p.authorDisplay || 'Member'}</p>
                    <p className="gv-community__post-body">{p.body}</p>
                    <p className="gv-community__post-meta">{timeAgo(p.createdAt)}</p>
                  </li>
                ))}
                {selectedPosts.length === 0 && <UiEmpty message="No replies yet." />}
              </ul>
            </div>
          )}

          {!loading && !error && !selectedId && (
            <ul className="gv-community__threads">
              {threads.map((t) => (
                <li key={t.id}>
                  <button type="button" className="gv-community__thread-row" onClick={() => void openThread(t.id)}>
                    <span className="gv-community__thread-title">
                      {t.pinned ? '📌 ' : ''}
                      {t.title}
                    </span>
                    <span className="gv-community__thread-meta">
                      {t.categoryLabel || t.categorySlug || 'General'} · {t.replyCount ?? 0} replies ·{' '}
                      {timeAgo(t.lastActivityAt || t.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
              {threads.length === 0 && <UiEmpty message="No threads yet — start the conversation." />}
            </ul>
          )}
        </div>

        <aside className="gv-community__aside">
          <section className="gv-community__panel">
            <h2 className="gv-vault-alerts__section-title">Live Rooms</h2>
            {rooms.map((r) => (
              <div key={r.id} className="gv-community__room">
                <p className="gv-community__room-title">{r.title}</p>
                {r.description ? <p className="gv-community__room-desc">{r.description}</p> : null}
                {r.scheduledAt ? (
                  <p className="gv-community__room-meta">{new Date(r.scheduledAt).toLocaleString()}</p>
                ) : null}
              </div>
            ))}
            {rooms.length === 0 && !loading && <p className="gv-page-status">No live rooms scheduled.</p>}
          </section>

          <section className="gv-community__panel">
            <h2 className="gv-vault-alerts__section-title">Community Pulse</h2>
            {pulse ? (
              <div className="gv-community__pulse-grid">
                <div className="gv-recruit-stat">
                  <span>Threads</span>
                  <strong>{pulse.threadCount ?? '—'}</strong>
                </div>
                <div className="gv-recruit-stat">
                  <span>Posts</span>
                  <strong>{pulse.postCount ?? '—'}</strong>
                </div>
                <div className="gv-recruit-stat">
                  <span>Active today</span>
                  <strong>{pulse.activeToday ?? '—'}</strong>
                </div>
              </div>
            ) : (
              <p className="gv-page-status">Loading pulse…</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
