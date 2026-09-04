import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

type Props = { children: ReactNode }
type State = { failed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui] tela interrompida', error.name, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <section className="card fatal-error" role="alert">
        <AlertTriangle size={36} aria-hidden="true" />
        <h2>Não foi possível abrir esta tela</h2>
        <p>Seus dados permanecem salvos. Recarregue o painel para tentar novamente.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          <RefreshCw size={16} /> Recarregar painel
        </button>
      </section>
    )
  }
}
