import { useRef, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { usePasswordGuard } from './PasswordGate'
import { MaskedMoney } from './MaskedMoney'
import { normalizeCustomerName } from '../customer-matching'
import { fmtDate, type Customer, type Sale } from '../types'
import type { SaleTransfer } from '../sale-adjustments'

export function SaleTransferDialog({ customer, initialSale, sales, customers, onTransfer, onClose }: {
  customer: Customer; sales: Sale[]; customers: Customer[]
  initialSale?: Sale
  onTransfer: (request: SaleTransfer) => boolean; onClose: () => void
}) {
  const { guard } = usePasswordGuard()
  const [saleId, setSaleId] = useState(initialSale?.id || '')
  const [search, setSearch] = useState('')
  const [targetId, setTargetId] = useState('')
  const [confirmation, setConfirmation] = useState<SaleTransfer | null>(null)
  const submitted = useRef(false)
  const history = sales.filter(s => s.customerId === customer.id).sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id))
  const sale = history.find(s => s.id === saleId)
  const targets = customers.filter(c => c.id !== customer.id && normalizeCustomerName(c.name).includes(normalizeCustomerName(search))).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const target = targets.find(c => c.id === targetId)
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
      <p>Itens, pagamentos, data, valor e estoque serão preservados.</p>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={() => setConfirmation(null)}>Voltar</button>
        <button className="btn btn-primary" onClick={confirm}>Confirmar transferência</button>
      </div>
    </> : <div className="form">
      <div className="field">
        <label htmlFor="transfer-sale">Venda</label>
        <select id="transfer-sale" value={saleId} onChange={e => setSaleId(e.target.value)}>
          <option value="">Selecione a venda</option>
          {history.map(s => <option key={s.id} value={s.id}>{fmtDate(s.date)} · {s.items.map(i => `${i.qty}x ${i.name}`).join(' + ')} · {s.status || 'Pago'}</option>)}
        </select>
        {sale && <p>Valor: <MaskedMoney value={sale.total} /> · Pago: <MaskedMoney value={sale.status === 'Pago' ? sale.total : sale.paidAmount || 0} /></p>}
      </div>
      <div className="field">
        <label htmlFor="transfer-search">Buscar cliente destino</label>
        <input id="transfer-search" type="search" value={search} onChange={e => { setSearch(e.target.value); setTargetId('') }} placeholder="Nome do cliente destino" />
      </div>
      <div className="field">
        <label htmlFor="transfer-target">Cliente destino</label>
        <select id="transfer-target" value={targetId} onChange={e => setTargetId(e.target.value)}>
          <option value="">Selecione o cliente destino</option>
          {targets.map(c => <option key={c.id} value={c.id}>{c.name} · {c.id}</option>)}
        </select>
        {!targets.length && <p role="status">Nenhum outro cliente encontrado.</p>}
      </div>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!sale || !target} onClick={() => { if (sale && target) setConfirmation({ sale, target }) }}>Revisar transferência</button>
      </div>
    </div>}
  </ConfirmDialog>
}
