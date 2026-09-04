import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, AlertTriangle, Package, X } from 'lucide-react'
import { SEED_PERDAS, CUSTOS_PRODUCAO } from '../pendencias-avancado'
import { load, save } from '../data'
import { usePasswordGuard } from '../components/PasswordGate'
import { logAction } from '../audit'
import { MaskedMoney } from '../components/MaskedMoney'
import { MaskedPII } from '../components/MaskedPII'
import { uid } from '../types'

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
  const [perdas, setPerdas] = useState<Perda[]>(() => load('cc_perdas', SEED_PERDAS as unknown as Perda[]) as Perda[])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: '', produto: '', qtd: '', motivo: '', custoUnit: '' })
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const { guard } = usePasswordGuard()

  useEffect(() => {
    save('cc_perdas', perdas)
  }, [perdas])

  const totalUnidades = useMemo(() => perdas.reduce((sum, p) => sum + p.qtd, 0), [perdas])
  const totalCusto = useMemo(() => perdas.reduce((sum, p) => sum + p.custoTotal, 0), [perdas])
  const totalRegistros = perdas.length

  const submitForm = () => {
    const date = form.date
    const produto = form.produto.trim()
    const qtd = Number(form.qtd)
    const motivo = form.motivo.trim()
    const custoUnit = Number(form.custoUnit)
    if (!date || !produto || isNaN(qtd) || qtd <= 0 || !motivo || isNaN(custoUnit) || custoUnit < 0) return
    const nova: Perda = {
      id: uid(),
      date,
      produto,
      qtd,
      motivo,
      custoUnit,
      custoTotal: qtd * custoUnit,
    }
    guard('Registrar perda', () => {
      setPerdas(prev => [nova, ...prev])
      setForm({ date: '', produto: '', qtd: '', motivo: '', custoUnit: '' })
      setShowForm(false)
      logAction('perda', `Registrou perda de ${qtd} un de "${produto}" (${fmtBRL_audit(Number(qtd) * Number(custoUnit))}) — ${motivo}`)
    })
  }

  // Ao escolher um produto conhecido, preenche o custo unitário automaticamente
  const pickProduto = (name: string) => {
    const c = CUSTOS_PRODUCAO.find(x => x.name === name)
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
    if (!deleteConfirm) return
    guard('Excluir perda', () => {
      setPerdas(prev => prev.filter(p => p.id !== deleteConfirm.id))
      logAction('perda', `Excluiu perda${perdas.find(x => x.id === deleteConfirm.id) ? ` de ${perdas.find(x => x.id === deleteConfirm.id)?.qtd} un de "${perdas.find(x => x.id === deleteConfirm.id)?.produto}"` : ''}`)
      setDeleteConfirm(null)
    })
  }

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmtBRL_audit = fmtBRL

  return (
    <>
      <div className="page-row">
        <div className="page-title">
          <h2>Perdas e Desperdícios</h2>
          <p>Registre perdas de produção e acompanhe o custo total</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
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

      {perdas.length === 0 ? (
        <div className="card empty-state"><Package className="icon" size={48} /><p>Nenhuma perda registrada.</p></div>
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
                {perdas.map(p => (
                  <tr key={p.id}>
                    <td>{p.date}</td>
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
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Registrar perda" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Registrar Perda</h3>
              <button className="modal-close" aria-label="Fechar" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <div className="form">
              <div className="field">
                <label>Data</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Produto</label>
                  <select
                    className="num-input"
                    value={form.produto}
                    onChange={e => pickProduto(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Selecione o produto…</option>
                    {CUSTOS_PRODUCAO.map(c => (
                      <option key={c.id} value={c.name}>{c.name} — {c.custoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} un</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Quantidade</label>
                  <input type="number" min={1} className="num-input" value={form.qtd} onChange={e => setForm(f => ({ ...f, qtd: e.target.value }))} />
                </div>
              </div>
              <div className="field">
                <label>Motivo</label>
                <input value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} placeholder="ex: Queimou, Caiu no chão, Comi" />
              </div>
              <div className="field">
                <label>Custo Unitário (R$)</label>
                <input type="number" min={0} step="0.01" className="num-input" value={form.custoUnit} onChange={e => setForm(f => ({ ...f, custoUnit: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={submitForm}>Registrar</button>
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
          title="Excluir perda"
          message="Esta ação não pode ser desfeita. O registro de perda será removido permanentemente."
          itemName={deleteConfirm.name}
        />
      )}
    </>
  )
}
