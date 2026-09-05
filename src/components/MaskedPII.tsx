import { useAuth } from '../auth'

export type PIIType = 'cpf' | 'phone'

export interface MaskedPIIProps {
  value: string
  type: PIIType
  className?: string
}

function maskCPF(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 11)
  if (digits.length !== 11) return '***.***.***-**'
  return `***.***.${digits.slice(6, 9)}-**`
}

function maskPhone(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 11)
  if (digits.length < 10) return '(**) *****-****'
  if (digits.length === 10) {
    return `(**) ****-${digits.slice(6, 10)}`
  }
  return `(**) *****-${digits.slice(7, 11)}`
}

function unmaskCPF(v: string) {
  return v.replace(/\D/g, '')
}

function unmaskPhone(v: string) {
  return v.replace(/\D/g, '')
}

function formatRawCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
}

function formatRawPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`
}

export function MaskedPII({ value, type, className = '' }: MaskedPIIProps) {
  const generalAccess = useAuth('financial')
  const masked = type === 'cpf' ? maskCPF(value) : maskPhone(value)
  const raw = type === 'cpf' ? unmaskCPF(value) : unmaskPhone(value)
  const formattedRaw = type === 'cpf' ? formatRawCPF(raw) : formatRawPhone(raw)

  if (!raw) return <span className={className}>Não informado</span>
  if (generalAccess) return <span className={`font-mono tabular-nums ${className}`}>{formattedRaw}</span>

  return <span className={className}>{masked}</span>
}
