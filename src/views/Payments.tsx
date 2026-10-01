import { useEffect, useMemo, useRef, useState } from 'react'
import { get, set } from 'idb-keyval'
import { CashPayment, cashPaymentsTotal, validCashPayment } from '../payments'
import { commitCashPayments, watchCashPayments } from '../payment-cloud'
import { Customer, Sale, fmtBRL, uid } from '../types'
import { dayKey } from '../analytics'
import { SearchInput } from '../components/SearchInput'
import { useConfirmation } from '../components/useConfirmation'
import { matchesSearch } from '../search'
import { type DebitChange } from '../debit-change'
import { saleEditOperationId } from '../edit-sale'
import './Payments.css'

const today = () => dayKey(Date.now())
const blank = (): CashPayment => ({ id: uid(), amount: 0, description: '', person: '', date: today() })
type Row = { id: string; amount: number; description: string; person: string; date: string; quantity?: number }

export function PaymentsView({ owner, sales, customers, pushToast, onDebitChanged }: { owner: string; sales: Sale[]; customers: Customer[]; pushToast: (text: string, type?: 'success' | 'error') => void; onDebitChanged: (request: DebitChange) => Promise<void> }) {
  const key = `cc_payments:${owner.toLowerCase()}`
  const [payments, setPayments] = useState<CashPayment[]>([])
  const [ready, setReady] = useState(false), [cloudReady, setCloudReady] = useState(false), [attempt, setAttempt] = useState(0)
  const [form, setForm] = useState(blank), [editing, setEditing] = useState<string | null>(null), [busy, setBusy] = useState(false)
  const [search, setSearch] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState('')
  const lock = useRef(false)
  const { confirm, confirmation } = useConfirmation()
  useEffect(() => {
    let stopped = false, stop = () => {}
    setCloudReady(false)
    void (async () => {
      let local: CashPayment[] = []
      try {
        const saved = await get(key)
        if (Array.isArray(saved) && saved.every(validCashPayment)) local = saved
      } catch { /* The server can still provide records if local storage is unavailable. */ }
      if (stopped) return
      setPayments(local); setReady(true)
      try {
        stop = watchCashPayments((rows, cached) => {
          if (stopped) return
          setPayments(rows); setCloudReady(!cached)
          if (!cached) void set(key, rows).catch(() => { if (!stopped) pushToast('Dados confirmados no servidor, mas a cópia local não pôde ser salva.', 'error') })
        }, () => { if (!stopped) {setCloudReady(false); pushToast('Não foi possível sincronizar os pagamentos. A cópia disponível foi preservada.', 'error')} })
      } catch { if (!stopped) {setCloudReady(false); pushToast('Conecte ao servidor para atualizar pagamentos.', 'error')} }
    })()
    return () => {stopped = true; stop()}
  }, [key, attempt])

  const cookieDebits = useMemo(() => sales.filter(s => s.status === 'Debitado').map(s => ({ id: s.id, quantity: s.items.reduce((n, i) => n + i.qty, 0), amount: s.total, description: s.items.map(i => `${i.qty}x ${i.name}`).join(' + '), person: customers.find(c => c.id === s.customerId)?.name || 'Pessoa não informada', date: dayKey(s.date) })).sort((a, b) => b.date.localeCompare(a.date)), [sales, customers])
  const matches = (row: Row) => matchesSearch(search, row.person, row.description) && (!from || row.date >= from) && (!to || row.date <= to)
  const cashRows = payments.filter(p => !p.archived && p.kind !== 'cookie').filter(matches).sort((a,b) => b.date.localeCompare(a.date))
  const debits = cookieDebits.filter(matches)
  const history = payments.filter(p => !p.archived && p.kind === 'cookie').filter(matches).sort((a,b) => b.date.localeCompare(a.date))
  const archived = payments.filter(p => p.archived && p.kind !== 'cookie').filter(matches).sort((a,b) => b.date.localeCompare(a.date))
  const debitsByPerson = [...debits.reduce((map, item) => {
    const prior = map.get(item.person) || {person: item.person, quantity: 0, amount: 0}
    prior.quantity += item.quantity; prior.amount += item.amount; map.set(item.person, prior); return map
  }, new Map<string, {person: string; quantity: number; amount: number}>()).values()].sort((a,b) => b.amount - a.amount)

  const run = async (action: () => Promise<void>) => {
    if (lock.current || !cloudReady) return
    lock.current = true; setBusy(true)
    try { await action() } catch (error) {pushToast(error instanceof Error ? error.message : 'Não foi possível salvar. Atualize os dados e tente novamente.', 'error')}
    finally {lock.current = false; setBusy(false)}
  }
  const savePayment = async (event: React.FormEvent) => {
    event.preventDefault()
    const next = {...form, description: form.description.trim(), person: form.person.trim(), amount: Number(form.amount)}
    if (!validCashPayment(next) || !next.person) return pushToast('Informe valor, motivo, pessoa e data válidos.', 'error')
    await run(async () => {
      if (editing && !payments.some(p => p.id === editing && !p.archived)) throw Error('Este pagamento foi removido em outro aparelho. Atualize antes de editar.')
      const after = editing ? payments.map(p => p.id === editing ? next : p) : [...payments, next]
      await commitCashPayments(payments, after)
      setEditing(null); setForm(blank()); pushToast(editing ? 'Pagamento atualizado.' : 'Pagamento registrado.')
    })
  }
  const remove = async (p: CashPayment) => {
    if (!await confirm(`Excluir o pagamento de ${fmtBRL(p.amount)} para ${p.person}? Ele sairá dos totais e ficará preservado no histórico.`, 'Excluir pagamento')) return
    await run(async () => {
      await commitCashPayments(payments, payments.map(item => item.id === p.id ? {...item, archived: true} : item))
      if (editing === p.id) {setEditing(null); setForm(blank())}
      pushToast('Pagamento excluído e preservado no histórico.')
    })
  }
  const settleDebit = async (row: typeof cookieDebits[number]) => {
    if (!await confirm(`Marcar ${row.quantity} cookies de ${row.person} (${fmtBRL(row.amount)}) como pagos? Confira o recebimento antes de confirmar.`, 'Confirmar recebimento')) return
    await run(async () => {
      if (payments.some(p => !p.archived && p.kind === 'cookie' && p.sourceSaleId === row.id)) throw Error('Este débito já tem um pagamento registrado. Atualize o histórico.')
      const record: CashPayment = {id: uid(), amount: row.amount, description: row.description, person: row.person, date: today(), kind: 'cookie', sourceSaleId: row.id, quantity: row.quantity, status: 'paid'}
      const sale = sales.find(item => item.id === row.id)
      if (!sale) throw Error('Esta venda foi removida. Atualize o histórico.')
      await onDebitChanged({sale, payment: record, reopen: false, operationId: saleEditOperationId()})
      pushToast('Débito marcado como pago e preservado no histórico.')
    })
  }
  const reopenDebit = async (record: CashPayment) => {
    if (!record.sourceSaleId || !await confirm(`Reabrir o débito de ${record.person} (${fmtBRL(record.amount)})? A venda voltará para Debitado.`, 'Reabrir débito')) return
    await run(async () => {
      if (!sales.some(s => s.id === record.sourceSaleId && s.status === 'Pago')) throw Error('A venda foi removida ou mudou de situação. Confira o histórico de vendas.')
      const sale = sales.find(item => item.id === record.sourceSaleId)!
      await onDebitChanged({sale, payment: record, reopen: true, operationId: saleEditOperationId()}); pushToast('Débito reaberto.')
    })
  }
  const cashTotal = cashPaymentsTotal(payments), cookieTotal = cookieDebits.reduce((sum, item) => sum + item.amount, 0)
  const disabled = busy || !cloudReady
  if (!ready) return <p role="status">Abrindo pagamentos…</p>
  return <div className="payments-view">
    {confirmation}
    <header className="page-title"><h1>Pagamentos</h1><p>Saídas em dinheiro e cookies debitados, mantidos no histórico.</p></header>
    {!cloudReady && <div className="sync-banner" role="status"><div><strong>Pagamentos sem confirmação do servidor</strong><p>A cópia disponível pode estar desatualizada. Conecte para alterar registros.</p></div><button className="btn btn-secondary" onClick={() => setAttempt(n => n + 1)}>Conectar novamente</button></div>}
    <dl className="payment-summary"><div><dt>Em dinheiro</dt><dd>{fmtBRL(cashTotal)}</dd></div><div><dt>Cookies debitados</dt><dd>{fmtBRL(cookieTotal)}</dd></div><div className="payment-total"><dt>Total pago/debitado</dt><dd>{fmtBRL(cashTotal + cookieTotal)}</dd></div></dl>
    <section className="payment-card"><h2>{editing ? 'Editar pagamento em dinheiro' : 'Registrar pagamento em dinheiro'}</h2>
      <form className="payment-form" onSubmit={savePayment}>
        <label>Valor (R$)<input type="number" inputMode="decimal" min="0.01" step="0.01" value={form.amount || ''} onChange={e => setForm({...form, amount: Number(e.target.value)})} required /></label>
        <label>Motivo / descrição<input maxLength={500} value={form.description} onChange={e => setForm({...form, description: e.target.value})} required /></label>
        <label>Pessoa<input maxLength={200} value={form.person} onChange={e => setForm({...form, person: e.target.value})} required /></label>
        <label>Data<input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required /></label>
        <div className="payment-actions"><button className="btn btn-primary" disabled={disabled}>{busy ? 'Salvando…' : editing ? 'Salvar alterações' : 'Adicionar pagamento'}</button>{editing && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => {setEditing(null); setForm(blank())}}>Cancelar</button>}</div>
      </form>
    </section>
    <div className="list-toolbar card"><SearchInput label="Buscar nos pagamentos" value={search} onChange={setSearch} placeholder="Pessoa, produto ou descrição…" /><label>De<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>Até<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label><button className="btn btn-ghost" onClick={() => {setSearch(''); setFrom(''); setTo('')}}>Limpar filtros</button><span className="result-count" role="status">{cashRows.length + debits.length + history.length + archived.length} registros encontrados · os totais acima incluem todo o histórico ativo</span></div>
    {from && to && from > to && <p role="alert">A data inicial deve ser anterior à final.</p>}
    <DebitSummary rows={debitsByPerson} />
    <PaymentList title="Pagamentos em dinheiro" empty="Nenhum pagamento em dinheiro corresponde aos filtros." rows={cashRows} cash busy={disabled} onEdit={p => {setForm(p); setEditing(p.id)}} onDelete={p => void remove(p)} />
    <PaymentList title="Cookies debitados" empty="Nenhum cookie debitado corresponde aos filtros." rows={debits} busy={disabled} onMarkPaid={id => {const row = cookieDebits.find(item => item.id === id); if (row) void settleDebit(row)}} />
    <DebitHistory rows={history} busy={disabled} onReopen={p => void reopenDebit(p)} />
    <details className="payment-card"><summary>Histórico de pagamentos excluídos · {archived.length}</summary><PaymentList title="Pagamentos excluídos" empty="Nenhum pagamento excluído corresponde aos filtros." rows={archived} cash busy={disabled} /></details>
  </div>
}

