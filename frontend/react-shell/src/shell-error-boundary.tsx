import { Component, type ErrorInfo, type ReactNode } from "react";

type ShellErrorBoundaryProps = {
  children: ReactNode;
};

type ShellErrorBoundaryState = {
  hasError: boolean;
};

export class ShellErrorBoundary extends Component<
  ShellErrorBoundaryProps,
  ShellErrorBoundaryState
> {
  state: ShellErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(): ShellErrorBoundaryState {
    return {
      hasError: true
    };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {}

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <section
          className="status-panel status-panel-error"
          data-testid="react-shell-crash-fallback"
        >
          <p className="status-label">Error</p>
          <h2>React shell unavailable</h2>
          <p className="status-copy">
            An unexpected render error interrupted the migrated shell. Reload the page or retry from
            the previous screen.
          </p>
        </section>
      );
    }

    return this.props.children;
  }
}
