import { Modal } from '../components/Modal'
import { DeleteConfirmation } from '../components/DeleteConfirmation'
import { SearchInput } from '../components/SearchInput'
import { matchesSearch } from '../search'
import { useTrackedState } from '../useTrackedState'
import { useRef, useState, useMemo } from 'react'
import { Plus, Trash2, AlertTriangle, Package, X } from 'lucide-react'
import { SEED_PERDAS, CUSTOS_PRODUCAO } from '../pendencias-avancado'
import { load, save } from '../data'
import { usePasswordGuard } from '../components/PasswordGate'
import { MaskedMoney } from '../components/MaskedMoney'
import { MaskedPII } from '../components/MaskedPII'
import { uid } from '../types'
import { commitLocalFinancialChanges } from '../local-financial-cloud'

export interface Perda {
  id: string
  date: string
  produto: string
  qtd: number
  motivo: string
  custoUnit: number
  custoTotal: number
}

export function PerdasView() {
  const [perdas, setPerdas] = useTrackedState<Perda>("perdas", () => load('cc_perdas', [] as Perda[]) as Perda[])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: '', produto: '', qtd: '', motivo: '', custoUnit: '' })
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const pendingLoss = useRef<{ signature: string; value: Perda } | null>(null)
  const { guard } = usePasswordGuard()
  const productionCosts = load<Array<{ id: string; name: string; custoUnitario: number }>>('cc_custos', [...CUSTOS_PRODUCAO])

  const totalUnidades = useMemo(() => perdas.reduce((sum, p) => sum + p.qtd, 0), [perdas])
  const totalCusto = useMemo(() => perdas.reduce((sum, p) => sum + p.custoTotal, 0), [perdas])
  const totalRegistros = perdas.length

  const submitForm = () => {
    if (busyRef.current) return
    const date = form.date
    const produto = form.produto.trim()
    const qtd = Number(form.qtd)
    const motivo = form.motivo.trim()
    const custoUnit = Number(form.custoUnit)
    if (!date || !produto || !Number.isSafeInteger(qtd) || qtd <= 0 || !motivo || !Number.isFinite(custoUnit) || custoUnit < 0 || form.custoUnit === '') { setError('Informe data, produto, quantidade inteira positiva, motivo e custo válido.'); return }
    const signature = JSON.stringify({ date, produto, qtd, motivo, custoUnit })
    const nova = pendingLoss.current?.signature === signature ? pendingLoss.current.value : {
      id: uid(), date, produto, qtd, motivo, custoUnit, custoTotal: qtd * custoUnit,
    }
    pendingLoss.current = { signature, value: nova }
    const before = perdas.map(row => ({ ...row }))
    const after = [nova, ...before]
    guard('Registrar perda', () => {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(true)
      setError('')
      void (async () => {
        try {
          await commitLocalFinancialChanges('loss', before as unknown as Record<string, unknown>[], after as unknown as Record<string, unknown>[])
          if (!save('cc_perdas', after)) throw new Error('Não foi possível salvar a alteração neste aparelho.')
          setPerdas(after)
          setForm({ date: '', produto: '', qtd: '', motivo: '', custoUnit: '' })
          setShowForm(false)
          pendingLoss.current = null
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : 'Não foi possível registrar a perda.'
          setError(`${message} O formulário permanece aberto para tentar novamente.`)
        } finally {
          busyRef.current = false
          setBusy(false)
        }
      })()
    })
  }

  // Ao escolher um produto conhecido, preenche o custo unitário automaticamente
  const pickProduto = (name: string) => {
    const c = productionCosts.find(x => x.name === name)
    setForm(f => ({
      ...f,
      produto: name,
      custoUnit: c ? String(c.custoUnitario) : f.custoUnit,
    }))
  }

  const removePerda = (id: string) => {
    const p = perdas.find(x => x.id === id)
    if (p) setDeleteConfirm({ id: p.id, name: `${p.produto} (${p.qtd} un)` })
  }

  const confirmDelete = () => {
    if (!deleteConfirm || busyRef.current) return
    const id = deleteConfirm.id
    const before = perdas.map(row => ({ ...row }))
    const after = before.filter(row => row.id !== id)
    guard('Excluir perda', () => {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(true)
      setError('')
      void (async () => {
        try {
          await commitLocalFinancialChanges('loss', before as unknown as Record<string, unknown>[], after as unknown as Record<string, unknown>[])
          if (!save('cc_perdas', after)) throw new Error('Não foi possível salvar a alteração neste aparelho.')
          setPerdas(after)
          setDeleteConfirm(null)
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : 'Não foi possível excluir a perda.'
          setError(`${message} O registro foi preservado; tente novamente.`)
        } finally {
          busyRef.current = false
          setBusy(false)
        }
      })()
    })
  }

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const visible = perdas.filter(p => matchesSearch(search, p.produto, p.motivo)).sort((a, b) => b.date.localeCompare(a.date))
  return (
    <>
      <div className="page-row">
        <div className="page-title">
          <h2>Perdas e Desperdícios</h2>
          <p>Registre perdas de produção e acompanhe o custo total</p>
          <p className="hint" role="status">Registro financeiro deste aparelho.{busy ? ' Registrando alteração…' : ''}</p>
        </div>
        <button className="btn btn-primary" disabled={busy} onClick={() => { setError(''); setShowForm(true) }}>
          <Plus size={16} /> Registrar perda
        </button>
      </div>

      <div className="grid grid-stats" style={{ marginBottom: 'var(--sp-6)' }}>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, var(--warn-bg), var(--warn-bg))' }}>
          <div className="stat-icon" style={{ background: 'var(--warn-500)' }}><AlertTriangle size={22} /></div>
          <div className="stat-label">Unidades Perdidas</div>
          <div className="stat-value" style={{ color: 'var(--warn-600)' }}>{totalUnidades}</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, var(--danger-bg), var(--danger-bg))' }}>
          <div className="stat-icon" style={{ background: 'var(--danger-500)' }}><Package size={22} /></div>
          <div className="stat-label">Custo Total</div>
          <div className="stat-value" style={{ color: 'var(--danger-600)' }}>{fmtBRL(totalCusto)}</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, var(--cz-50), var(--cz-100))' }}>
          <div className="stat-icon" style={{ background: 'var(--cz-500)' }}><Trash2 size={22} /></div>
          <div className="stat-label">Registros</div>
          <div className="stat-value" style={{ color: 'var(--cz-700)' }}>{totalRegistros}</div>
        </div>
      </div>

      <div className="list-toolbar card"><SearchInput label="Buscar perda" placeholder="Produto ou motivo…" value={search} onChange={setSearch} /><span className="result-count" role="status">{visible.length} de {perdas.length} registros · totais acima incluem todo o histórico</span></div>
      {error && !showForm && <p role="alert" className="login-error">{error}</p>}
      {visible.length === 0 ? (
        <div className="card empty-state"><Package className="icon" size={48} /><p>{perdas.length ? 'Nenhuma perda corresponde à busca.' : 'Nenhuma perda registrada.'}</p></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Produto</th>
                  <th>Qtd</th>
                  <th>Motivo</th>
                  <th className="text-right">Custo Unit</th>
                  <th className="text-right">Custo Total</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(p => (
                  <tr key={p.id}>
                    <td>{p.date.split('-').reverse().join('/')}</td>
                    <td>{p.produto}</td>
                    <td style={{ fontWeight: 700 }}>{p.qtd} un</td>
                    <td>{p.motivo}</td>
                    <td className="text-right"><MaskedMoney value={p.custoUnit} /></td>
                    <td className="text-right" style={{ fontWeight: 700, color: 'var(--danger-600)' }}><MaskedMoney value={p.custoTotal} /></td>
                    <td className="text-right">
                      <button className="btn btn-danger btn-sm" aria-label={`Excluir perda de ${p.produto}`} onClick={() => removePerda(p.id)} title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <Modal label="Registrar perda" onClose={() => setShowForm(false)}>
            <div className="modal-header">
              <h3>Registrar Perda</h3>
              <button className="modal-close" aria-label="Fechar" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <div className="form">
              {error && <p role="alert" className="login-error">{error}</p>}
              <div className="field">
                <label>Data</label>
                <input aria-label="Data" type="date" disabled={busy} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Produto</label>
                  <select aria-label="Produto"
                    className="num-input"
                    value={form.produto}
                    disabled={busy}
                    onChange={e => pickProduto(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Selecione o produto…</option>
                    {productionCosts.map(c => (
                      <option key={c.id} value={c.name}>{c.name} — {c.custoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} un</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Quantidade</label>
                  <input aria-label="Quantidade" type="number" min={1} className="num-input" disabled={busy} value={form.qtd} onChange={e => setForm(f => ({ ...f, qtd: e.target.value }))} />
                </div>
              </div>
              <div className="field">
                <label>Motivo</label>
                <input aria-label="Motivo" disabled={busy} value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} placeholder="ex: Queimou, Caiu no chão, Comi" />
              </div>
              <div className="field">
                <label>Custo Unitário (R$)</label>
                <input aria-label="Custo Unitário (R$)" type="number" min={0} step="0.01" className="num-input" disabled={busy} value={form.custoUnit} onChange={e => setForm(f => ({ ...f, custoUnit: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" disabled={busy} onClick={() => setShowForm(false)}>Cancelar</button>
                <button className="btn btn-primary" disabled={busy} onClick={submitForm}>{busy ? 'Registrando…' : 'Registrar'}</button>
              </div>
            </div>
              </Modal>
            )}

      {deleteConfirm && (
        <DeleteConfirmation
          onClose={() => setDeleteConfirm(null)}
          onConfirm={confirmDelete}
          title="Excluir perda"
          message={error || 'Esta ação não pode ser desfeita. O registro de perda será removido permanentemente.'}
          itemName={deleteConfirm.name}
        />
      )}
    </>
  )
}
