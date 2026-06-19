'use client'

import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
          <p className="text-white/50 text-sm">Something went wrong. Pull down to refresh.</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs px-4 py-2 rounded-lg bg-white/8 border border-white/12 text-white/60 hover:text-white/90 transition-colors"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
