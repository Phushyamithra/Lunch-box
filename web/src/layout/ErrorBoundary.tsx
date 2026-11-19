import { Alert, Button } from '@mui/material';
import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Keeps one broken part of a screen from blanking the whole app: it shows
 * what went wrong in place, with a retry, and the rest keeps working. Give it
 * a `key` that changes with what it shows (a day, a path) so it resets.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.label ?? 'screen'}]`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" onClick={() => this.setState({ error: null })}>
            Retry
          </Button>
        }
      >
        {this.props.label ? `${this.props.label} couldn’t be shown` : 'This part couldn’t be shown'}: {error.message || String(error)}. The rest of the app still works.
      </Alert>
    );
  }
}
