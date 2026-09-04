import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Package, Check } from 'lucide-react'
import { Product, CATEGORIES, CAT_LABEL, LOW_STOCK_THRESHOLD, fmtBRL } from '../types'
import { CUSTOS_PRODUCAO } from '../pendencias-avancado'
import { usePasswordGuard } from '../components/PasswordGate'
import { logAction } from '../audit'
import { CookieArt } from '../components/CookieArt'
import { MaskedMoney } from '../components/MaskedMoney'

// Modal de confirmação dupla para exclusão (reutilizável local)
function ConfirmDeleteModal({ isOpen, onClose, onConfirm, title, message, itemName }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; itemName: string
}) {
  const [checked, setChecked] = useState(false)
  const [typed, setTyped] = useState('')
  const canConfirm = checked && typed.toUpperCase() === 'EXCLUIR'
  if (!isOpen) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
        </div>
        <div className="form" style={{ padding: 'var(--sp-4)' }}>
          <p style={{ color: 'var(--tx-1)', marginBottom: 'var(--sp-4)' }}>{message}</p>
          <p style={{ fontWeight: 600, color: 'var(--cz-600)', marginBottom: 'var(--sp-4)' }}>{itemName}</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', cursor: 'pointer', marginBottom: 'var(--sp-3)' }}>
            <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
            <span>Entendo que é irreversível</span>
          </label>
          <div className="field">
            <label>Digite EXCLUIR para confirmar</label>
            <input type="text" value={typed} onChange={e => setTyped(e.target.value)} placeholder="EXCLUIR" style={{ textTransform: 'uppercase' }} />
          </div>
          <div className="modal-actions" style={{ marginTop: 'var(--sp-4)' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn btn-danger" onClick={onConfirm} disabled={!canConfirm}>Excluir</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ProductsView({ products, setProducts, pushToast }: {
  products: Product[]; setProducts: React.Dispatch<React.SetStateAction<Product[]>>; pushToast: (m: string, t?: 'success' | 'error') => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', price: '', category: 'tradicional', stock: '', emoji: '🍪' })
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const { guard } = usePasswordGuard()

  // Ao digitar um cookie conhecido, sugere o preço de venda do cadastro de custos
  const changeName = (name: string) => {
    const c = CUSTOS_PRODUCAO.find(x => x.name.toLowerCase() === name.trim().toLowerCase())
    setForm(f => ({
      ...f,
      name,
      price: c ? String(c.precoVenda) : f.price,
    }))
  }

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

  const remove = (id: string) => {
      const p = products.find(x => x.id === id)
      if (p) setDeleteConfirm({ id: p.id, name: p.name })
    }

    const confirmDelete = () => {
      if (!deleteConfirm) return
      guard('Excluir produto', () => {
        setProducts(ps => ps.filter(p => p.id !== deleteConfirm.id))
        pushToast('Produto removido.')
        logAction('produto', `Excluiu produto "${deleteConfirm.name}"`)
        setDeleteConfirm(null)
      })
    }

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
              <div className="p-emoji"><CookieArt name={p.name} size={76} /></div>
              <div className="p-name">{p.name}</div>
                            <div className="p-price"><MaskedMoney value={p.price} className="font-display" /></div>
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
                    <div className="field"><label>Nome do cookie</label><input value={form.name} onChange={e => changeName(e.target.value)} placeholder="ex: Chocolate, Aveia, Red Velvet" /></div>
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

            {deleteConfirm && (
              <ConfirmDeleteModal
                isOpen={true}
                onClose={() => setDeleteConfirm(null)}
                onConfirm={confirmDelete}
                title="Excluir produto"
                message="Esta ação não pode ser desfeita. O produto será removido permanentemente."
                itemName={deleteConfirm.name}
              />
            )}
    </>
  )
}
