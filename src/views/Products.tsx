import { Modal } from '../components/Modal'
import { DeleteConfirmation } from '../components/DeleteConfirmation'
import { SearchInput } from '../components/SearchInput'
import { matchesSearch } from '../search'
import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Package, Check } from 'lucide-react'
import { Product, Sale, CATEGORIES, CAT_LABEL, LOW_STOCK_THRESHOLD, fmtBRL, uid } from '../types'
import { CUSTOS_PRODUCAO } from '../pendencias-avancado'
import { usePasswordGuard } from '../components/PasswordGate'
import { logAction } from '../audit'
import { CookieArt } from '../components/CookieArt'
import { MaskedMoney } from '../components/MaskedMoney'

export function ProductsView({ products, setProducts, sales, pushToast }: {
  products: Product[]; setProducts: React.Dispatch<React.SetStateAction<Product[]>>; sales: Sale[]; pushToast: (m: string, t?: 'success' | 'error') => void
}) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('name')
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
      price: !editing && c ? String(c.precoVenda) : f.price,
    }))
  }

  const openNew = () => { setEditing(null); setForm({ name: '', price: '', category: 'tradicional', stock: '', emoji: '🍪' }); setShowModal(true) }
  const openEdit = (p: Product) => { setEditing(p); setForm({ name: p.name, price: String(p.price), category: p.category, stock: String(p.stock), emoji: p.emoji || '🍪' }); setShowModal(true) }

  const submit = () => {
    const name = form.name.trim()
    const price = Number(form.price)
    const stock = Number(form.stock)
    if (!name || !Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(stock) || stock < 0) { pushToast('Preencha todos os campos corretamente.', 'error'); return }
    if (name.length > 100) { pushToast('O nome deve ter até 100 caracteres.', 'error'); return }
    if (products.some(product => product.id !== editing?.id && product.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) { pushToast('Já existe um produto com esse nome.', 'error'); return }
    const data = { name, price, category: form.category, stock, emoji: form.emoji || '🍪' }
    if (editing) {
      guard('Alterar produto', () => {
        setProducts(ps => ps.map(p => p.id === editing.id ? { ...p, ...data } : p))
        setShowModal(false)
        logAction('produto', `Editou produto "${editing.name}" → "${name}" (${fmtBRL(price)})`)
        pushToast('Produto atualizado!')
      })
    } else {
      guard('Cadastrar produto', () => {
        setProducts(ps => [{ id: uid(), ...data }, ...ps])
        logAction('produto', `Cadastrou produto "${name}" (${fmtBRL(price)})`)
        pushToast('Produto adicionado!')
        setShowModal(false)
      })
    }
  }

  const remove = (id: string) => {
      const p = products.find(x => x.id === id)
      if (sales.some(sale => sale.items.some(item => item.productId === id))) {
        pushToast('Este produto possui vendas no histórico e não pode ser excluído. Edite o estoque para zero.', 'error')
        return
      }
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

  const visible = products.filter(p => matchesSearch(search, p.name, CAT_LABEL[p.category]) && (category === 'all' || p.category === category)).sort((a, b) => sort === 'stock' ? a.stock - b.stock : sort === 'price' ? a.price - b.price : a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <>
      <div className="page-row">
        <div className="page-title"><h2>Produtos</h2><p>Cadastre os sabores de cookie e seus preços</p></div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Novo Produto</button>
      </div>

      <div className="list-toolbar card"><SearchInput label="Buscar produto" value={search} onChange={setSearch} placeholder="Nome ou categoria…" /><label>Categoria<select value={category} onChange={e => setCategory(e.target.value)}><option value="all">Todas as categorias</option>{CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}</select></label><label>Ordenar<select value={sort} onChange={e => setSort(e.target.value)}><option value="name">Nome A–Z</option><option value="stock">Menor estoque</option><option value="price">Menor preço</option></select></label><span className="result-count" role="status">{visible.length} de {products.length} produtos</span>{(search || category !== 'all') && <button className="btn btn-ghost" onClick={() => {setSearch(''); setCategory('all')}}>Limpar filtros</button>}</div>
      {visible.length === 0 ? (
        <div className="card empty-state"><Package className="icon" size={48} /><p>{products.length ? 'Nenhum produto corresponde aos filtros.' : 'Nenhum produto cadastrado.'}</p></div>
      ) : (
        <div className="product-grid">
          {visible.map(p => (
            <div key={p.id} className="product-card">
              <div className="p-emoji"><CookieArt name={p.name} size={76} /></div>
              <div className="p-name">{p.name}</div>
                            <div className="p-price"><MaskedMoney value={p.price} className="font-display" /></div>
              <span className="badge p-cat badge-neutral">{CAT_LABEL[p.category]}</span>
              <span className={`badge p-cat ${p.stock <= LOW_STOCK_THRESHOLD ? 'badge-warning' : 'badge-brand'}`}>Estoque: {p.stock}</span>
              <div className="p-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}><Pencil size={14} /> Editar</button>
                <button className="btn btn-danger btn-sm" aria-label={`Excluir ${p.name}`} onClick={() => remove(p.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
              <Modal label={editing ? 'Editar produto' : 'Novo produto'} onClose={() => setShowModal(false)}>
                  <div className="modal-header">
                    <h3>{editing ? 'Editar Produto' : 'Novo Produto'}</h3>
                    <button className="modal-close" aria-label="Fechar" onClick={() => setShowModal(false)}><X size={20} /></button>
                  </div>
                  <div className="form">
                    <div className="field"><label>Nome do cookie</label><input aria-label="Nome do cookie" value={form.name} maxLength={100} onChange={e => changeName(e.target.value)} placeholder="ex: Chocolate, Aveia, Red Velvet" /></div>
                    <div className="form-grid">
                      <div className="field"><label>Preço (R$)</label><input aria-label="Preço (R$)" type="number" min={0} step="0.01" className="num-input" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
                      <div className="field"><label>{editing ? "Estoque atual" : "Estoque inicial"}</label><input aria-label={editing ? "Estoque atual" : "Estoque inicial"} type="number" min={0} className="num-input" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} /></div>
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label>Categoria</label>
                        <select aria-label="Categoria" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                          {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                        </select>
                      </div>
                      <div className="field"><label>Emoji</label><input aria-label="Emoji" value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} maxLength={4} /></div>
                    </div>
                    <div className="modal-actions">
                      <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                      <button className="btn btn-primary" onClick={submit}>{editing ? 'Salvar' : 'Adicionar'}</button>
                    </div>
                  </div>
              </Modal>
            )}

            {deleteConfirm && (
              <DeleteConfirmation
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
