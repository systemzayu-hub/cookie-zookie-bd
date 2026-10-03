import { Modal } from '../components/Modal'
import { DeleteConfirmation } from '../components/DeleteConfirmation'
import { SearchInput } from '../components/SearchInput'
import { matchesSearch } from '../search'
import { billingWhatsApp } from '../billing-message'
import type { CustomerMerge } from '../combine-customers'
import { customerCandidates, normalizeCustomerName } from '../customer-matching'
import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, X, Users, ShoppingBag, AlertCircle, CheckCircle2, Gift } from 'lucide-react'
import { Customer, Sale, fmtBRL, saleOutstanding, uid } from '../types'
import { usePasswordGuard } from '../components/PasswordGate'
import { MaskedMoney } from '../components/MaskedMoney'
import { MaskedPII } from '../components/MaskedPII'
import { SaleTransferDialog } from '../components/SaleTransferDialog'
import { CustomerProfile } from '../components/CustomerProfile'
import { BillingMessagePreview } from '../components/BillingMessagePreview'
import type { SaleTransfer } from '../sale-adjustments'

type CustomerMergeHandler = (request: CustomerMerge) => boolean | Promise<boolean>

export function CustomersView({ customers, setCustomers, sales, pushToast, onCustomersCombined, onSaleTransfer }: {
  onSaleTransfer?: (request: SaleTransfer) => boolean
  onCustomersCombined?: CustomerMergeHandler
  customers: Customer[]
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>
  sales: Sale[]
  pushToast: (m: string, t?: 'success' | 'error') => void
}) {
  const [search, setSearch] = useState('')
  const [transferCustomer, setTransferCustomer] = useState<Customer | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [profile, setProfile] = useState<Customer | null>(null)
  const [messageCustomer, setMessageCustomer] = useState<Customer | null>(null)
  const [form, setForm] = useState({ name: '', contact: '' })
  const [mergePrompt, setMergePrompt] = useState<{ source: Customer; name: string; contact: string; candidates: Customer[] } | null>(null)
  const [mergeTarget, setMergeTarget] = useState('')
  const [mergePhone, setMergePhone] = useState('')
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
  const openEdit = (customer: Customer) => { setProfile(null); setEditing(customer); setForm({ name: customer.name, contact: customer.contact }); setShowModal(true) }
  const saveContact = (customer: Customer, rawContact: string) => {
    const contact = formatPhone(rawContact.trim())
    if (contact && !/^\(\d{2}\) \d{4,5}-\d{4}$/.test(contact)) { pushToast('Informe um telefone válido com DDD.', 'error'); return false }
    guard('Alterar telefone', () => {
      setCustomers(cs => cs.map(item => item.id === customer.id ? { ...item, contact } : item))
      pushToast('Telefone atualizado!')
    })
    return true
  }

  const submit = (renameOnly = false) => {
    const name = form.name.trim()
    const contact = form.contact.trim()
    if (!name) { pushToast('Informe o nome.', 'error'); return }
    if (contact && !/^\(\d{2}\) \d{4,5}-\d{4}$/.test(contact)) { pushToast('Informe um telefone válido com DDD.', 'error'); return }
    if (name.length > 120 || contact.length > 120) { pushToast('Nome e contato devem ter até 120 caracteres.', 'error'); return }
    if (editing && onCustomersCombined && !renameOnly && name !== editing.name) {
      const candidates = customerCandidates(name, customers.filter(customer => customer.id !== editing.id))
      if (candidates.length) {
        setMergePrompt({ source: editing, name, contact, candidates }); setMergeTarget(''); setMergePhone('')
        return
      }
    }
    if (customers.some(customer => customer.id !== editing?.id && normalizeCustomerName(customer.name) === normalizeCustomerName(name))) { pushToast('Já existe um cliente com esse nome.', 'error'); return }
    if (editing) {
      guard('Alterar cliente', () => {
        setCustomers(cs => cs.map(c => c.id === editing.id ? { ...c, name, contact } : c))
        setShowModal(false)
        setProfile(null)
        pushToast('Cliente atualizado!')
      })
    } else {
      guard('Cadastrar cliente', () => {
        setCustomers(cs => [{ id: uid(), name, contact, createdAt: new Date().toISOString() }, ...cs])
        pushToast('Cliente adicionado!')
        setShowModal(false)
      })
    }
  }

  const target = mergePrompt?.candidates.find(customer => customer.id === mergeTarget)
  const phoneConflict = !!target?.contact && !!mergePrompt?.contact && target.contact.replace(/\D/g, '') !== mergePrompt.contact.replace(/\D/g, '')
  const confirmMerge = () => {
    if (!mergePrompt || !target || !onCustomersCombined || (phoneConflict && !mergePhone)) return
    const contact = phoneConflict ? (mergePhone === 'source' ? mergePrompt.contact : target.contact) : target.contact || mergePrompt.contact
    guard('Combinar clientes', () => {
      const result = onCustomersCombined({ source: mergePrompt.source, target, contact })
      const finish = (ok: boolean) => {
        if (!ok) return
        setMergePrompt(null); setShowModal(false); setEditing(null); setProfile(null)
        pushToast('Clientes combinados! Compras e pendências reunidas no cadastro escolhido.')
      }
      if (typeof result === 'boolean') finish(result)
      else void result.then(finish).catch(error => pushToast((error as Error)?.message || 'Não foi possível combinar os clientes.', 'error'))
    })
  }

  const remove = (id: string) => {
    const customer = customers.find(item => item.id === id)
    if (sales.some(sale => sale.customerId === id)) {
      pushToast('Este cliente possui vendas no histórico e não pode ser excluído.', 'error')
      return
    }
    if (customer) setDeleteConfirm({ id: customer.id, name: customer.name })
  }

  const confirmDelete = () => {
    if (!deleteConfirm) return
    guard('Excluir cliente', () => {
      setCustomers(cs => cs.filter(c => c.id !== deleteConfirm.id))
      pushToast('Cliente removido.')
      setDeleteConfirm(null)
      setProfile(null)
    }, 'audit')
  }

  const customerSales = useMemo(() => {
    const map = new Map<string, Sale[]>()
    sales.forEach(sale => {
      if (!sale.customerId) return
      const group = map.get(sale.customerId) || []
      group.push(sale)
      map.set(sale.customerId, group)
    })
    return map
  }, [sales])
  const spendOf = (id: string) => (customerSales.get(id) || []).filter(sale => sale.status !== 'Presente').reduce((sum, sale) => sum + sale.total, 0)
  const countOf = (id: string) => (customerSales.get(id) || []).length
  const cookiesOf = (id: string) => (customerSales.get(id) || []).reduce((sum, sale) => sum + sale.items.reduce((qty, item) => qty + item.qty, 0), 0)

  const clientStatus = useMemo(() => {
    const map = new Map<string, 'Pago' | 'Pendente' | 'Debitado' | 'Presente' | 'Sem vendas'>()
    customers.forEach(customer => {
      const clientSales = customerSales.get(customer.id) || []
      if (!clientSales.length) map.set(customer.id, 'Sem vendas')
      else if (clientSales.some(sale => sale.status === 'Pendente')) map.set(customer.id, 'Pendente')
      else if (clientSales.some(sale => sale.status === 'Debitado')) map.set(customer.id, 'Debitado')
      else if (clientSales.some(sale => sale.status === 'Presente')) map.set(customer.id, 'Presente')
      else map.set(customer.id, 'Pago')
    })
    return map
  }, [customers, customerSales])

  const statusCounts = {
    Pago: customers.filter(c => clientStatus.get(c.id) === 'Pago').length,
    Pendente: customers.filter(c => clientStatus.get(c.id) === 'Pendente').length,
    Debitado: customers.filter(c => clientStatus.get(c.id) === 'Debitado').length,
    Presente: customers.filter(c => clientStatus.get(c.id) === 'Presente').length,
    'Sem vendas': customers.filter(c => clientStatus.get(c.id) === 'Sem vendas').length,
  }

  const visible = customers.filter(customer => {
    const hasPhone = /\d/.test(customer.contact || '')
    const pending = clientStatus.get(customer.id) === 'Pendente'
    const matchesFilter = statusFilter === 'with-phone' ? hasPhone
      : statusFilter === 'with-phone-pending' ? hasPhone && pending
      : statusFilter === 'without-phone-pending' ? !hasPhone && pending
      : statusFilter === 'all' || clientStatus.get(customer.id) === statusFilter
    return matchesFilter && matchesSearch(search, customer.name, customer.contact)
  }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const pages = Math.max(1, Math.ceil(visible.length / 25))
  const activePage = Math.min(page, pages - 1)
  const top = [...customers].map(c => ({ ...c, spent: spendOf(c.id), purchases: countOf(c.id), cookies: cookiesOf(c.id) })).sort((a, b) => b.spent - a.spent).slice(0, 5)
  const activeProfile = profile ? customers.find(c => c.id === profile.id) || profile : null

  return <div className="customer-billing-view">
    <div className="page-row">
      <div className="page-title"><h2>Clientes</h2><p>Busque um cadastro para abrir sua ficha e histórico.</p></div>
      <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Novo Cliente</button>
    </div>

    <section className="card cb-list-shell" aria-label="Lista de clientes">
      <div className="cb-toolbar">
        <SearchInput label="Buscar cliente por nome ou telefone" placeholder="Nome ou telefone…" value={search} onChange={value => { setSearch(value); setPage(0) }} />
        <select aria-label="Status dos clientes" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(0) }}>
          <option value="all">Todos os clientes</option>
          {['Pago', 'Pendente', 'Debitado', 'Presente', 'Sem vendas'].map(status => <option key={status}>{status}</option>)}
          <option value="with-phone">Números cadastrados</option>
          <option value="with-phone-pending">Números cadastrados pendentes</option>
          <option value="without-phone-pending">Sem número pendentes</option>
        </select>
        <span className="result-count">{visible.length} clientes</span>
      </div>
      {visible.length === 0 ? <div className="empty-state"><Users className="icon" size={40} /><p>{customers.length ? 'Nenhum cliente encontrado para esta busca ou filtro.' : 'Nenhum cliente cadastrado.'}</p></div> : <div className="table-wrap customers-table-wrap">
        <table className="table customers-table">
          <thead><tr><th>Nome</th><th>Contato</th><th>Situação</th><th>Cadastro</th><th>Compras / Cookies</th><th className="text-right">Total gasto</th><th className="text-right">Ações</th></tr></thead>
          <tbody>{visible.slice(activePage * 25, (activePage + 1) * 25).map(customer => {
            const status = clientStatus.get(customer.id) || 'Sem vendas'
            const statusClass = status === 'Pendente' ? 'badge-warning' : status === 'Debitado' ? 'badge-danger' : status === 'Presente' ? 'badge-neutral' : status === 'Pago' ? 'badge-success' : 'badge-neutral'
            return <tr key={customer.id}>
              <td data-label="Cliente" style={{ fontWeight: 600 }}><button className="cb-customer-name" title="Ver ficha" aria-label={`Ver ficha de ${customer.name}`} onClick={() => setProfile(customer)}>{customer.name}</button></td>
              <td data-label="Telefone" className="customer-phone"><MaskedPII value={customer.contact || ''} type="phone" /></td>
              <td data-label="Situação"><span className={`badge ${statusClass}`}>{status}</span></td>
              <td data-label="Cadastro">{new Date(customer.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
              <td data-label="Compras / Cookies"><span className="badge badge-brand">{countOf(customer.id)} / {cookiesOf(customer.id)}</span></td>
              <td data-label="Total gasto" className="text-right" style={{ fontWeight: 700 }}><span className="cb-desktop-value"><MaskedMoney value={spendOf(customer.id)} /></span><span className="cb-mobile-value"><small>{status === 'Pendente' ? 'Falta receber' : 'Total comprado'}</small><MaskedMoney value={status === 'Pendente' ? (customerSales.get(customer.id) || []).filter(sale => sale.status === 'Pendente').reduce((sum,sale) => sum + saleOutstanding(sale),0) : spendOf(customer.id)} /></span></td>
              <td data-label="Ações" className="text-right customer-actions">
                {statusFilter === 'with-phone-pending' && billingWhatsApp(customer, sales) && <button className="btn btn-primary btn-sm" aria-label={`Cobrar ${customer.name}`} onClick={() => setMessageCustomer(customer)}>Cobrar</button>}
                <details className="cb-client-options"><summary aria-label={`Opções de ${customer.name}`}>Opções</summary><div>
                  <button className="btn btn-ghost btn-sm" aria-label={`Editar ${customer.name}`} onClick={() => openEdit(customer)}><Pencil size={14} /> Editar</button>
                  {onSaleTransfer && countOf(customer.id) > 0 && <button className="btn btn-ghost btn-sm customer-transfer" aria-label={`Transferir venda de ${customer.name}`} onClick={() => setTransferCustomer(customer)}><ShoppingBag size={14} /> Transferir venda</button>}
                  <button className="btn btn-ghost btn-sm cb-danger-action" aria-label={`Excluir ${customer.name}`} onClick={() => remove(customer.id)}><Trash2 size={14} /> Excluir</button>
                </div></details>
              </td>
            </tr>
          })}</tbody>
        </table>
      </div>}
    </section>

    {pages > 1 && <div className="pagination"><span>{activePage + 1} / {pages}</span><button className="btn btn-secondary btn-sm" disabled={!activePage} onClick={() => setPage(activePage - 1)}>Anterior</button><button className="btn btn-secondary btn-sm" disabled={activePage === pages - 1} onClick={() => setPage(activePage + 1)}>Próxima</button></div>}

    <details className="cb-summary-disclosure">
      <summary>Resumo dos clientes</summary>
      <div className="cb-summary-content">
        <section><small>Total de clientes</small><strong>{customers.length}</strong><small>cadastros</small></section>
        <section><small>Pendências</small><strong>{statusCounts.Pendente}</strong><small>clientes com saldo em aberto</small></section>
        <section><small>Presentes</small><strong>{statusCounts.Presente}</strong><small>compras classificadas como presente</small></section>
      </div>
      {top.length > 0 && <ol className="cb-rank-list" aria-label="Ranking de clientes">
        {top.map((customer, index) => <li key={customer.id}><span>{index + 1}º</span><span className="cb-rank-name">{customer.name}</span><span><MaskedMoney value={customer.spent} /></span></li>)}
      </ol>}
      <div className="cb-summary-content">
        <section><small>Pagos</small><strong>{statusCounts.Pago}</strong></section>
        <section><small>Debitados</small><strong>{statusCounts.Debitado}</strong></section>
        <section><small>Sem compras</small><strong>{statusCounts['Sem vendas']}</strong></section>
      </div>
    </details>

    {activeProfile && <CustomerProfile customer={activeProfile} sales={sales} onClose={() => setProfile(null)} onEdit={() => openEdit(activeProfile)} onSaveContact={saveContact} />}
    {messageCustomer && <BillingMessagePreview customer={messageCustomer} sales={sales.filter(sale => sale.customerId === messageCustomer.id)} onClose={() => setMessageCustomer(null)} pushToast={pushToast} />}
    {transferCustomer && onSaleTransfer && <SaleTransferDialog customer={transferCustomer} customers={customers} sales={sales} onTransfer={onSaleTransfer} onClose={() => setTransferCustomer(null)} />}

    {mergePrompt && <Modal label="Combinar clientes" onClose={() => setMergePrompt(null)}>
      <div className="modal-header"><h3>Tem certeza de que quer combinar clientes?</h3><button className="modal-close" aria-label="Voltar à edição" onClick={() => setMergePrompt(null)}><X size={20} /></button></div>
      <div className="form">
        <p>Ao trocar “{mergePrompt.source.name}” por “{mergePrompt.name}”, encontramos outros cadastros parecidos. Se for a mesma pessoa, escolha onde reunir tudo:</p>
        <fieldset style={{ border: 0, padding: 0 }}><legend>Cliente que será mantido</legend>
          {mergePrompt.candidates.map(customer => <label key={customer.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10 }}><input type="radio" name="merge-customer" checked={mergeTarget === customer.id} onChange={() => { setMergeTarget(customer.id); setMergePhone('') }} /><span><strong>{customer.name}</strong> · <MaskedPII value={customer.contact} type="phone" /> · {countOf(customer.id)} compras · cadastro {new Date(customer.createdAt).toLocaleDateString('pt-BR')}</span></label>)}
        </fieldset>
        {target && <p>O cadastro <strong>{target.name}</strong> será mantido. As {countOf(mergePrompt.source.id)} compras de <strong>{mergePrompt.source.name}</strong>, incluindo pendências e pagamentos, serão transferidas para ele. O cadastro separado deixará de aparecer. Valores e datas permanecem iguais.</p>}
        {phoneConflict && <fieldset style={{ border: 0, padding: 0 }}><legend>Os telefones são diferentes. Qual deseja manter?</legend><label style={{ display: 'block', padding: 8 }}><input type="radio" name="merge-phone" checked={mergePhone === 'target'} onChange={() => setMergePhone('target')} /> Telefone de {target?.name}: <MaskedPII value={target?.contact || ''} type="phone" /></label><label style={{ display: 'block', padding: 8 }}><input type="radio" name="merge-phone" checked={mergePhone === 'source'} onChange={() => setMergePhone('source')} /> Telefone de {mergePrompt.source.name}: <MaskedPII value={mergePrompt.contact} type="phone" /></label></fieldset>}
        <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setMergePrompt(null)}>Voltar à edição</button>{!mergePrompt.candidates.some(customer => normalizeCustomerName(customer.name) === normalizeCustomerName(mergePrompt.name)) && <button className="btn btn-secondary" onClick={() => { setMergePrompt(null); submit(true) }}>Só renomear, sem combinar</button>}<button className="btn btn-primary" disabled={!target || (phoneConflict && !mergePhone)} onClick={confirmMerge}>Sim, combinar clientes</button></div>
      </div>
    </Modal>}

    {showModal && !mergePrompt && <Modal label={editing ? 'Editar cliente' : 'Novo cliente'} onClose={() => setShowModal(false)}>
      <div className="modal-header"><h3>{editing ? 'Editar Cliente' : 'Novo Cliente'}</h3><button className="modal-close" aria-label="Fechar" onClick={() => setShowModal(false)}><X size={20} /></button></div>
      <div className="form">
        <div className="field"><label htmlFor="customer-name">Nome</label><input id="customer-name" aria-label="Nome" value={form.name} maxLength={120} autoComplete="name" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do cliente" /></div>
        <div className="field"><label htmlFor="customer-phone">Telefone com DDD (opcional)</label><input id="customer-phone" aria-label="Telefone com DDD (opcional)" value={form.contact} maxLength={15} autoComplete="tel" inputMode="tel" onChange={e => setForm(f => ({ ...f, contact: formatPhone(e.target.value) }))} placeholder="(11) 99999-0000" /><span className="hint">Se deixar vazio, aparecerá “Não informado”.</span></div>
        <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={() => submit()}>{editing ? 'Salvar' : 'Adicionar'}</button></div>
      </div>
    </Modal>}

    {deleteConfirm && <DeleteConfirmation onClose={() => setDeleteConfirm(null)} onConfirm={confirmDelete} title="Excluir cliente" message="Esta ação não pode ser desfeita. O cliente será removido permanentemente." itemName={deleteConfirm.name} />}
  </div>
}
