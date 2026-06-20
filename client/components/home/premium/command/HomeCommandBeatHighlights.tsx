'use client';

import React from 'react';
import type { HomeBeatPostView } from '@/components/home/premium/command/home-command-utils';
import { avatarInitials } from '@/components/home/premium/command/home-command-utils';

type Props = {
  posts: HomeBeatPostView[];
  loading?: boolean;
};

function BeatCard({ post }: { post: HomeBeatPostView }): React.ReactElement {
  return (
    <article className="home-wow-beat-card">
      <div className="home-wow-beat-watermark" aria-hidden="true">
        UF
      </div>
      <div className="home-wow-beat-header">
        <span className="home-wow-beat-avatar" aria-hidden="true">
          {avatarInitials(post.writerName)}
        </span>
        <div className="home-wow-beat-meta">
          <span className="home-wow-beat-name">{post.writerName}</span>
          <span className="home-wow-beat-outlet">{post.outlet}</span>
        </div>
        {post.badge ? <span className="home-wow-badge">{post.badge}</span> : null}
      </div>
      <p className="home-wow-beat-body">{post.text}</p>
      <div className="home-wow-beat-footer">
        <span>{post.timestamp || 'Recently'}</span>
        <a href={post.xUrl} className="home-wow-link-x" target="_blank" rel="noopener noreferrer">
          <span>View on X</span>
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  );
}

export function HomeCommandBeatHighlights({ posts, loading }: Props): React.ReactElement {
  return (
    <>
      <div className="home-wow-section-header">
        <h2 className="home-wow-section-title">Beat Writer Highlights</h2>
        <p className="home-wow-section-subtitle">Hand-picked fire from UF beat writers.</p>
      </div>
      {loading ? (
        <div className="home-wow-skeleton" data-testid="home-beat-highlights" aria-hidden="true" />
      ) : posts.length === 0 ? (
        <section className="home-wow-card" data-testid="home-beat-highlights">
          <p className="home-wow-empty">Nothing active right now — beat posts appear when the feed updates.</p>
        </section>
      ) : (
        <section className="home-wow-beat-grid" data-testid="home-beat-highlights">
          {posts.map((post) => (
            <BeatCard key={post.id} post={post} />
          ))}
        </section>
      )}
    </>
  );
}
