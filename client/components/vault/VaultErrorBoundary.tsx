'use client';

import React from 'react';
import { RouteErrorFallback } from '@/components/errors/RouteErrorFallback';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class VaultErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[VaultErrorBoundary]', error.message, info.componentStack);
  }

  private retry = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <RouteErrorFallback
          error={this.state.error}
          title="This Vault page failed to load"
          onRetry={this.retry}
          dashboardHref="/vault"
          dashboardLabel="Go to Dashboard"
          homeHref="/"
          homeLabel="← Home"
        />
      );
    }
    return this.props.children;
  }
}
