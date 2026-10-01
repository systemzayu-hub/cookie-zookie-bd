import { useEffect, useId, useRef, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'

export function useConfirmation() {
  const [request, setRequest] = useState<{ title: string; message: string } | null>(null)
  const resolve = useRef<((answer: boolean) => void) | null>(null)
  const id = useId()
  useEffect(() => () => { resolve.current?.(false); resolve.current = null }, [])
  const answer = (accepted: boolean) => { const done = resolve.current; resolve.current = null; setRequest(null); done?.(accepted) }
  const confirm = (message: string, title = 'Confirmar alteração') => new Promise<boolean>(done => {
    // One operation at a time; replacing a request must never approve the older action.
    resolve.current?.(false)
    resolve.current = done
    setRequest({ title, message })
  })
  const confirmation = request && <ConfirmDialog titleId={id} busy={false} onCancel={() => answer(false)}>
    <h2 id={id}>{request.title}</h2><p>{request.message}</p>
    <div className="pw-buttons"><button type="button" autoFocus className="btn btn-secondary" onClick={() => answer(false)}>Cancelar</button><button type="button" className="btn btn-primary" onClick={() => answer(true)}>Confirmar</button></div>
  </ConfirmDialog>
  return { confirm, confirmation }
}
