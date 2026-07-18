'use client';

import React from 'react';

type Props = {
  error: Error;
  title?: string;
  onRetry?: () => void;
  dashboardHref?: string;
  dashboardLabel?: string;
  homeHref?: string;
  homeLabel?: string;
};

/** Styled recovery card for route/chunk failures — keeps shell visible, not a blank screen. */
export function RouteErrorFallback({
  error,
  title = 'Something went wrong',
  onRetry,
  dashboardHref = '/vault/',
  dashboardLabel = 'Go to Home',
  homeHref,
  homeLabel = '← Home',
}: Props): React.ReactElement {
  return (
    <div className="gv-route-error" role="alert" data-testid="route-error-fallback">
      <div className="gv-ui-message gv-ui-message--error gv-route-error__card">
        <h2 className="gv-ui-message__title">{title}</h2>
        <p className="gv-ui-message__text">
          {error.message || 'This page failed to load. You can retry or return to the dashboard.'}
        </p>
        <div className="gv-ui-message__actions">
          {onRetry ? (
            <button type="button" className="gv-ui-message__btn" onClick={onRetry}>
              Try again
            </button>
          ) : null}
          <a href={dashboardHref} className="gv-ui-message__btn gv-ui-message__btn--secondary">
            {dashboardLabel}
          </a>
          {homeHref ? (
            <a href={homeHref} className="gv-ui-message__link">
              {homeLabel}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
