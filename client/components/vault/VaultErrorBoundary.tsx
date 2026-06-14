'use client';

import React from 'react';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class VaultErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="gv-page-status gv-page-status--error" role="alert">
          <p>Something went wrong loading this Vault page.</p>
          <p className="gv-page-subtitle">{this.state.error.message}</p>
          <button type="button" className="gv-hub-tab" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