function DebitSummary({ rows }: { rows: Array<{person: string; quantity: number; amount: number}> }) {
  return <section className="payment-card"><div className="payment-section-title"><h2>Débitos por pessoa</h2><span className="payment-kind cookies">Resumo filtrado</span></div>{rows.length ? <div className="payment-table-wrap"><table className="payment-table payment-table-simple"><thead><tr><th>Pessoa</th><th>Cookies</th><th>Valor debitado</th></tr></thead><tbody>{rows.map(row => <tr key={row.person}><td data-label="Pessoa">{row.person}</td><td data-label="Cookies">{row.quantity}</td><td data-label="Valor debitado">{fmtBRL(row.amount)}</td></tr>)}</tbody></table></div> : <p className="payment-empty">Nenhum débito encontrado.</p>}</section>
}
function DebitHistory({ rows, busy, onReopen }: {rows: CashPayment[]; busy: boolean; onReopen: (row: CashPayment) => void}) {
  return <section className="payment-card"><div className="payment-section-title"><h2>Histórico de débitos</h2><span className="payment-kind cookies">Cookies</span></div>{rows.length ? <div className="payment-table-wrap"><table className="payment-table"><thead><tr><th>Pessoa</th><th>Cookies</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td data-label="Pessoa">{row.person}</td><td data-label="Cookies">{row.quantity}</td><td data-label="Valor">{fmtBRL(row.amount)}</td><td data-label="Status"><span className="payment-kind cash">Pago</span></td><td data-label="Ação"><button className="btn btn-ghost" disabled={busy} onClick={() => onReopen(row)}>Voltar para debitado</button></td></tr>)}</tbody></table></div> : <p className="payment-empty">Nenhum débito pago corresponde aos filtros.</p>}</section>
}
export function PaymentList({ title, empty, rows, cash, busy = false, onEdit, onDelete, onMarkPaid }: {title: string; empty: string; rows: Row[]; cash?: boolean; busy?: boolean; onEdit?: (p: CashPayment) => void; onDelete?: (p: CashPayment) => void; onMarkPaid?: (id: string) => void}) {
  const actions = !!(onEdit || onDelete || onMarkPaid)
  return <section className="payment-card"><div className="payment-section-title"><h2>{title}</h2><span className={`payment-kind ${cash ? 'cash' : 'cookies'}`}>{cash ? 'Dinheiro' : 'Cookies'}</span></div>{!cash && <p className="payment-source">Gerados pelas vendas marcadas como debitadas. Confirme o recebimento antes de marcar como pago.</p>}{rows.length ? <div className="payment-table-wrap"><table className="payment-table"><thead><tr>{!cash && <th>Qtd.</th>}<th>Valor</th><th>Motivo / descrição</th><th>Pessoa</th><th>Data</th>{actions && <th>Ações</th>}</tr></thead><tbody>{rows.map(row => <tr key={row.id}>{!cash && <td data-label="Quantidade">{row.quantity}</td>}<td data-label="Valor">{fmtBRL(row.amount)}</td><td data-label="Motivo">{row.description}</td><td data-label="Pessoa">{row.person}</td><td data-label="Data">{row.date.split('-').reverse().join('/')}</td>{actions && <td data-label="Ações">{onEdit && <button className="btn btn-ghost" disabled={busy} onClick={() => onEdit(row as CashPayment)}>Editar</button>}{onDelete && <button className="btn btn-ghost" disabled={busy} onClick={() => onDelete(row as CashPayment)}>Excluir</button>}{onMarkPaid && <button className="btn btn-secondary" disabled={busy} onClick={() => onMarkPaid(row.id)}>Marcar como pago</button>}</td>}</tr>)}</tbody></table></div> : <p className="payment-empty">{empty}</p>}</section>
}
