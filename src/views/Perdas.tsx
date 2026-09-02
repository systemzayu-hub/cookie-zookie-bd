import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, AlertTriangle, Package, Lock } from 'lucide-react'
import { SEED_PERDAS } from '../pendencias-avancado'
import { load, save } from '../data'
import { usePasswordGuard } from '../components/PasswordGate'

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
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      date,
      produto,
      qtd,
      motivo,
      custoUnit,
      custoTotal: qtd * custoUnit,
    }
    setPerdas(prev => [nova, ...prev])
    setForm({ date: '', produto: '', qtd: '', motivo: '', custoUnit: '' })
    setShowForm(false)
  }

  const removePerda = (id: string) => guard('Excluir perda', () => {
    setPerdas(prev => prev.filter(p => p.id !== id))
  })

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

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
                    <td className="text-right">{fmtBRL(p.custoUnit)}</td>
                    <td className="text-right" style={{ fontWeight: 700, color: 'var(--danger-600)' }}>{fmtBRL(p.custoTotal)}</td>
                    <td className="text-right">
                      <button className="btn btn-danger btn-sm" onClick={() => removePerda(p.id)} title="Excluir">
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
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Registrar Perda</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}><Trash2 size={20} /></button>
            </div>
            <div className="form">
              <div className="field">
                <label>Data</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Produto</label>
                  <input value={form.produto} onChange={e => setForm(f => ({ ...f, produto: e.target.value }))} placeholder="ex: Nutella, Tradicional" />
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
    </>
  )
}