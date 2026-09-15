import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X, CheckCircle2, Trash2, ClipboardPaste, ShoppingCart, History, UserRound, Pencil, Save } from 'lucide-react'
import { Product, Customer, Sale, SaleItem, LOW_STOCK_THRESHOLD, CHANNELS, PAYMENTS, fmtBRL, uid } from '../types'
import { StatusBadge } from './Dashboard'
import { usePasswordGuard } from '../components/PasswordGate'
import { readSalesDraft } from '../sales-draft'
import { QuickSaleView } from './QuickSale'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { editSale, saleEditOperationId, type SaleEdit, type SaleEditFields } from '../edit-sale'
import { sameData } from '../store-merge'

export function SalesView({ products, customers, sales, onSaleAdded, onSaleDeleted, onSaleEdited, onSalesImported, pushToast, draftKey }: {
  draftKey?: string; products: Product[]; customers: Customer[]; sales: Sale[]; onSaleAdded: (s: Sale) => boolean; onSaleDeleted: (sale: Sale) => Promise<boolean>; onSaleEdited: (request: SaleEdit) => Promise<void>; onSalesImported: (sales: Sale[], customers: Customer[]) => boolean; pushToast: (m: string, t?: 'success' | 'error') => void
}) {
  const { guard } = usePasswordGuard()
  const [mode, setMode] = useState<'manual' | 'paste'>(() => readSalesDraft(draftKey).text ? 'paste' : 'manual')
  const [lines, setLines] = useState<SaleItem[]>(() => products.length ? [{ productId: products[0].id, qty: 1 }] : [])
  useEffect(() => { if (!lines.length && products.length) setLines([{ productId: products[0].id, qty: 1 }]) }, [products, lines.length])
  const [payment, setPayment] = useState<Sale['payment']>('pix')
  const [channel, setChannel] = useState<Sale['channel']>('loja')
  const [customerId, setCustomerId] = useState<string>('')
  const [status, setStatus] = useState<Sale['status']>('Pago')
  const [error, setError] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [pendingDeletion, setPendingDeletion] = useState<Sale | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)

  const addLine = () => { if (products.length) setLines(l => [...l, { productId: products[0].id, qty: 1 }]) }
  const updateLine = (idx: number, patch: Partial<SaleItem>) => setLines(l => l.map((x, i) => i === idx ? { ...x, ...patch } : x))
  const removeLine = (idx: number) => setLines(l => l.filter((_, i) => i !== idx))

  const finalItems = Array.from(lines.reduce((items, line) => {
    const product = products.find(item => item.id === line.productId)
    if (!product) return items
    const existing = items.get(product.id)
    items.set(product.id, {
      productId: product.id,
      name: product.name,
      unitPrice: product.price,
      qty: (existing?.qty || 0) + line.qty,
    })
    return items
  }, new Map<string, Sale['items'][number]>()).values())
  const total = finalItems.reduce((a, i) => a + i.unitPrice * i.qty, 0)

  const submit = () => guard('Registrar venda', () => {
    if (finalItems.length === 0 || finalItems.some(i => !i.productId || !Number.isSafeInteger(i.qty) || i.qty <= 0)) { setError('Selecione produto e quantidade válida.'); return }
    if (status === 'Pendente' && !customerId) { setError('Selecione um cliente para uma venda pendente.'); return }
    for (const it of finalItems) {
      const p = products.find(x => x.id === it.productId)
      if (p && it.qty > p.stock) { setError(`Estoque insuficiente para ${p.name} (restam ${p.stock}).`); return }
    }
    const sale: Sale = { id: uid(), date: new Date().toISOString(), items: finalItems, payment, channel, total, customerId: customerId || undefined, status, paidAmount: status === 'Pago' ? total : 0 }
    if (!onSaleAdded(sale)) return
    setLines(products.length ? [{ productId: products[0].id, qty: 1 }] : [])
    setError('')
  })
  const requestDeletion = (sale: Sale) => guard('Excluir venda', () => setPendingDeletion(sale), 'admin')
  const requestEdit = (sale: Sale) => guard('Editar venda', () => setEditingSale(sale), 'admin')
  const confirmDeletion = async () => {
    if (!pendingDeletion || deleting) return
    setDeleting(true)
    const deleted = await onSaleDeleted(pendingDeletion)
    setDeleting(false)
    if (deleted) setPendingDeletion(null)
  }

  return (
    <>
      <div className="page-row">
        <div className="page-title"><h2>Vendas</h2><p>Registre vendas manualmente ou cole o texto da planilha</p></div>
        <button className="btn btn-secondary" onClick={() => setHistoryOpen(true)} aria-haspopup="dialog"><History size={16} /> Histórico de vendas</button>
      </div>

      {/* Toggle: Registrar (manual) / Colar texto (planilha) */}
      <div className="card" style={{ marginBottom: 'var(--sp-5)', background: 'var(--bg-soft, transparent)' }}>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          <button
            className={`btn ${mode === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setMode('manual')}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}
          >
            <ShoppingCart size={16} /> Registrar venda
          </button>
          <button
            className={`btn ${mode === 'paste' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setMode('paste')}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}
          >
            <ClipboardPaste size={16} /> Colar texto (planilha)
          </button>
        </div>
      </div>

      {mode === 'paste' ? (
        <QuickSaleView draftKey={draftKey} products={products} customers={customers} onSalesImported={onSalesImported} pushToast={pushToast} />
      ) : (
        <div className="card">
          {products.length === 0 && (
            <div className="empty-state"><p>Cadastre produtos primeiro para registrar vendas.</p></div>
          )}

          {lines.map((line, idx) => {
            const p = products.find(x => x.id === line.productId)
            return (
              <div key={idx} className="sale-item-row">
                <div className="field">
                  <label htmlFor={`sale-product-${idx}`}>Produto</label>
                  <select id={`sale-product-${idx}`} value={line.productId} onChange={e => updateLine(idx, { productId: e.target.value })}>
                    {products.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name} — {fmtBRL(p.price)}</option>)}
                  </select>
                  {p && p.stock <= LOW_STOCK_THRESHOLD && <span className="hint" style={{ color: 'var(--warn-600)' }}>Estoque baixo: {p.stock}</span>}
                </div>
                <div className="field">
                  <label htmlFor={`sale-qty-${idx}`}>Qtd</label>
                  <input id={`sale-qty-${idx}`} type="number" min={1} step={1} inputMode="numeric" className="num-input" value={line.qty} onChange={e => updateLine(idx, { qty: Math.max(1, Number(e.target.value)) })} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', paddingTop: 26 }}>
                  <span style={{ fontWeight: 700 }}>{fmtBRL((p?.price || 0) * line.qty)}</span>
                  <button className="btn btn-ghost btn-sm" aria-label={`Remover item ${idx + 1}`} onClick={() => removeLine(idx)} disabled={lines.length === 1}><X size={14} /></button>
                </div>
              </div>
            )
          })}

          <button className="btn btn-secondary btn-sm" onClick={addLine}><Plus size={14} /> Adicionar item</button>

          <div className="form-grid" style={{ marginTop: 'var(--sp-6)' }}>
            <div className="field">
              <label>Forma de pagamento</label>
              <select value={payment} onChange={e => setPayment(e.target.value as Sale['payment'])}>
                {PAYMENTS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Canal de venda</label>
              <select value={channel} onChange={e => setChannel(e.target.value as Sale['channel'])}>
                {CHANNELS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Cliente</label>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)}>
                <option value="">Sem cliente</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as Sale['status'])}>
                <option value="Pago">Pago</option>
                <option value="Pendente">Pendente</option>
                <option value="Debitado">Debitado</option>
                <option value="Presente">Presente</option>
              </select>
            </div>
          </div>

          {error && <p style={{ color: 'var(--danger-500)', marginTop: 'var(--sp-4)', fontWeight: 600 }}>{error}</p>}

          <div className="sale-total">
            <span>Total</span>
            <strong>{fmtBRL(total)}</strong>
          </div>
          <div className="modal-actions">
            <button className="btn btn-primary" disabled={!finalItems.length} onClick={submit}><CheckCircle2 size={16} /> Salvar Venda</button>
          </div>
        </div>
      )}

      {historyOpen && <SaleHistory sales={sales} customers={customers} onEdit={requestEdit} onDelete={requestDeletion} onClose={() => setHistoryOpen(false)} />}
      {editingSale && <SaleEditorDialog sale={editingSale} products={products} customers={customers} sales={sales} onClose={() => setEditingSale(null)} onSave={async request => { await onSaleEdited(request); setEditingSale(null) }} />}
      {pendingDeletion && <ConfirmDialog titleId="delete-sale-title" busy={deleting} onCancel={() => setPendingDeletion(null)}>
        <h2 id="delete-sale-title">Excluir esta venda?</h2>
        <p><strong>{customerNameForSale(pendingDeletion, customers)}</strong> · {new Date(pendingDeletion.date).toLocaleDateString('pt-BR')} · {fmtBRL(pendingDeletion.total)}</p>
        <p>Ela será removida do histórico e as quantidades de seus itens voltarão ao estoque atual.</p>
        <p><strong>Outras vendas e seus pagamentos não serão alterados.</strong></p>
        <div className="pw-buttons"><button autoFocus className="btn btn-secondary" disabled={deleting} onClick={() => setPendingDeletion(null)}>Cancelar</button><button className="btn btn-danger" disabled={deleting} onClick={() => void confirmDeletion()}>{deleting ? 'Excluindo…' : 'Excluir venda'}</button></div>
      </ConfirmDialog>}
    </>
  )
}

