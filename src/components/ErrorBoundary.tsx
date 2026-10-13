import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import { useAppStore } from '@/data/store';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** When this changes (for example the page address) a shown error is cleared */
  resetKey?: string;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Catches a page that breaks while drawing, so the demo shows a message and a way out instead of a
 * blank screen. The page's data may be what broke it, so "Reset demo" is offered. Nothing about the
 * error is shown or logged here: it could carry what the person typed.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  private reset = () => {
    useAppStore.getState().resetDemo();
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div
          role="alert"
          className="flex w-full max-w-md flex-col items-center gap-3 rounded-card bg-card p-8 text-center shadow-card"
        >
          <h1 className="text-heading-s text-label">Something went wrong on this page</h1>
          <p className="text-body-m text-ink">
            Nothing was sent anywhere. Reset the demo to start again with the sample data.
          </p>
          <Button onClick={this.reset}>Reset demo</Button>
        </div>
      </div>
    );
  }
}
