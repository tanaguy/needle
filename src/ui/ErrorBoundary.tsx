import { Component, type ReactNode } from 'react'

/** Keeps a UI bug from blanking the room: shows a calm card with a way back. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: 16 }}>
        <div className="paper" style={{ width: 'min(420px, 100%)', padding: '26px 28px', display: 'grid', gap: 12, justifyItems: 'start' }}>
          <div className="label">Something skipped</div>
          <h2 className="serif" style={{ margin: 0, fontSize: 34, fontWeight: 400, lineHeight: 1.05 }}>
            The needle <em>jumped</em>
          </h2>
          <p className="body" style={{ margin: 0 }}>
            A part of the interface hit an error. Your settings are saved — reloading puts you back in the room.
          </p>
          <button className="btn btn-ink" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      </div>
    )
  }
}
