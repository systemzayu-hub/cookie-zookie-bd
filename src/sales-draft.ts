import { useRef, useState } from 'react'
import type { Sale } from './types'
import { load, save } from './data'
import { dayKey } from './analytics'

export interface SalesDraft {
  text: string
  date: string
  status: Sale['status']
  automaticDate: string
}
const emptyDraft = (): SalesDraft => ({ text: '', date: '', status: 'Pendente', automaticDate: '' })
export function readSalesDraft(key?: string): SalesDraft {
  if (!key) return emptyDraft()
  const value = load<Partial<SalesDraft> | null>(key, null)
  if (!value || typeof value.text !== 'string') return emptyDraft()
  return {
    text: value.text,
    date: typeof value.date === 'string' ? value.date : '',
    status: ['Pago', 'Pendente', 'Debitado', 'Presente'].includes(value.status || '') ? value.status! : 'Pendente',
    automaticDate: typeof value.automaticDate === 'string' ? value.automaticDate : '',
  }
}

// Save synchronously on each edit, before navigation or closing the page can unmount it.
export function useSalesDraft(key?: string) {
  const [draft, setDraft] = useState(() => readSalesDraft(key))
  const current = useRef(draft)
  const [saved, setSaved] = useState(true)
  const update = (patch: Partial<SalesDraft>) => {
    const next = { ...current.current, ...patch }
    if (next.text && !next.automaticDate) next.automaticDate = dayKey(Date.now())
    current.current = next
    setDraft(next)
    setSaved(!key || save(key, next))
  }
  const clear = () => {
    const next = emptyDraft()
    current.current = next
    setDraft(next)
    setSaved(!key || save(key, next))
  }
  return { draft, update, clear, saved }
}
