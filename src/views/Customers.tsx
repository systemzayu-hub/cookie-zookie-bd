import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, X, Users, ShoppingBag, AlertCircle, CheckCircle2, Check } from 'lucide-react'
import { Customer, Sale, fmtBRL, uid } from '../types'
import { usePasswordGuard } from '../components/PasswordGate'
import { logAction } from '../audit'
import { MaskedMoney } from '../components/MaskedMoney'
import { MaskedPII } from '../components/MaskedPII'

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
      <div className="modal modal-sm" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
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

export function CustomersView({ customers, setCustomers, sales, pushToast }: {
  customers: Customer[]; setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>; sales: Sale[]; pushToast: (m: string, t?: 'success' | 'error') => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState({ name: '', contact: '' })
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const { guard } = usePasswordGuard()

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return digits ? `(${digits}` : ''
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  const openNew = () => { setEditing(null); setForm({ name: '', contact: '' }); setShowModal(true) }
  const openEdit = (c: Customer) => { setEditing(c); setForm({ name: c.name, contact: c.contact }); setShowModal(true) }

  const submit = () => {
    const name = form.name.trim()
    const contact = form.contact.trim()
    if (!name) { pushToast('Informe o nome.', 'error'); return }
    if (!/^\(\d{2}\) \d{4,5}-\d{4}$/.test(contact)) { pushToast('Informe um telefone válido com DDD.', 'error'); return }
    if (name.length > 120 || contact.length > 120) { pushToast('Nome e contato devem ter até 120 caracteres.', 'error'); return }
    if (customers.some(customer => customer.id !== editing?.id && customer.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) { pushToast('Já existe um cliente com esse nome.', 'error'); return }
    if (editing) {
      guard('Alterar cliente', () => {
        setCustomers(cs => cs.map(c => c.id === editing.id ? { ...c, name, contact } : c))
        setShowModal(false)
        logAction('cliente', `Editou cliente "${editing.name}"`)
        pushToast('Cliente atualizado!')
      })
    } else {
      guard('Cadastrar cliente', () => {
        setCustomers(cs => [{ id: uid(), name, contact, createdAt: new Date().toISOString() }, ...cs])
        logAction('cliente', `Cadastrou cliente "${name}"`)
        pushToast('Cliente adicionado!')
        setShowModal(false)
      })
    }
  }

  const remove = (id: string) => {
      const c = customers.find(x => x.id === id)
      if (sales.some(sale => sale.customerId === id)) {
        pushToast('Este cliente possui vendas no histórico e não pode ser excluído.', 'error')
        return
      }
      if (c) setDeleteConfirm({ id: c.id, name: c.name })
    }

    const confirmDelete = () => {
      if (!deleteConfirm) return
      guard('Excluir cliente', () => {
        setCustomers(cs => cs.filter(c => c.id !== deleteConfirm.id))
        pushToast('Cliente removido.')
        logAction('cliente', `Excluiu cliente "${deleteConfirm.name}"`)
        setDeleteConfirm(null)
      })
    }

  const spendOf = (id: string) => sales.filter(s => s.customerId === id).reduce((a, s) => a + s.total, 0)
  const countOf = (id: string) => sales.filter(s => s.customerId === id).length
  const cookiesOf = (id: string) => sales.filter(s => s.customerId === id).reduce((total, sale) => total + sale.items.reduce((qty, item) => qty + item.qty, 0), 0)

  const clientStatus = useMemo(() => {
    const map = new Map<string, 'Pago' | 'Pendente' | 'Debitado' | 'Sem vendas'>()
    customers.forEach(c => {
      const clientSales = sales.filter(s => s.customerId === c.id)
      if (clientSales.length === 0) {
        map.set(c.id, 'Sem vendas')
      } else if (clientSales.some(s => s.status === 'Pendente' || s.status === 'Debitado')) {
        map.set(c.id, clientSales.some(s => s.status === 'Pendente') ? 'Pendente' : 'Debitado')
      } else {
        map.set(c.id, 'Pago')
      }
    })
    return map
  }, [customers, sales])

  const paidCount = customers.filter(c => clientStatus.get(c.id) === 'Pago').length
  const pendingCount = customers.filter(c => clientStatus.get(c.id) === 'Pendente').length
  const debitedCount = customers.filter(c => clientStatus.get(c.id) === 'Debitado').length
  const noSalesCount = customers.filter(c => clientStatus.get(c.id) === 'Sem vendas').length

  const top = [...customers].map(c => ({
    ...c, spent: spendOf(c.id), purchases: countOf(c.id), cookies: cookiesOf(c.id)
  })).sort((a, b) => b.spent - a.spent).slice(0, 5)

  return (
    <>
      <div className="page-row">
        <div className="page-title"><h2>Clientes</h2><p>Cadastro e histórico de compras</p></div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Novo Cliente</button>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card">
          <h3 className="card-title">Top clientes</h3>
          {top.length === 0 ? <div className="empty-state"><Users className="icon" size={40} /><p>Sem clientes ainda.</p></div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {top.map((c, i) => (
                              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', minWidth: 0 }}>
                                <span style={{ fontWeight: 700, color: 'var(--cz-600)', width: 20, flexShrink: 0 }}>{i + 1}º</span>
                                <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{c.name}</span>
                                <span className="badge badge-neutral" style={{ whiteSpace: 'nowrap' }}>{c.purchases} compras / {c.cookies} cookies</span>
                                <strong style={{ whiteSpace: 'nowrap' }}><MaskedMoney value={c.spent} /></strong>
                              </div>
                            ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">Status dos clientes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <CheckCircle2 size={20} color="var(--ok-500)" />
              <span style={{ flex: 1 }}>Clientes Pagos</span>
              <strong>{paidCount}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <AlertCircle size={20} color="var(--warn-500)" />
              <span style={{ flex: 1 }}>Pendentes</span>
              <strong>{pendingCount}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <AlertCircle size={20} color="var(--danger-500)" />
              <span style={{ flex: 1 }}>Debitados</span>
              <strong>{debitedCount}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', opacity: 0.6 }}>
              <Users size={20} color="var(--tx-3)" />
              <span style={{ flex: 1 }}>Sem compras</span>
              <strong>{noSalesCount}</strong>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Total de clientes</h3>
          <div className="stat-card">
            <span className="stat-value">{customers.length}</span>
            <span className="stat-label">clientes cadastrados</span>
          </div>
        </div>
      </div>

      <div className="card">
        {customers.length === 0 ? (
          <div className="empty-state"><Users className="icon" size={40} /><p>Nenhum cliente cadastrado.</p></div>
        ) : (
          <div className="table-wrap customers-table-wrap">
            <table className="table customers-table">
              <thead><tr><th>Nome</th><th>Contato</th><th>Cadastro</th><th>Compras / Cookies</th><th className="text-right">Total gasto</th><th className="text-right">Ações</th></tr></thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}>
                    <td data-label="Cliente" style={{ fontWeight: 600 }}>{c.name}</td>
                    <td data-label="Telefone" className="customer-phone"><MaskedPII value={c.contact || ''} type="phone" /></td>
                    <td data-label="Cadastro">{c.createdAt}</td>
                    <td data-label="Compras / Cookies"><span className="badge badge-brand">{countOf(c.id)} / {cookiesOf(c.id)}</span></td>
                    <td data-label="Total gasto" className="text-right" style={{ fontWeight: 700 }}><MaskedMoney value={spendOf(c.id)} /></td>
                    <td data-label="Ações" className="text-right customer-actions">
                      <button className="btn btn-secondary btn-sm" aria-label={`Editar ${c.name}`} onClick={() => openEdit(c)}><Pencil size={14} /></button>
                      <button className="btn btn-danger btn-sm" aria-label={`Excluir ${c.name}`} onClick={() => remove(c.id)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
              <div className="modal-backdrop" onClick={() => setShowModal(false)}>
                <div className="modal" role="dialog" aria-modal="true" aria-label={editing ? 'Editar cliente' : 'Novo cliente'} onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>{editing ? 'Editar Cliente' : 'Novo Cliente'}</h3>
                    <button className="modal-close" aria-label="Fechar" onClick={() => setShowModal(false)}><X size={20} /></button>
                  </div>
                  <div className="form">
                    <div className="field"><label>Nome</label><input value={form.name} maxLength={120} autoComplete="name" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do cliente" /></div>
                    <div className="field"><label>Telefone com DDD</label><input value={form.contact} maxLength={15} autoComplete="tel" inputMode="tel" onChange={e => setForm(f => ({ ...f, contact: formatPhone(e.target.value) }))} placeholder="(11) 99999-0000" /></div>
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
                title="Excluir cliente"
                message="Esta ação não pode ser desfeita. O cliente será removido permanentemente."
                itemName={deleteConfirm.name}
              />
            )}
          </>
        )
      }
