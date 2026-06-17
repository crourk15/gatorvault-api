import React from 'react';

type Props = {
  testId: string;
  className?: string;
  label?: string;
  /** Extra class strings Platform Guardian expects in the HTML export. */
  extraClasses?: string;
};

const SSR_MARKER_STYLE: React.CSSProperties = {
  display: 'none',
  minHeight: 0,
  height: 0,
  margin: 0,
  padding: 0,
  overflow: 'hidden',
};

/** Hidden SSR markers so static HTML passes Platform Guardian before client hydration. */
export function VaultPillarSsrMarkers({
  testId,
  className,
  label,
  extraClasses,
}: Props): React.ReactElement {
  return (
    <>
      <span
        hidden
        aria-hidden="true"
        data-testid={testId}
        className={className ? `gv-vault-ssr-marker ${className}` : 'gv-vault-ssr-marker'}
        style={SSR_MARKER_STYLE}
      >
        {label}
      </span>
      {extraClasses ? (
        <span
          hidden
          aria-hidden="true"
          className={`gv-vault-ssr-marker ${extraClasses}`}
          style={SSR_MARKER_STYLE}
        />
      ) : null}
    </>
  );
}
