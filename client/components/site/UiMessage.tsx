'use client';

import React from 'react';

export function UiError({
  title = 'Something went wrong',
  message,
  retry,
  backHref = '/',
  backLabel = '← Back to GatorVault',
}: {
  title?: string;
  message: string;
  retry?: () => void;
  backHref?: string;
  backLabel?: string;
}): React.ReactElement {
  return (
    <div className="gv-ui-message gv-ui-message--error" role="alert">
      <h2 className="gv-ui-message__title">{title}</h2>
      <p className="gv-ui-message__text">{message}</p>
      <div className="gv-ui-message__actions">
        {retry && (
          <button type="button" className="gv-ui-message__btn" onClick={retry}>
            Try again
          </button>
        )}
        <a href={backHref} className="gv-ui-message__link">
          {backLabel}
        </a>
      </div>
    </div>
  );
}

export function UiEmpty({
  message,
  hint,
}: {
  message: string;
  hint?: string;
}): React.ReactElement {
  return (
    <div className="gv-ui-message gv-ui-message--empty">
      <p className="gv-ui-message__text">{message}</p>
      {hint && <p className="gv-ui-message__hint">{hint}</p>}
    </div>
  );
}