export function customerNameForSale(sale: Sale, customers: Customer[]) {
  return sale.customerId ? customers.find(customer => customer.id === sale.customerId)?.name || 'Sem cliente' : 'Sem cliente'
}

function SaleHistory({ sales, customers, onEdit, onDelete, onClose }: { sales: Sale[]; customers: Customer[]; onEdit: (sale: Sale) => void; onDelete: (sale: Sale) => void; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog ref={dialogRef} className="history-modal" aria-labelledby="sale-history-title" onCancel={event => { event.preventDefault(); onClose() }}>
      <div className="history-modal-header"><div><h2 id="sale-history-title">Histórico de Vendas</h2><p>{sales.length} {sales.length === 1 ? 'venda registrada' : 'vendas registradas'}</p></div><button className="modal-close" aria-label="Fechar histórico de vendas" onClick={onClose}><X size={20} /></button></div>
      <div className="history-modal-body">
      {sales.length === 0 ? (
        <div className="empty-state"><Trash2 className="icon" size={40} /><p>Histórico vazio.</p></div>
      ) : (
        <>
        <div className="table-wrap sale-history-table-wrap">
          <table className="table">
            <thead><tr><th>Data</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th>Canal</th><th>Status</th><th className="text-right">Total</th><th><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {sales.map(s => (
                <tr key={s.id}>
                  <td>{new Date(s.date).toLocaleDateString('pt-BR') + ' ' + new Date(s.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{customerNameForSale(s, customers)}</td>
                  <td>{s.items.map(i => `${i.name} x${i.qty}`).join(', ')}</td>
                  <td><span className="badge badge-neutral">{s.payment}</span></td>
                  <td><span className="badge badge-brand">{s.channel}</span></td>
                  <td><StatusBadge status={s.status} /></td>
                  <td className="text-right" style={{ fontWeight: 700 }}>{fmtBRL(s.total)}</td>
                  <td><div className="sale-history-actions"><button className="btn btn-ghost btn-sm" title="Editar venda" aria-label={`Editar venda de ${customerNameForSale(s, customers)}`} onClick={() => onEdit(s)}><Pencil size={15} /></button><button className="btn btn-ghost btn-sm" title="Excluir venda" aria-label={`Excluir venda de ${customerNameForSale(s, customers)}`} onClick={() => onDelete(s)}><Trash2 size={15} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sale-history-cards">
          {sales.map(s => <article className="sale-history-card" key={s.id}>
            <div className="sale-history-card-top"><div><span className="sale-history-label">Cliente</span><strong><UserRound size={15} /> {customerNameForSale(s, customers)}</strong></div><div className="sale-history-actions"><button className="btn btn-ghost btn-sm" title="Editar venda" aria-label={`Editar venda de ${customerNameForSale(s, customers)}`} onClick={() => onEdit(s)}><Pencil size={15} /></button><button className="btn btn-ghost btn-sm" title="Excluir venda" aria-label={`Excluir venda de ${customerNameForSale(s, customers)}`} onClick={() => onDelete(s)}><Trash2 size={15} /></button></div></div>
            <p className="sale-history-date">{new Date(s.date).toLocaleDateString('pt-BR') + ' · ' + new Date(s.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="sale-history-items">{s.items.map(i => `${i.name} x${i.qty}`).join(', ')}</p>
            <div className="sale-history-meta"><span className="badge badge-neutral">{s.payment}</span><span className="badge badge-brand">{s.channel}</span><StatusBadge status={s.status} /><strong>{fmtBRL(s.total)}</strong></div>
          </article>)}
        </div>
        </>
      )}
      </div>
    </dialog>
  )
}

const localDateTime = (value: string) => {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19)
}

function SaleEditorDialog({ sale, products, customers, sales, onClose, onSave }: { sale: Sale; products: Product[]; customers: Customer[]; sales: Sale[]; onClose: () => void; onSave: (request: SaleEdit) => Promise<void> }) {
  const [form, setForm] = useState<SaleEditFields>(() => ({
    customerId: sale.customerId || '', date: localDateTime(sale.date), payment: sale.payment,
    channel: sale.channel, status: sale.status || 'Pago', items: sale.items.map(item => ({ productId: item.productId, qty: item.qty })),
  }))
  const [operationId] = useState(saleEditOperationId)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const calculation = useMemo(() => {
    try {
      const source = { products, customers, sales }
      const next = editSale(source, sale, form)
      return { reviewed: next.sales.find(item => item.id === sale.id)!, changed: !sameData(source, next), error: '' }
    } catch (error) {
      return { reviewed: null, changed: false, error: (error as Error).message }
    }
  }, [products, customers, sales, sale, form])
  const patch = (change: Partial<SaleEditFields>) => { setForm(current => ({ ...current, ...change })); setSubmitError('') }
  const patchItem = (index: number, change: Partial<SaleItem>) => patch({ items: form.items.map((item, current) => current === index ? { ...item, ...change } : item) })
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!calculation.reviewed) { setSubmitError(calculation.error); return }
    if (!calculation.changed) { setSubmitError('Faça alguma alteração antes de salvar.'); return }
    if (busy) return
    setBusy(true); setSubmitError('')
    try { await onSave({ sale, changes: form, reviewed: calculation.reviewed, operationId }) }
    catch (error) { setSubmitError((error as Error).message) }
    finally { setBusy(false) }
  }
  return <ConfirmDialog titleId="edit-sale-title" busy={busy} onCancel={onClose} className="sale-editor-dialog">
    <form className="sale-editor" onSubmit={save}>
      <div className="sale-editor-heading"><div><span className="sale-history-label">Correção segura</span><h2 id="edit-sale-title">Editar venda</h2><p>{customerNameForSale(sale, customers)} · {fmtBRL(sale.total)}</p></div><button type="button" className="modal-close" aria-label="Fechar edição" disabled={busy} onClick={onClose}><X size={20}/></button></div>
      <div className="sale-editor-scroll">
        <div className="sale-editor-fields">
          <label>Cliente<select value={form.customerId} onChange={event => patch({ customerId: event.target.value })}><option value="">Sem cliente</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
          <label>Data e hora<input type="datetime-local" step="1" value={form.date} onChange={event => patch({ date: event.target.value })}/></label>
          <label>Pagamento<select value={form.payment} onChange={event => patch({ payment: event.target.value as Sale['payment'] })}>{PAYMENTS.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
          <label>Canal<select value={form.channel} onChange={event => patch({ channel: event.target.value as Sale['channel'] })}>{CHANNELS.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
          <label>Situação<select value={form.status} onChange={event => patch({ status: event.target.value as SaleEditFields['status'] })}>{['Pago', 'Pendente', 'Debitado', 'Presente'].map(value => <option key={value}>{value}</option>)}</select></label>
        </div>
        <div className="sale-editor-items-heading"><div><strong>Itens da venda</strong><small>O estoque será ajustado somente pela diferença.</small></div><button type="button" className="btn btn-secondary btn-sm" disabled={!products.length || form.items.length >= 100} onClick={() => patch({ items: [...form.items, { productId: products[0]?.id || '', qty: 1 }] })}><Plus size={14}/> Item</button></div>
        <div className="sale-editor-items">{form.items.map((item, index) => {
          const product = products.find(current => current.id === item.productId)
          const legacy = sale.items.find(current => current.productId === item.productId)
          const originalQty = sale.items.filter(current => current.productId === item.productId).reduce((sum, current) => sum + current.qty, 0)
          return <div className="sale-editor-item" key={`${index}-${item.productId}`}><label>Produto<select value={item.productId} onChange={event => patchItem(index, { productId: event.target.value })}>{!product && legacy && <option value={legacy.productId}>{legacy.name} · removido do cadastro</option>}{products.map(current => <option key={current.id} value={current.id}>{current.emoji} {current.name} — {fmtBRL(current.price)}</option>)}</select></label><label>Qtd.<input type="number" inputMode="numeric" min="1" max="100000" step="1" value={item.qty} onChange={event => patchItem(index, { qty: Number(event.target.value) })}/>{product && <small>Disponível: {product.stock + originalQty}</small>}</label><button type="button" className="btn btn-ghost btn-sm" aria-label={`Remover item ${index + 1}`} disabled={form.items.length === 1} onClick={() => patch({ items: form.items.filter((_, current) => current !== index) })}><Trash2 size={15}/></button></div>
        })}</div>
        {(submitError || calculation.error) && <p className="sale-editor-error" role="alert">{submitError || calculation.error}</p>}
      </div>
      <div className="sale-editor-footer"><div><small>Novo total</small><strong>{calculation.reviewed ? fmtBRL(calculation.reviewed.total) : '—'}</strong></div><div><button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={busy || !calculation.reviewed}><Save size={16}/>{busy ? 'Salvando…' : 'Salvar alterações'}</button></div></div>
    </form>
  </ConfirmDialog>
}
