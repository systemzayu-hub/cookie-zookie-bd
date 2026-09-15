import { useEffect, useRef, type ReactNode } from 'react'
export function ConfirmDialog({ titleId, busy, onCancel, children, className = '' }: { titleId: string; busy: boolean; onCancel: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return <dialog ref={ref} className={`pw-modal access-dialog ${className}`.trim()} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onCancel() }}>{children}</dialog>
}
