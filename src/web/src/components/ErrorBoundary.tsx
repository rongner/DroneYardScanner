import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
          <div className="max-w-md text-center space-y-4">
            <AlertTriangle size={48} className="text-red-400 mx-auto" />
            <h1 className="text-xl font-bold">Something went wrong</h1>
            <p className="text-slate-400 text-sm">{this.state.error.message}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="bg-slate-800 hover:bg-slate-700 text-sm px-4 py-2 rounded transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
