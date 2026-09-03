import { useState, useRef, useEffect, MouseEvent, TouchEvent as ReactTouchEvent } from 'react'

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

  const handleClick = (e: MouseEvent<HTMLSpanElement>) => {
    if (e.detail === 2) reveal()
  }

  const handleTouchStart = (e: ReactTouchEvent<HTMLSpanElement>) => {
    const touch = e.touches[0]
    const startTime = Date.now()
    const startX = touch.clientX
    const startY = touch.clientY

    const handleTouchEnd = (endE: TouchEvent) => {
      const endTouch = endE.changedTouches[0]
      const deltaX = Math.abs(endTouch.clientX - startX)
      const deltaY = Math.abs(endTouch.clientY - startY)
      const duration = Date.now() - startTime
      if (duration > 400 && duration < 1000 && deltaX < 10 && deltaY < 10) {
        reveal()
      }
    }
    document.addEventListener('touchend', handleTouchEnd, { once: true })
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <span
      className={`inline-flex items-center gap-1 cursor-pointer select-none ${className}`}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      title={revealed ? 'Clique para ocultar' : 'Duplo clique ou toque longo para revelar'}
    >
      {revealed ? (
        fmt.format(value)
      ) : (
        <span className="font-mono tabular-nums">R$***</span>
      )}
    </span>
  )
}