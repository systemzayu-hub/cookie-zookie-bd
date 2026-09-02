import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, X, Users, ShoppingBag, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Customer, Sale, fmtBRL } from '../types'

export function CustomersView({ customers, setCustomers, sales, pushToast }: {
  customers: Customer[]; setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>; sales: Sale[]; pushToast: (m: string, t?: 'success' | 'error') => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState({ name: '', contact: '' })

  const openNew = () => { setEditing(null); setForm({ name: '', contact: '' }); setShowModal(true) }
  const openEdit = (c: Customer) => { setEditing(c); setForm({ name: c.name, contact: c.contact }); setShowModal(true) }

  const submit = () => {
    if (!form.name.trim()) { pushToast('Informe o nome.', 'error'); return }
    if (editing) {
      setCustomers(cs => cs.map(c => c.id === editing.id ? { ...c, name: form.name.trim(), contact: form.contact.trim() } : c))
      pushToast('Cliente atualizado!')
    } else {
      setCustomers(cs => [{ id: Math.random().toString(36).slice(2), name: form.name.trim(), contact: form.contact.trim(), createdAt: new Date().toISOString().slice(0, 10) }, ...cs])
      pushToast('Cliente adicionado!')
    }
    setShowModal(false)
  }

  const remove = (id: string) => { setCustomers(cs => cs.filter(c => c.id !== id)); pushToast('Cliente removido.') }

  const spendOf = (id: string) => sales.filter(s => s.customerId === id).reduce((a, s) => a + s.total, 0)
  const countOf = (id: string) => sales.filter(s => s.customerId === id).length

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
    ...c, spent: spendOf(c.id), purchases: countOf(c.id)
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
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--cz-600)', width: 20 }}>{i + 1}º</span>
                  <span style={{ flex: 1 }}>{c.name}</span>
                  <span className="badge badge-neutral">{c.purchases} compras</span>
                  <strong>{fmtBRL(c.spent)}</strong>
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
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Nome</th><th>Contato</th><th>Cadastro</th><th>Compras</th><th className="text-right">Total gasto</th><th className="text-right">Ações</th></tr></thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>{c.contact || '—'}</td>
                    <td>{c.createdAt}</td>
                    <td><span className="badge badge-brand">{countOf(c.id)}</span></td>
                    <td className="text-right" style={{ fontWeight: 700 }}>{fmtBRL(spendOf(c.id))}</td>
                    <td className="text-right">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}><Pencil size={14} /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(c.id)}><Trash2 size={14} /></button>
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
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Editar Cliente' : 'Novo Cliente'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div className="form">
              <div className="field"><label>Nome</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do cliente" /></div>
              <div className="field"><label>Contato (email/telefone)</label><input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} placeholder="ex: (11) 99999-0000" /></div>
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
