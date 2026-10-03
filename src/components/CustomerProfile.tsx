import { useEffect, useMemo, useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { watchCustomerReceipts } from '../sync'
import { fmtBRL, fmtDate, saleOutstanding, salePaidAmount, type Customer, type Sale } from '../types'
import { MaskedMoney } from './MaskedMoney'
import { MaskedPII } from './MaskedPII'
import { Modal } from './Modal'

type ReceiptLike = {
  id?: string
  amount?: number
  payment?: Sale['payment']
  date?: string
  recordedAt?: number
  actor?: string
  allocations?: Array<{ saleId: string; amount: number }>
  kind?: 'receipt' | 'adjustment'
  adjustmentOf?: string
}

export const dateLabel = (value?: string | number) => {
  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isFinite(value) && Number.isFinite(date.getTime()) ? fmtDate(date.toISOString()) : 'Data não informada'
  }
  if (!value || !Number.isFinite(Date.parse(value))) return 'Data não informada'
  const civilDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (civilDate) {
    const normalized = new Date(`${value}T00:00:00.000Z`)
    if (!Number.isFinite(normalized.getTime()) || normalized.toISOString().slice(0, 10) !== value) return 'Data não informada'
    return `${civilDate[3]}/${civilDate[2]}/${civilDate[1]}`
  }
  return fmtDate(value)
}

const paymentLabel: Record<Sale['payment'], string> = { dinheiro: 'Dinheiro', cartão: 'Cartão', pix: 'Pix' }

