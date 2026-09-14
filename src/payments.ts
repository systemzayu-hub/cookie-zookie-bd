export type CashPayment = { id: string; amount: number; description: string; person: string; date: string; archived?: boolean; kind?: 'cash' | 'cookie'; sourceSaleId?: string; quantity?: number; status?: 'debited' | 'paid' }

export const validCashPayment = (value: unknown): value is CashPayment => {
  if (!value || typeof value !== 'object') return false
  const p = value as CashPayment
  return typeof p.id === 'string' && p.id.length > 0 && p.id.length <= 100
    && Number.isFinite(p.amount) && p.amount > 0 && p.amount <= 1_000_000
    && typeof p.description === 'string' && p.description.trim().length > 0 && p.description.length <= 500
    && typeof p.person === 'string' && p.person.length <= 200
    && typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date)
    && (p.archived === undefined || typeof p.archived === 'boolean')
    && (p.kind === undefined || p.kind === 'cash' || p.kind === 'cookie')
    && (p.sourceSaleId === undefined || typeof p.sourceSaleId === 'string' && p.sourceSaleId.length > 0 && p.sourceSaleId.length <= 100)
    && (p.quantity === undefined || Number.isFinite(p.quantity) && p.quantity > 0 && p.quantity <= 100_000)
    && (p.status === undefined || p.status === 'debited' || p.status === 'paid')
}

export const cashPaymentsTotal = (payments: CashPayment[]) => payments.filter(p => !p.archived && p.kind !== 'cookie').reduce((sum, p) => sum + Math.round(p.amount * 100), 0) / 100
