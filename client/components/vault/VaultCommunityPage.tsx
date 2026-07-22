'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Chip, PageLayout, PageSection } from '@/components/brand';
import { CommunityConfirmModal } from '@/components/community/CommunityConfirmModal';
import { CommunityPostActions } from '@/components/community/CommunityPostActions';
import { CommunityReportModal } from '@/components/community/CommunityReportModal';
import { CommunityToastProvider, useCommunityToast } from '@/components/community/CommunityToast';
import { CommunityPageSkeleton, CommunityThreadSkeleton } from '@/components/community/CommunityPageSkeleton';
import {
  communityAuthorLabel,
  createCommunityReply,
  createCommunityThread,
  fetchCommunityPageData,
  fetchCommunityThread,
  flagCommunityPost,
  flagCommunityThread,
  type CommunityCategory,
  type CommunityPost,
  type CommunityPulse,
  type CommunityThread,
  type LiveRoom,
} from '@/lib/community-api';
import { buildSeedCommunityPageData } from '@/lib/community-hub-seed';
import { fetchWithWarmPoll, userFacingLoadError } from '@/lib/api-warm-poll';
import { warmPollProfile } from '@/lib/warm-poll-profile';
import {
  blockUserEmail,
  isEmailBlocked,
  loadBlockedEmails,
  unblockUserEmail,
  type ReportReasonId,
} from '@/lib/community-ugc';
import { loadSession } from '@/lib/auth-api';
import { UiEmpty, UiError, UiWarming } from '@/components/site/UiMessage';

const SEED_COMMUNITY = buildSeedCommunityPageData();
const HAS_COMMUNITY_SEED =
  SEED_COMMUNITY.categories.length > 0 || SEED_COMMUNITY.threads.length > 0;

type SortId = 'trending' | 'recent' | 'active' | 'replies';

type ReportTarget =
  | { kind: 'post'; post: CommunityPost }
  | { kind: 'thread'; thread: CommunityThread };

type BlockTarget = {
  email: string;
  displayName: string;
};

const FALLBACK_TOPICS = ['2027 board', 'Portal watch', 'Game week keys', 'NIL pulse', 'Film Room'];

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function threadCategoryLabel(thread: CommunityThread): string {
  return thread.category?.name || thread.categoryLabel || thread.categorySlug || 'General';
}

function threadIdFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('thread');
    if (fromQuery) return fromQuery;
    const match = window.location.pathname.match(/\/community\/thread\/([^/]+)\/?$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function VaultCommunityPageInner({ initialThreadId }: { initialThreadId?: string }): React.ReactElement {
  const { pushToast } = useCommunityToast();
  const [sort, setSort] = useState<SortId>('trending');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<CommunityCategory[]>(
    HAS_COMMUNITY_SEED ? SEED_COMMUNITY.categories : []
  );
  const [threads, setThreads] = useState<CommunityThread[]>(
    HAS_COMMUNITY_SEED ? SEED_COMMUNITY.threads : []
  );
  const [pulse, setPulse] = useState<CommunityPulse | null>(
    HAS_COMMUNITY_SEED ? SEED_COMMUNITY.pulse : null
  );
  const [rooms, setRooms] = useState<LiveRoom[]>(HAS_COMMUNITY_SEED ? SEED_COMMUNITY.rooms : []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<CommunityThread | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(!HAS_COMMUNITY_SEED);
  const [warming, setWarming] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newCategory, setNewCategory] = useState('locker');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [replyPosting, setReplyPosting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [blockedEmails, setBlockedEmails] = useState<string[]>([]);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [blockTarget, setBlockTarget] = useState<BlockTarget | null>(null);
  const [moderationLoading, setModerationLoading] = useState(false);

  const session = useMemo(() => loadSession(), []);
  const viewerEmail = session?.email ?? null;
  const canModerate = Boolean(viewerEmail);

  useEffect(() => {
    if (viewerEmail) setBlockedEmails(loadBlockedEmails(viewerEmail));
  }, [viewerEmail]);

  const requireSignIn = useCallback(
    (body = 'Sign in to post, reply, report, or block in Community.'): boolean => {
      if (viewerEmail) return true;
      pushToast({
        kind: 'error',
        title: 'Sign in required',
        body,
      });
      return false;
    },
    [pushToast, viewerEmail],
  );

  const load = useCallback(async () => {
    if (!HAS_COMMUNITY_SEED) {
      setLoading(true);
      setError(null);
    }
    setWarming(true);
    try {
      const data = await fetchCommunityPageData({
        sort,
        category: category || undefined,
        limit: 40,
      });
      setCategories(data.categories.length ? data.categories : SEED_COMMUNITY.categories);
      // Keep founding/seed conversations when live UGC is empty/cold.
      if (data.threads.length > 0) {
        setThreads(data.threads);
      } else if (SEED_COMMUNITY.threads.length > 0) {
        setThreads(SEED_COMMUNITY.threads);
      } else {
        setThreads([]);
      }
      setPulse(data.pulse?.trending != null || data.pulse?.repliesToday != null
        ? data.pulse
        : SEED_COMMUNITY.pulse || data.pulse);
      setRooms(data.rooms.length ? data.rooms : SEED_COMMUNITY.rooms);
      setError(null);
      if (data.categories.length && !newCategory) setNewCategory(data.categories[0].slug);
    } catch (err) {
      if (!HAS_COMMUNITY_SEED) {
        setError(userFacingLoadError(err, 'Could not load community.'));
      }
      // Keep seed shell when live community fetch fails.
    } finally {
      setLoading(false);
      setWarming(false);
    }
  }, [sort, category, newCategory]);

  const openThread = useCallback(async (id: string) => {
    setSelectedId(id);
    setSelectedThread(null);
    setSelectedPosts([]);
    setReplyBody('');
    setReplyError(null);
    setThreadLoading(true);
    if (typeof window !== 'undefined') {
      try {
        const next = `/vault/community/thread/${encodeURIComponent(id)}/`;
        if (!window.location.pathname.includes(`/community/thread/${id}`)) {
          window.history.pushState(null, '', next);
        }
      } catch {
        /* ignore */
      }
    }
    try {
      const data = await fetchWithWarmPoll(() => fetchCommunityThread(id), warmPollProfile());
      setSelectedThread(data.thread);
      setSelectedPosts(data.posts);
    } catch {
      // Founding/seed threads are list-only until live UGC exists — hydrate OP locally.
      const seed = SEED_COMMUNITY.threads.find((t) => t.id === id) || null;
      if (seed) {
        setSelectedThread(seed as CommunityThread);
        setSelectedPosts([]);
      } else {
        setSelectedThread(null);
        setSelectedPosts([]);
      }
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = initialThreadId || threadIdFromLocation();
    if (id) void openThread(id);
  }, [initialThreadId, openThread]);

  const submitThread = async () => {
    if (!newTitle.trim() || !newBody.trim()) return;
    if (!requireSignIn('Sign in to start a Community thread.')) return;
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

  const submitReply = async () => {
    if (!selectedThread?.id || !replyBody.trim()) return;
    if (!requireSignIn()) return;
    setReplyPosting(true);
    setReplyError(null);
    try {
      await createCommunityReply(selectedThread.id, replyBody.trim());
      setReplyBody('');
      await openThread(selectedThread.id);
      await load();
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Could not post reply.');
    } finally {
      setReplyPosting(false);
    }
  };

  const isAuthorBlocked = useCallback(
    (authorEmail?: string | null) => isEmailBlocked(viewerEmail, authorEmail, blockedEmails),
    [blockedEmails, viewerEmail],
  );

  const isOwnAuthor = useCallback(
    (authorEmail?: string | null) =>
      Boolean(viewerEmail && authorEmail && viewerEmail.toLowerCase() === authorEmail.toLowerCase()),
    [viewerEmail],
  );

  const handleReportOpen = (target: ReportTarget) => {
    if (!requireSignIn()) return;
    setReportTarget(target);
  };

  const handleReportSubmit = async (reason: ReportReasonId) => {
    if (!reportTarget) return;
    setModerationLoading(true);
    try {
      if (reportTarget.kind === 'post') {
        await flagCommunityPost(reportTarget.post.id, reason);
        setSelectedPosts((prev) =>
          prev.map((p) => (p.id === reportTarget.post.id ? { ...p, flagged: true } : p)),
        );
      } else {
        await flagCommunityThread(reportTarget.thread.id, reason);
        setSelectedThread((prev) =>
          prev && prev.id === reportTarget.thread.id ? { ...prev, flagged: true } : prev,
        );
      }
      setReportTarget(null);
      pushToast({
        kind: 'success',
        title: 'Report submitted',
        body: 'Thanks — our team will review this content.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      if (/already reported/i.test(message)) {
        setReportTarget(null);
        pushToast({
          kind: 'success',
          title: 'Already reported',
          body: 'Our team is reviewing this content.',
        });
        return;
      }
      pushToast({
        kind: 'error',
        title: 'Could not submit report',
        body: message,
      });
    } finally {
      setModerationLoading(false);
    }
  };

  const handleBlockOpen = (target: BlockTarget) => {
    if (!requireSignIn()) return;
    setBlockTarget(target);
  };

  const handleBlockConfirm = () => {
    if (!blockTarget || !viewerEmail) return;
    const next = blockUserEmail(viewerEmail, blockTarget.email);
    setBlockedEmails(next);
    setBlockTarget(null);
    pushToast({
      kind: 'success',
      title: 'User blocked',
      body: `${blockTarget.displayName} will no longer appear in your feed.`,
    });
  };

  const handleUnblock = (email: string, displayName: string) => {
    if (!viewerEmail) return;
    const next = unblockUserEmail(viewerEmail, email);
    setBlockedEmails(next);
    pushToast({
      kind: 'success',
      title: 'User unblocked',
      body: `${displayName} is visible again.`,
    });
  };

  const reportTargetLabel =
    reportTarget?.kind === 'post'
      ? `a reply by ${communityAuthorLabel(reportTarget.post)}`
      : reportTarget?.kind === 'thread'
        ? `the thread “${reportTarget.thread.title}”`
        : '';

  const trendingTopics = useMemo(() => {
    const fromThreads = threads
      .slice(0, 5)
      .map((t) => t.title.replace(/^(Who is |Film Room: |Portal watch: |NIL pulse: |Game Week open thread — )/i, '').slice(0, 28));
    return fromThreads.length ? fromThreads : FALLBACK_TOPICS;
  }, [threads]);

  const staffHighlights = useMemo(() => {
    const featured = threads.filter((t) => t.featured || t.pinned).slice(0, 3);
    if (featured.length) {
      return featured.map((t) => ({
        id: t.id,
        title: t.title,
        author: t.authorDisplay || 'GatorVault Staff',
      }));
    }
    return [];
  }, [threads]);

  /** Daily-open hook — ET daily staff OP first, then pinned/featured. */
  const todaysThread = useMemo(() => {
    const daily = threads.find((t) => Boolean(t.dailyKey));
    if (daily) return daily;
    const pinned = threads.find((t) => t.pinned || t.featured);
    return pinned || threads[0] || null;
  }, [threads]);

  const findThreadForRoom = useCallback(
    (room: LiveRoom): CommunityThread | null => {
      const roomId = (room.id || '').toLowerCase();
      const roomTitle = (room.title || '').toLowerCase();
      if (roomId.includes('gameweek') || roomTitle.includes('game week')) {
        return (
          threads.find(
            (t) =>
              t.id.includes('gameweek') || /game week/i.test(t.title || ''),
          ) || null
        );
      }
      if (roomId.includes('recruit') || roomTitle.includes('recruit')) {
        return (
          threads.find(
            (t) =>
              t.id.includes('board_priority') ||
              /board priority|recruiting|2027/i.test(t.title || ''),
          ) || null
        );
      }
      const needle = roomTitle.slice(0, 14);
      if (needle.length >= 6) {
        return threads.find((t) => (t.title || '').toLowerCase().includes(needle)) || null;
      }
      return null;
    },
    [threads],
  );

  const startRoomThread = (room: LiveRoom) => {
    const existing = findThreadForRoom(room);
    if (existing) {
      void openThread(existing.id);
      return;
    }
    setShowForm(true);
    setNewTitle((room.title || '').slice(0, 200));
    setNewBody('');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderBlockedPlaceholder = (displayName: string, email?: string) => (
    <div className="gv-community__post gv-community__post--blocked">
      <p className="gv-community__blocked-label">Blocked member</p>
      <p className="gv-community__blocked-body">Content from {displayName} is hidden.</p>
      {email && viewerEmail ? (
        <button
          type="button"
          className="gv-community__action-btn"
          onClick={() => handleUnblock(email, displayName)}
        >
          Unblock
        </button>
      ) : null}
    </div>
  );

  return (
    <PageLayout
      theme="white"
      title="Community"
      subtitle="Member-led talk, game week analysis, recruiting debate, and insider reaction."
      testId="vault-community"
      className="gv-community mobile-app"
    >
      <div className="gv-community__layout">
        <div className="gv-community__main">
          {todaysThread && !selectedId ? (
            <PageSection title="Jump in today" subtitle="Staff-led open thread — reply and keep the board alive.">
              <button
                type="button"
                className="gv-community__staff-card gv-community__today-card"
                onClick={() => void openThread(todaysThread.id)}
              >
                <Chip variant="staff">Today</Chip>
                <h3 className="gv-type-h3" style={{ margin: '0.5rem 0' }}>
                  {todaysThread.title}
                </h3>
                <p style={{ margin: 0, opacity: 0.7 }}>
                  {todaysThread.authorDisplay || 'GatorVault Staff'} ·{' '}
                  {(todaysThread.replyCount ?? 0) === 0
                    ? 'No replies yet — be the first →'
                    : `${todaysThread.replyCount} replies · Open thread →`}
                </p>
              </button>
            </PageSection>
          ) : null}

          {HAS_COMMUNITY_SEED && warming && !selectedId ? (
            <p className="gv-page-status gv-community__live-updating" role="status">
              Updating live board…
            </p>
          ) : null}

          <PageSection title="Trending Topics">
            <div className="gv-ds-filters">
              {trendingTopics.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="gv-community__topic-chip-btn"
                  onClick={() => {
                    const match = threads.find((th) =>
                      th.title.toLowerCase().includes(t.toLowerCase().slice(0, 12))
                    );
                    if (match) void openThread(match.id);
                    else {
                      setShowForm(true);
                      setNewTitle(t.slice(0, 200));
                    }
                  }}
                >
                  <Chip variant="trending">{t}</Chip>
                </button>
              ))}
            </div>
          </PageSection>

          {staffHighlights.length > 0 ? (
            <PageSection title="Staff Highlights">
              <div className="gv-community__staff-grid">
                {staffHighlights.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="gv-community__staff-card"
                    onClick={() => void openThread(p.id)}
                  >
                    <Chip variant="staff">Staff</Chip>
                    <h3 className="gv-type-h3" style={{ margin: '0.5rem 0' }}>{p.title}</h3>
                    <p style={{ margin: 0, opacity: 0.7 }}>{p.author}</p>
                  </button>
                ))}
              </div>
            </PageSection>
          ) : null}

          <div className="gv-community__toolbar">
            <div className="gv-alert-choices">
              {(['trending', 'recent', 'active', 'replies'] as SortId[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`gv-alert-choice${sort === s ? ' is-active' : ''}`}
                  onClick={() => setSort(s)}
                >
                  {s === 'trending' ? 'Trending' : s === 'recent' ? 'Recent' : s === 'active' ? 'Active' : 'Replies'}
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
                  {c.label || c.name}
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
                    {c.label || c.name}
                  </option>
                ))}
              </select>
              {postError ? <p className="gv-community__post-error">{postError}</p> : null}
              <button type="button" className="gv-alert-save-btn" disabled={posting} onClick={() => void submitThread()}>
                {posting ? 'Posting…' : 'Post Thread'}
              </button>
            </div>
          )}

          {loading && !HAS_COMMUNITY_SEED && (
            <div className="gv-community__loading" role="status" aria-live="polite" aria-busy="true">
              {warming ? <UiWarming hint="Loading threads and community pulse." /> : null}
              <CommunityPageSkeleton />
            </div>
          )}
          {error && !loading && !HAS_COMMUNITY_SEED && (
            <UiError message={error} retry={() => void load()} backHref="/vault" backLabel="← Vault" />
          )}

          {(HAS_COMMUNITY_SEED || (!loading && !error)) && selectedId && threadLoading && (
            <div className="gv-community__thread-detail">
              <button
                type="button"
                className="gv-film-back"
                onClick={() => {
                  setSelectedId(null);
                  setSelectedPosts([]);
                  setThreadLoading(false);
                }}
              >
                ← All threads
              </button>
              <p className="gv-page-status" role="status" aria-live="polite" aria-busy="true">
                Loading thread…
              </p>
              <CommunityThreadSkeleton />
            </div>
          )}

          {(HAS_COMMUNITY_SEED || (!loading && !error)) && selectedId && !selectedThread && !threadLoading && (
            <div className="gv-community__thread-detail">
              <button
                type="button"
                className="gv-film-back"
                onClick={() => {
                  setSelectedId(null);
                  setSelectedPosts([]);
                }}
              >
                ← All threads
              </button>
              <UiEmpty message="Could not load this thread." hint="Try again or pick another thread." />
            </div>
          )}

          {(HAS_COMMUNITY_SEED || (!loading && !error)) && selectedId && selectedThread && (
            <div className="gv-community__thread-detail">
              <button
                type="button"
                className="gv-film-back"
                onClick={() => {
                  setSelectedId(null);
                  setSelectedThread(null);
                  setSelectedPosts([]);
                }}
              >
                ← All threads
              </button>
              <ul className="gv-community__posts">
                <li
                  className={`gv-community__post${selectedThread.flagged ? ' gv-community__post--flagged' : ''}${
                    isAuthorBlocked(selectedThread.authorEmail) ? ' gv-community__post--blocked-author' : ''
                  }`}
                >
                  {isAuthorBlocked(selectedThread.authorEmail) ? (
                    renderBlockedPlaceholder(
                      communityAuthorLabel(selectedThread),
                      selectedThread.authorEmail,
                    )
                  ) : (
                    <>
                      <div className="gv-community__post-head">
                        <p className="gv-community__post-author">{communityAuthorLabel(selectedThread)}</p>
                        <CommunityPostActions
                          canModerate={canModerate}
                          isOwnContent={isOwnAuthor(selectedThread.authorEmail)}
                          isBlockedAuthor={isAuthorBlocked(selectedThread.authorEmail)}
                          flagged={selectedThread.flagged}
                          onReport={() => handleReportOpen({ kind: 'thread', thread: selectedThread })}
                          onBlock={() =>
                            handleBlockOpen({
                              email: selectedThread.authorEmail || '',
                              displayName: communityAuthorLabel(selectedThread),
                            })
                          }
                        />
                      </div>
                      <h3 className="gv-community__thread-op-title">{selectedThread.title}</h3>
                      <p className="gv-community__post-body">{selectedThread.body}</p>
                      <p className="gv-community__post-meta">
                        {threadCategoryLabel(selectedThread)} · {timeAgo(selectedThread.createdAt)}
                      </p>
                    </>
                  )}
                </li>
                {selectedPosts.map((p) => {
                  const blocked = isAuthorBlocked(p.authorEmail);
                  return (
                    <li
                      key={p.id}
                      className={`gv-community__post${p.flagged ? ' gv-community__post--flagged' : ''}${
                        blocked ? ' gv-community__post--blocked-author' : ''
                      }`}
                    >
                      {blocked ? (
                        renderBlockedPlaceholder(communityAuthorLabel(p), p.authorEmail)
                      ) : (
                        <>
                          <div className="gv-community__post-head">
                            <p className="gv-community__post-author">{communityAuthorLabel(p)}</p>
                            <CommunityPostActions
                              canModerate={canModerate}
                              isOwnContent={isOwnAuthor(p.authorEmail)}
                              isBlockedAuthor={blocked}
                              flagged={p.flagged}
                              onReport={() => handleReportOpen({ kind: 'post', post: p })}
                              onBlock={() =>
                                handleBlockOpen({
                                  email: p.authorEmail || '',
                                  displayName: communityAuthorLabel(p),
                                })
                              }
                            />
                          </div>
                          <p className="gv-community__post-body">{p.body}</p>
                          <p className="gv-community__post-meta">{timeAgo(p.createdAt)}</p>
                        </>
                      )}
                    </li>
                  );
                })}
                {selectedPosts.length === 0 ? (
                  <UiEmpty
                    message="No replies yet."
                    hint={viewerEmail ? 'Be the first reply and keep the board alive.' : 'Sign in to be the first reply.'}
                  />
                ) : null}
              </ul>
              {selectedThread.locked ? (
                <p className="gv-community__reply-locked">This thread is locked — new replies are disabled.</p>
              ) : viewerEmail ? (
                <div className="gv-community__form gv-community__reply-form">
                  <label className="gv-community__reply-label" htmlFor="community-reply-body">
                    Reply to thread
                  </label>
                  <textarea
                    id="community-reply-body"
                    className="gv-alert-input gv-community__textarea"
                    placeholder="Add your reply…"
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    maxLength={4000}
                    rows={4}
                  />
                  {replyError ? <p className="gv-community__post-error">{replyError}</p> : null}
                  <button
                    type="button"
                    className="gv-community__new-btn"
                    disabled={replyPosting || !replyBody.trim()}
                    onClick={() => void submitReply()}
                  >
                    {replyPosting ? 'Posting…' : 'Post reply'}
                  </button>
                </div>
              ) : (
                <p className="gv-community__reply-signin">Sign in to reply to this thread.</p>
              )}
            </div>
          )}

          {(HAS_COMMUNITY_SEED || (!loading && !error)) && !selectedId && (
            <PageSection title="Threads">
              <ul className="gv-community__threads">
                {threads.map((t) => {
                  const blockedAuthor = isAuthorBlocked(t.authorEmail);
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        className={`gv-community__thread-row${blockedAuthor ? ' gv-community__thread-row--blocked' : ''}${
                          t.flagged ? ' gv-community__thread-row--flagged' : ''
                        }`}
                        onClick={() => void openThread(t.id)}
                      >
                        <span className="gv-community__thread-title">
                          {t.pinned ? <Chip variant="staff">Pinned</Chip> : null}{' '}
                          {t.title}
                          {blockedAuthor ? (
                            <span className="gv-community__blocked-chip">Blocked author</span>
                          ) : null}
                        </span>
                        <span className="gv-community__thread-meta">
                          {threadCategoryLabel(t)} · {t.replyCount ?? 0} replies ·{' '}
                          {timeAgo(t.lastActivityAt || t.createdAt)}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {threads.length === 0 && (
                  <li className="gv-community__empty-cta">
                    <UiEmpty message="Be first — start a founding conversation." />
                    <button
                      type="button"
                      className="gv-btn gv-btn--primary"
                      onClick={() => setShowForm(true)}
                    >
                      Start a thread
                    </button>
                  </li>
                )}
              </ul>
            </PageSection>
          )}
        </div>

        <aside className="gv-community__aside">
          {blockedEmails.length > 0 ? (
            <section className="gv-community__panel">
              <h2 className="gv-vault-alerts__section-title">Blocked members</h2>
              <ul className="gv-community__blocked-list">
                {blockedEmails.map((email) => (
                  <li key={email} className="gv-community__blocked-list-item">
                    <span>{email}</span>
                    <button
                      type="button"
                      className="gv-community__action-btn"
                      onClick={() => handleUnblock(email, email)}
                    >
                      Unblock
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="gv-community__panel">
            <h2 className="gv-vault-alerts__section-title">Start a conversation</h2>
            <p className="gv-community__room-desc">
              Recruiting debate, film takes, and game week keys — staff reads every thread.
            </p>
            <button
              type="button"
              className="gv-btn gv-btn--primary"
              onClick={() => setShowForm(true)}
            >
              New thread
            </button>
          </section>

          <section className="gv-community__panel">
            <h2 className="gv-vault-alerts__section-title">Game Week Rooms</h2>
            {rooms.map((r) => {
              const existing = findThreadForRoom(r);
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`gv-community__room gv-community__room--action${
                    existing ? ' gv-community__room--live' : ''
                  }`}
                  onClick={() => startRoomThread(r)}
                >
                  <p className="gv-community__room-title">{r.title}</p>
                  {r.description ? <p className="gv-community__room-desc">{r.description}</p> : null}
                  {r.scheduledAt || r.startsAt ? (
                    <p className="gv-community__room-meta">
                      {new Date(r.scheduledAt || r.startsAt || '').toLocaleString()}
                    </p>
                  ) : null}
                  <p className="gv-community__room-meta">
                    {existing ? 'Join open thread →' : 'Start a thread →'}
                  </p>
                </button>
              );
            })}
            {rooms.length === 0 && !loading && (
              <p className="gv-page-status">Rooms open as game week approaches.</p>
            )}
          </section>

          <section className="gv-community__panel">
            <h2 className="gv-vault-alerts__section-title">Community Pulse</h2>
            {pulse ? (
              <div className="gv-community__pulse-grid">
                <div className="gv-recruit-stat">
                  <span>Replies today</span>
                  <strong>{pulse.repliesToday ?? '—'}</strong>
                </div>
                <div className="gv-recruit-stat">
                  <span>Threads with replies</span>
                  <strong>
                    {(pulse.trending ?? 0) > 0 ? pulse.trending : '—'}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="gv-community__pulse-grid">
                <div className="gv-recruit-stat">
                  <span>Replies today</span>
                  <strong>—</strong>
                </div>
                <div className="gv-recruit-stat">
                  <span>Threads with replies</span>
                  <strong>—</strong>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>

      <CommunityReportModal
        open={Boolean(reportTarget)}
        targetLabel={reportTargetLabel}
        loading={moderationLoading}
        onClose={() => setReportTarget(null)}
        onSubmit={(reason) => void handleReportSubmit(reason)}
      />

      <CommunityConfirmModal
        open={Boolean(blockTarget)}
        title="Block this member?"
        description={
          blockTarget
            ? `You will no longer see posts from ${blockTarget.displayName}. You can unblock them anytime from the sidebar.`
            : undefined
        }
        confirmLabel="Block user"
        confirmTone="danger"
        loading={moderationLoading}
        onCancel={() => setBlockTarget(null)}
        onConfirm={handleBlockConfirm}
      />
    </PageLayout>
  );
}

export function VaultCommunityPage({ initialThreadId }: { initialThreadId?: string } = {}): React.ReactElement {
  return (
    <CommunityToastProvider>
      <VaultCommunityPageInner initialThreadId={initialThreadId} />
    </CommunityToastProvider>
  );
}
