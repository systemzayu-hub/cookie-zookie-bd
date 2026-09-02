import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Package } from 'lucide-react'
import { Product, CATEGORIES, CAT_LABEL, LOW_STOCK_THRESHOLD, fmtBRL } from '../types'
import { usePasswordGuard } from '../components/PasswordGate'
import { logAction } from '../audit'
import { CookieArt } from '../components/CookieArt'

export function ProductsView({ products, setProducts, pushToast }: {
  products: Product[]; setProducts: React.Dispatch<React.SetStateAction<Product[]>>; pushToast: (m: string, t?: 'success' | 'error') => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', price: '', category: 'tradicional', stock: '', emoji: '🍪' })
  const { guard } = usePasswordGuard()

  const openNew = () => { setEditing(null); setForm({ name: '', price: '', category: 'tradicional', stock: '', emoji: '🍪' }); setShowModal(true) }
  const openEdit = (p: Product) => { setEditing(p); setForm({ name: p.name, price: String(p.price), category: p.category, stock: String(p.stock), emoji: p.emoji || '🍪' }); setShowModal(true) }

  const submit = () => {
    const name = form.name.trim()
    const price = Number(form.price)
    const stock = Number(form.stock)
    if (!name || isNaN(price) || price <= 0 || isNaN(stock) || stock < 0) { pushToast('Preencha todos os campos corretamente.', 'error'); return }
    const data = { name, price, category: form.category, stock, emoji: form.emoji || '🍪' }
    if (editing) {
      guard('Alterar produto', () => {
        setProducts(ps => ps.map(p => p.id === editing.id ? { ...p, ...data } : p))
        setShowModal(false)
        logAction('produto', `Editou produto "${editing.name}" → "${name}" (${fmtBRL(price)})`)
        pushToast('Produto atualizado!')
      })
    } else {
      setProducts(ps => [{ id: Math.random().toString(36).slice(2) + Date.now().toString(36), ...data }, ...ps])
      logAction('produto', `Cadastrou produto "${name}" (${fmtBRL(price)})`)
      pushToast('Produto adicionado!')
    }
    if (!editing) setShowModal(false)
  }

  const remove = (id: string) => guard('Excluir produto', () => {
    const p = products.find(x => x.id === id)
    setProducts(ps => ps.filter(p => p.id !== id)); pushToast('Produto removido.')
    logAction('produto', `Excluiu produto "${p?.name || id}"`)
  })

  return (
    <>
      <div className="page-row">
        <div className="page-title"><h2>Produtos</h2><p>Cadastre os sabores de cookie e seus preços</p></div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Novo Produto</button>
      </div>

      {products.length === 0 ? (
        <div className="card empty-state"><Package className="icon" size={48} /><p>Nenhum produto cadastrado.</p></div>
      ) : (
        <div className="product-grid">
          {products.map(p => (
            <div key={p.id} className="product-card">
              <div className="p-emoji"><CookieArt name={p.name} size={64} /></div>
              <div className="p-name">{p.name}</div>
              <div className="p-price">{fmtBRL(p.price)}</div>
              <span className="badge p-cat badge-neutral">{CAT_LABEL[p.category]}</span>
              <span className={`badge p-cat ${p.stock <= LOW_STOCK_THRESHOLD ? 'badge-warning' : 'badge-brand'}`}>Estoque: {p.stock}</span>
              <div className="p-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}><Pencil size={14} /> Editar</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Editar Produto' : 'Novo Produto'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div className="form">
              <div className="field"><label>Nome do cookie</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ex: Chocolate, Aveia, Red Velvet" /></div>
              <div className="form-grid">
                <div className="field"><label>Preço (R$)</label><input type="number" min={0} step="0.01" className="num-input" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
                <div className="field"><label>Estoque inicial</label><input type="number" min={0} className="num-input" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} /></div>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Categoria</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                  </select>
                </div>
                <div className="field"><label>Emoji</label><input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} maxLength={4} /></div>
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={submit}>{editing ? 'Salvar' : 'Adicionar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
