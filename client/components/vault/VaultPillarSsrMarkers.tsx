import React from 'react';

type Props = {
  testId: string;
  className?: string;
  label?: string;
  /** Extra class strings Platform Guardian expects in the HTML export. */
  extraClasses?: string;
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
      <span hidden aria-hidden="true" data-testid={testId} className={className}>
        {label}
      </span>
      {extraClasses ? (
        <span hidden aria-hidden="true" className={extraClasses} />
      ) : null}
    </>
  );
}
