import { useMemo, useRef, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'
import { SearchableSelect } from './SearchableSelect'
import { usePasswordGuard } from './PasswordGate'
import { MaskedMoney } from './MaskedMoney'
import { MaskedPII } from './MaskedPII'
import { fmtDate, type Customer, type Sale } from '../types'
import type { SaleTransfer } from '../sale-adjustments'

const phoneDigits = (value: string) => value.replace(/\D/g, '')

const saleLabel = (sale: Sale) => sale.items.map(item => `${item.qty}x ${item.name}`).join(' + ') || 'Venda sem itens'

export function SaleTransferDialog({ customer, initialSale, sales, customers, onTransfer, onClose }: {
  customer: Customer; sales: Sale[]; customers: Customer[]
  initialSale?: Sale
  onTransfer: (request: SaleTransfer) => boolean; onClose: () => void
}) {
  const { guard } = usePasswordGuard()
  const history = useMemo(() => sales.filter(s => s.customerId === customer.id).sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id)), [sales, customer.id])
  const [saleId, setSaleId] = useState(initialSale?.id || '')
  const [targetId, setTargetId] = useState('')
  const [confirmation, setConfirmation] = useState<SaleTransfer | null>(null)
  const submitted = useRef(false)
  const sale = history.find(s => s.id === saleId)
  const targetOptions = customers
    .filter(c => c.id !== customer.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .map(c => ({ id: c.id, name: c.name, description: phoneDigits(c.contact) ? c.contact : 'telefone não informado' }))
  const saleOptions = history.map(s => ({
    id: s.id,
    name: `${fmtDate(s.date)} · ${saleLabel(s)}`,
    description: `${s.status || 'Pago'} · total ${s.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
  }))
  const target = customers.find(c => c.id === targetId)

  const confirm = () => {
    if (!confirmation || submitted.current) return
    guard('Transferir venda', () => {
      submitted.current = true
      if (onTransfer(confirmation)) onClose()
      else { submitted.current = false; setConfirmation(null) }
    })
  }

  return <ConfirmDialog titleId="sale-transfer-title" busy={false} onCancel={onClose}>
    <h3 id="sale-transfer-title">Transferir venda de {customer.name}</h3>
    {confirmation ? <>
      <p>Transferir a venda de <MaskedMoney value={confirmation.sale.total} />, em {fmtDate(confirmation.sale.date)}, de <strong>{customer.name}</strong> para <strong>{confirmation.target.name}</strong>?</p>
      <p>Itens, pagamentos e data serão preservados.</p>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={() => setConfirmation(null)}>Voltar</button>
        <button className="btn btn-primary" onClick={confirm}><ArrowLeftRight size={15} /> Confirmar transferência</button>
      </div>
    </> : <div className="form">
      <SearchableSelect label="Venda" value={saleId} onChange={setSaleId} options={saleOptions} emptyLabel="Selecione a venda" required />
      {sale && <p className="hint">Valor: <MaskedMoney value={sale.total} /> · Recebido: <MaskedMoney value={sale.status === 'Pago' ? sale.total : sale.paidAmount || 0} /></p>}
      <SearchableSelect label="Cliente destino" value={targetId} onChange={setTargetId} options={targetOptions} emptyLabel="Selecione o cliente destino" required />
      {!targetOptions.length && <p role="status">Nenhum outro cliente encontrado.</p>}
      {target && <p className="hint">Telefone: <MaskedPII value={target.contact} type="phone" /></p>}
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!sale || !target} onClick={() => { if (sale && target) setConfirmation({ sale, target }) }}>Revisar transferência</button>
      </div>
    </div>}
  </ConfirmDialog>
}
