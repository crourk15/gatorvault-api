import type { CommunityPost, CommunityThread } from './community-api';

/** Last-reply line from the hub list — enough to paint a comment before the thread GET. */
export function previewPostsFromThread(thread: CommunityThread | null | undefined): CommunityPost[] {
  const last = thread?.lastReply;
  if (!last) return [];
  const body = String(last.bodyPreview || '').trim();
  const id = String(last.id || '').trim();
  if (!body && !id) return [];
  return [
    {
      id: id || `preview:${thread?.id || 'thread'}`,
      body: body || 'Reply',
      authorDisplay: last.authorDisplay || undefined,
      authorEmail: last.authorEmail || undefined,
      createdAt: last.createdAt || undefined,
    },
  ];
}

/** Never flash “No replies yet” while the thread GET is still in flight. */
export function shouldShowEmptyReplies(opts: {
  postCount: number;
  threadLoading: boolean;
}): boolean {
  return opts.postCount === 0 && opts.threadLoading !== true;
}
