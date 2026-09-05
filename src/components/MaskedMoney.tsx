import type { ReactNode } from 'react'
import { useAuth } from '../auth'
export interface MaskedMoneyProps { value: number; className?: string }
export function MoneyVisibilityProvider({ children }: { children: ReactNode }) { return <>{children}</> }
export function MaskedMoney({ value, className = '' }: MaskedMoneyProps) {
  const allowed = useAuth('financial')
  return <span className={`font-mono tabular-nums ${className}`}>{allowed ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ ••••'}</span>
}