export function CustomerProfile({ customer, sales, onClose, onEdit, onSaveContact }: {
  customer: Customer
  sales: Sale[]
  onClose: () => void
  onEdit?: () => void
  onSaveContact?: (customer: Customer, contact: string) => boolean | void
}) {
  const [receipts, setReceipts] = useState<ReceiptLike[]>([])
  const [receiptError, setReceiptError] = useState('')
  const [receiptLoading, setReceiptLoading] = useState(true)
  const [receiptCached, setReceiptCached] = useState(false)
  const [editingContact, setEditingContact] = useState(false)
  const [contactDraft, setContactDraft] = useState(customer.contact)
  const customerSales = useMemo(() => sales.filter(sale => sale.customerId === customer.id).sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id)), [sales, customer.id])
  const commercialSales = customerSales.filter(sale => sale.status !== 'Presente')
  const total = commercialSales.reduce((sum, sale) => sum + sale.total, 0)
  const received = commercialSales.filter(sale => sale.status !== 'Debitado').reduce((sum, sale) => sum + salePaidAmount(sale), 0)
  const outstanding = commercialSales.filter(sale => sale.status === 'Pendente').reduce((sum, sale) => sum + saleOutstanding(sale), 0)
  const debited = commercialSales.filter(sale => sale.status === 'Debitado').reduce((sum, sale) => sum + saleOutstanding(sale), 0)
  const receiptNet = receipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0)
  const legacyReceived = Math.max(0, Math.round((received - receiptNet) * 100) / 100)
  const debitedCount = customerSales.filter(sale => sale.status === 'Debitado').length

  useEffect(() => {
    setReceiptLoading(true)
    setReceiptCached(false)
    setReceiptError('')
    return watchCustomerReceipts(customer.id, (rows, cached) => { setReceipts(rows); setReceiptCached(cached); setReceiptLoading(false) }, () => { setReceiptLoading(false); setReceiptError('Não foi possível carregar o histórico de recebimentos.') })
  }, [customer.id])

  return <Modal label={`Ficha de ${customer.name}`} onClose={onClose}>
    <div className="cb-profile-dialog">
      <div className="cb-profile-head">
        <div>
          <h3>{customer.name}</h3>
          <div className="cb-profile-meta"><MaskedPII value={customer.contact} type="phone" /><span>·</span><span>Cadastro em {dateLabel(customer.createdAt)}</span></div>
        </div>
        <div className="modal-actions">
          {onSaveContact && <button className="btn btn-secondary btn-sm" onClick={() => { setContactDraft(customer.contact); setEditingContact(true) }}><Pencil size={14} /> Editar telefone</button>}
          {onEdit && !onSaveContact && <button className="btn btn-secondary btn-sm" onClick={onEdit}><Pencil size={14} /> Editar contato</button>}
          <button className="modal-close" aria-label="Fechar ficha" onClick={onClose}><X size={20} /></button>
        </div>
      </div>
      {editingContact && onSaveContact && <div className="cb-profile-edit">
        <label htmlFor="profile-customer-phone">Telefone com DDD</label>
        <input id="profile-customer-phone" value={contactDraft} autoComplete="tel" inputMode="tel" onChange={event => setContactDraft(event.target.value)} />
        <div className="modal-actions"><button className="btn btn-secondary btn-sm" onClick={() => setEditingContact(false)}>Cancelar</button><button className="btn btn-primary btn-sm" onClick={() => { if (onSaveContact(customer, contactDraft) !== false) setEditingContact(false) }}>Salvar telefone</button></div>
      </div>}

      <div className="cb-profile-grid" aria-label="Resumo financeiro do cliente">
        <div className="cb-profile-metric"><small>Total de vendas</small><strong><MaskedMoney value={total} /></strong></div>
        <div className="cb-profile-metric"><small>Recebido registrado</small><strong><MaskedMoney value={received} /></strong></div>
        <div className="cb-profile-metric"><small>Falta receber</small><strong><MaskedMoney value={outstanding} /></strong></div>
        {debited > 0 && <div className="cb-profile-metric"><small>Debitado</small><strong><MaskedMoney value={debited} /></strong></div>}
      </div>
      {debitedCount > 0 && <p className="cb-profile-note" role="status"><strong>{debitedCount} compra{debitedCount === 1 ? '' : 's'} debitada{debitedCount === 1 ? '' : 's'}</strong> fica{debitedCount === 1 ? '' : 'm'} identificada{debitedCount === 1 ? '' : 's'} como débito no valor de <MaskedMoney value={debited} />, sem entrar como recebido.</p>}

      <section className="cb-profile-section" aria-labelledby="customer-profile-purchases">
        <h4 id="customer-profile-purchases">Compras</h4>
        {customerSales.length === 0 ? <p className="hint">Nenhuma compra registrada para este cliente.</p> : <div className="cb-profile-list">
          {customerSales.map(sale => <div key={sale.id}>
            <div><strong>{dateLabel(sale.date)}</strong><br /><small>{sale.items.map(item => `${item.qty}x ${item.name}`).join(', ') || 'Venda sem itens'} · {paymentLabel[sale.payment]}</small></div>
            <div style={{ textAlign: 'right' }}><strong><MaskedMoney value={sale.total} /></strong><br /><small>{sale.status === 'Presente' ? 'Presente' : sale.status === 'Debitado' ? 'Debitado · conferir em Pagamentos' : saleOutstanding(sale) > 0 ? `Falta ${fmtBRL(saleOutstanding(sale))}` : 'Pago'}</small></div>
          </div>)}
        </div>}
      </section>

      <section className="cb-profile-section" aria-labelledby="customer-profile-history">
        <h4 id="customer-profile-history">Histórico de recebimentos</h4>
        {receiptLoading && <p className="hint" role="status">Carregando histórico de recebimentos…</p>}
        {receiptError && <p className="hint" role="status">{receiptError}</p>}
        {!receiptLoading && !receiptError && receiptCached && <p className="hint" role="status">Histórico carregado da cópia local; pode receber atualizações quando houver conexão.</p>}
        {!receiptLoading && !receiptError && legacyReceived > 0 && <p className="cb-profile-note">{fmtBRL(legacyReceived)} corresponde a recebimentos anteriores ao histórico detalhado, sem data conhecida.</p>}
        {!receiptLoading && !receiptError && receipts.length === 0 ? <p className="hint">{legacyReceived > 0 ? 'Nenhum recibo detalhado disponível.' : 'Nenhum recebimento registrado.'}</p> : !receiptLoading && !receiptError && <div className="cb-profile-list">
          {receipts.map(receipt => <div key={receipt.id || `${receipt.recordedAt}-${receipt.amount}`}>
            <div><strong>{receipt.kind === 'adjustment' ? 'Ajuste de recebimento' : 'Recebimento'}</strong><br /><small>{dateLabel(receipt.date || receipt.recordedAt)}{receipt.actor ? ` · ${receipt.actor}` : ''}{receipt.allocations?.length ? ` · ${receipt.allocations.length} venda${receipt.allocations.length === 1 ? '' : 's'}` : ''}</small></div>
            <div style={{ textAlign: 'right' }}><strong><MaskedMoney value={receipt.amount || 0} /></strong><br /><small>{receipt.payment ? paymentLabel[receipt.payment] : 'Ajuste'}</small></div>
          </div>)}
        </div>}
      </section>
    </div>
  </Modal>
}
