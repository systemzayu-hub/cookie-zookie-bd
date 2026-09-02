import { useState } from 'react'
import { Plus, X, CheckCircle2, Trash2 } from 'lucide-react'
import { Product, Customer, Sale, SaleItem, LOW_STOCK_THRESHOLD, CHANNELS, PAYMENTS, fmtBRL } from '../types'
import { StatusBadge } from './Dashboard'

export function SalesView({ products, customers, sales, onSaleAdded }: {
  products: Product[]; customers: Customer[]; sales: Sale[]; onSaleAdded: (s: Sale) => void
}) {
  const [lines, setLines] = useState<SaleItem[]>(() => products.length ? [{ productId: products[0].id, qty: 1 }] : [])
  const [payment, setPayment] = useState<Sale['payment']>('pix')
  const [channel, setChannel] = useState<Sale['channel']>('loja')
  const [customerId, setCustomerId] = useState<string>('')
  const [status, setStatus] = useState<Sale['status']>('Pago')
  const [error, setError] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)

  const addLine = () => { if (products.length) setLines(l => [...l, { productId: products[0].id, qty: 1 }]) }
  const updateLine = (idx: number, patch: Partial<SaleItem>) => setLines(l => l.map((x, i) => i === idx ? { ...x, ...patch } : x))
  const removeLine = (idx: number) => setLines(l => l.filter((_, i) => i !== idx))

  const finalItems = lines.map(l => {
    const p = products.find(x => x.id === l.productId)
    return { ...l, name: p?.name || '?', unitPrice: p?.price || 0 }
  })
  const total = finalItems.reduce((a, i) => a + i.unitPrice * i.qty, 0)

  const submit = () => {
    if (finalItems.length === 0 || finalItems.some(i => !i.productId || i.qty <= 0)) { setError('Selecione produto e quantidade válida.'); return }
    for (const it of finalItems) {
      const p = products.find(x => x.id === it.productId)
      if (p && it.qty > p.stock) { setError(`Estoque insuficiente para ${p.name} (restam ${p.stock}).`); return }
    }
    const sale: Sale = { id: Math.random().toString(36).slice(2) + Date.now().toString(36), date: new Date().toISOString(), items: finalItems, payment, channel, total, customerId: customerId || undefined, status }
    onSaleAdded(sale)
    setLines(products.length ? [{ productId: products[0].id, qty: 1 }] : [])
    setError('')
  }

  return (
    <>
      <div className="page-row">
        <div className="page-title"><h2>Registrar Venda</h2><p>Armazene uma venda da loja</p></div>
        <button className="btn btn-secondary" onClick={() => setHistoryOpen(h => !h)}>{historyOpen ? 'Fechar' : 'Histórico'} de vendas</button>
      </div>

      <div className="card">
        {products.length === 0 && (
          <div className="empty-state"><p>Cadastre produtos primeiro para registrar vendas.</p></div>
        )}

        {lines.map((line, idx) => {
          const p = products.find(x => x.id === line.productId)
          return (
            <div key={idx} className="sale-item-row">
              <div className="field">
                <label>Produto</label>
                <select value={line.productId} onChange={e => updateLine(idx, { productId: e.target.value })}>
                  {products.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name} — {fmtBRL(p.price)}</option>)}
                </select>
                {p && p.stock <= LOW_STOCK_THRESHOLD && <span className="hint" style={{ color: 'var(--warn-600)' }}>Estoque baixo: {p.stock}</span>}
              </div>
              <div className="field">
                <label>Qtd</label>
                <input type="number" min={1} className="num-input" value={line.qty} onChange={e => updateLine(idx, { qty: Math.max(1, Number(e.target.value)) })} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', paddingTop: 26 }}>
                <span style={{ fontWeight: 700 }}>{fmtBRL((p?.price || 0) * line.qty)}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => removeLine(idx)} disabled={lines.length === 1}><X size={14} /></button>
              </div>
            </div>
          )
        })}

        <button className="btn btn-secondary btn-sm" onClick={addLine}><Plus size={14} /> Adicionar item</button>

        <div className="form-grid" style={{ marginTop: 'var(--space-6)' }}>
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

        {error && <p style={{ color: 'var(--danger-500)', marginTop: 'var(--space-4)', fontWeight: 600 }}>{error}</p>}

        <div className="sale-total">
          <span>Total</span>
          <strong>{fmtBRL(total)}</strong>
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={submit}><CheckCircle2 size={16} /> Salvar Venda</button>
        </div>
      </div>

      {historyOpen && <SaleHistory sales={sales} />}
    </>
  )
}

function SaleHistory({ sales }: { sales: Sale[] }) {
  return (
    <div className="card" style={{ marginTop: 'var(--space-6)' }}>
      <h3 className="card-title">Histórico de Vendas</h3>
      {sales.length === 0 ? (
        <div className="empty-state"><Trash2 className="icon" size={40} /><p>Histórico vazio.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Data</th><th>Itens</th><th>Pagamento</th><th>Canal</th><th>Status</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {sales.map(s => (
                <tr key={s.id}>
                  <td>{new Date(s.date).toLocaleDateString('pt-BR') + ' ' + new Date(s.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{s.items.map(i => `${i.name} x${i.qty}`).join(', ')}</td>
                  <td><span className="badge badge-neutral">{s.payment}</span></td>
                  <td><span className="badge badge-brand">{s.channel}</span></td>
                  <td><StatusBadge status={s.status} /></td>
                  <td className="text-right" style={{ fontWeight: 700 }}>{fmtBRL(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
