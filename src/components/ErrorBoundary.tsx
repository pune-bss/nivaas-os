import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'An unexpected error occurred.' };
  }

  render() {
    if (this.state.hasError) {
      let readable = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) {
          readable = `${parsed.error} (Operation: ${parsed.operationType}, Path: ${parsed.path || 'unknown'})`;
        }
      } catch {
        // Not JSON
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
          <div className="max-w-lg w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-3">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h1 className="text-lg font-semibold">Application Error</h1>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6 break-words">
              {readable}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-teal-500 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
