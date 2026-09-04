import { useState, useRef, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export interface MaskedMoneyProps {
  value: number
  className?: string
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function MaskedMoney({ value, className = '' }: MaskedMoneyProps) {
  const [revealed, setRevealed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reveal = () => {
    setRevealed(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setRevealed(false), 3000)
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

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
