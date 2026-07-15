'use client';

import React from 'react';
import { usePathname } from '@/lib/use-pathname';
import { useInsiderUnlock, useUser } from '@/lib/useUser';
import { isNativeApp, nativeNavigationUrl } from '@/lib/api-base';

type Props = {
  canReadFull: boolean;
  needsInsider: boolean;
  teaser: React.ReactNode;
  children: React.ReactNode;
};

function signInHref(returnPath: string): string {
  const next = encodeURIComponent(returnPath || '/articles/');
  const path = `/join/?mode=signin&next=${next}`;
  return isNativeApp() ? nativeNavigationUrl(path) : path;
}

/** Teaser free; full body for members (locker) or Film+ (insider-tier pieces). */
export function ArticleAccessGate({
  canReadFull,
  needsInsider,
  teaser,
  children,
}: Props): React.ReactElement {
  const pathname = usePathname();
  const { ready } = useUser();
  const { href: unlockHref, navigate: goToUnlock } = useInsiderUnlock({ returnPath: pathname });

  if (!ready) {
    return <div className="gv-article-page__loading">Checking access…</div>;
  }

  if (canReadFull) {
    return <>{children}</>;
  }

  const href = needsInsider ? unlockHref : signInHref(pathname);
  const message = needsInsider
    ? 'Film Room unlocks full Insider articles — takeaways, sources, and the complete analysis.'
    : 'Sign in as a GatorVault member to read the full article.';
  const ctaLabel = needsInsider ? 'Unlock Insider' : 'Sign in to read';

  return (
    <div className="gv-insider-paywall">
      {teaser}
      <div className="gv-paywall-overlay" style={{ position: 'relative', marginTop: '1rem' }}>
        <p className="gv-paywall-text">{message}</p>
        <a
          href={href}
          className="gv-paywall-cta"
          onClick={(e) => {
            if (needsInsider) {
              e.preventDefault();
              goToUnlock();
            }
          }}
        >
          {ctaLabel}
        </a>
      </div>
    </div>
  );
}