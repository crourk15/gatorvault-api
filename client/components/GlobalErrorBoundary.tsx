'use client';

import React from 'react';
import { RouteErrorFallback } from '@/components/errors/RouteErrorFallback';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/** Root error boundary — catches render errors outside the vault shell. */
export class GlobalErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[GlobalErrorBoundary]', error.message, info.componentStack);
  }

  private retry = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <RouteErrorFallback
          error={this.state.error}
          title="GatorVault hit a snag"
          onRetry={this.retry}
          dashboardHref="/vault/"
          dashboardLabel="Enter Vault"
        />
      );
    }
    return this.props.children;
  }
}
