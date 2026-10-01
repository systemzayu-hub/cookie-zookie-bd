import { useEffect, useRef, type ReactNode } from 'react'

export function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (typeof document === 'undefined') return
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current
    dialog?.showModal()
    return () => {dialog?.close(); if (previous?.isConnected) previous.focus()}
  }, [])
  return <dialog ref={ref} className="modal form-dialog" role="dialog" aria-modal="true" aria-label={label} onCancel={event => {event.preventDefault(); onClose()}}>{children}</dialog>
}
