import { useEffect, useRef, type ReactNode } from 'react'
export function ConfirmDialog({ titleId, busy, onCancel, children }: { titleId: string; busy: boolean; onCancel: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return <dialog ref={ref} className="pw-modal access-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onCancel() }}>{children}</dialog>
}
