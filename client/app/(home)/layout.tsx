import React from 'react';

/** SSR landing marker for Platform Guardian before client hydration. */
export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <span hidden aria-hidden="true" data-testid="landing-page" className="gv-landing">
        GatorVault
      </span>
      {children}
    </>
  );
}
