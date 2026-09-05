import type { ReactNode } from 'react'
import { useAuth, type Level } from '../auth'
import { MoneyVisibilityProvider } from './MaskedMoney'
export function SensitiveData({ children, label, level = 'financial' }: { children: ReactNode; label?: string; level?: Level }) {
  return useAuth(level) ? <MoneyVisibilityProvider>{children}</MoneyVisibilityProvider> : <section className="card" role="status">{label || 'Área restrita'}: seu cargo não permite este acesso.</section>
}
