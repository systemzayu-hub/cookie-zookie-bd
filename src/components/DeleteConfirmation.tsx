import { useId, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'

export function DeleteConfirmation({ onClose, onConfirm, title, message, itemName }: { onClose: () => void; onConfirm: () => void; title: string; message: string; itemName: string }) {
  const [checked, setChecked] = useState(false)
  const [typed, setTyped] = useState('')
  const id = useId()
  return <ConfirmDialog titleId={id} busy={false} onCancel={onClose}>
    <h2 id={id}>{title}</h2><p>{message}</p><p className="delete-item-name">{itemName}</p>
    <label className="delete-acknowledge"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />Entendo que o registro será excluído</label>
    <label className="field">Digite EXCLUIR para confirmar<input autoComplete="off" value={typed} onChange={event => setTyped(event.target.value)} placeholder="EXCLUIR" /></label>
    <div className="pw-buttons"><button autoFocus className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-danger" disabled={!checked || typed.trim().toLocaleUpperCase('pt-BR') !== 'EXCLUIR'} onClick={onConfirm}>Excluir</button></div>
  </ConfirmDialog>
}
