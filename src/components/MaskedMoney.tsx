import { createContext, useContext, useState, useRef, useEffect, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../auth'

export interface MaskedMoneyProps {
  value: number
  className?: string
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const MoneyVisibility = createContext(false)

export function MoneyVisibilityProvider({ children }: { children: ReactNode }) {
  return <MoneyVisibility.Provider value>{children}</MoneyVisibility.Provider>
}

export function MaskedMoney({ value, className = '' }: MaskedMoneyProps) {
  const inheritedVisibility = useContext(MoneyVisibility)
  const generalAccess = useAuth('financial')
  const [revealed, setRevealed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reveal = () => {
    setRevealed(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setRevealed(false), 3000)
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  if (inheritedVisibility || generalAccess) {
    return <span className={`font-mono tabular-nums ${className}`}>{fmt.format(value)}</span>
  }

  return (
    <span className={`masked-value ${className}`}>
      <span className="font-mono tabular-nums">{revealed ? fmt.format(value) : 'R$ ••••'}</span>
      <button
        type="button"
        className="masked-reveal-button"
        onClick={() => revealed ? setRevealed(false) : reveal()}
        aria-label={revealed ? 'Ocultar valor' : 'Mostrar valor por 3 segundos'}
        title={revealed ? 'Ocultar valor' : 'Mostrar valor por 3 segundos'}
      >
        {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </span>
  )
}
