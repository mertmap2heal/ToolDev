import React from 'react'

/**
 * Top-level error boundary so a single render error doesn't white-screen
 * the whole app. Wrap once around <Routes/> in App.tsx; route children
 * that throw render an inline fallback panel instead of unmounting the
 * router tree (and its sidebar / header chrome).
 */

interface State {
  error: Error | null
}

export class RouteErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('[RouteErrorBoundary] caught', error, info.componentStack)
    }
    try {
      window.dispatchEvent(new CustomEvent('app-route-error', { detail: { message: error.message } }))
    } catch {
      /* dispatch may fail in old browsers — non-fatal */
    }
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div
        role="alert"
        className="m-6 p-6 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700 text-gray-900 dark:text-gray-100"
      >
        <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
        <p className="text-sm mb-3 text-gray-700 dark:text-gray-300">
          The page hit an unexpected error. The rest of the app is still usable.
          Reload the page to retry.
        </p>
        {import.meta.env.DEV && (
          <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto max-h-64 mb-3">
            {this.state.error.message}
          </pre>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >
            Reload page
          </button>
          <button
            type="button"
            onClick={this.reset}
            className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }
}

export default RouteErrorBoundary
