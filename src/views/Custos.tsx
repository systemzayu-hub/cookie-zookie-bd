import { useState, useEffect, useMemo } from 'react'
import { Edit2, Package, TrendingUp, Calculator } from 'lucide-react'
import { CUSTOS_PRODUCAO } from '../pendencias-avancado'
import { load, save } from '../data'
import { usePasswordGuard } from '../components/PasswordGate'
import { logAction } from '../audit'
import { MaskedMoney } from '../components/MaskedMoney'

export interface CustoProducao {
  id: string
  name: string
  precoVenda: number
  custoUnitario: number
  lucroUnitario: number
  margem: number
}

export function CustosView() {
  const [custos, setCustos] = useState<CustoProducao[]>(() =>
    load('cc_custos', CUSTOS_PRODUCAO as unknown as CustoProducao[]) as CustoProducao[]
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const { guard } = usePasswordGuard()

  useEffect(() => {
    save('cc_custos', custos)
  }, [custos])

  const avgLucro = useMemo(() =>
    custos.length > 0 ? custos.reduce((sum, c) => sum + c.lucroUnitario, 0) / custos.length : 0,
    [custos]
  )
  const avgCusto = useMemo(() =>
    custos.length > 0 ? custos.reduce((sum, c) => sum + c.custoUnitario, 0) / custos.length : 0,
    [custos]
  )
  const avgMargem = useMemo(() =>
    custos.length > 0 ? custos.reduce((sum, c) => sum + c.margem, 0) / custos.length : 0,
    [custos]
  )

  const startEdit = (c: CustoProducao) => {
    setEditingId(c.id)
    setEditValue(String(c.custoUnitario))
  }

  const saveEdit = (id: string) => {
    const novoCusto = Number(editValue.replace(',', '.'))
    if (!Number.isFinite(novoCusto) || novoCusto < 0) return
    const c = custos.find(x => x.id === id)
    guard('Alterar custo de produção', () => {
      setCustos(prev => prev.map(cc => {
        if (cc.id !== id) return cc
        const precoVenda = cc.precoVenda
        const lucroUnitario = precoVenda - novoCusto
        const margem = precoVenda > 0 ? lucroUnitario / precoVenda : 0
        return { ...cc, custoUnitario: novoCusto, lucroUnitario, margem }
      }))
      setEditingId(null)
      setEditValue('')
      logAction('custo', `Alterou custo de "${c?.name || id}" para ${novoCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`)
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmtPct = (v: number) => (v * 100).toFixed(1) + '%'

  return (
    <>
      <div className="page-header">
        <h2>Custos de Produção</h2>
        <p>Configure o custo unitário por sabor e visualize lucro e margem</p>
      </div>

      <div className="grid grid-stats" style={{ marginBottom: 'var(--sp-6)' }}>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, var(--ok-bg), var(--ok-bg))' }}>
          <div className="stat-icon" style={{ background: 'var(--ok-500)' }}><TrendingUp size={22} /></div>
          <div className="stat-label">Lucro Unitário Médio</div>
          <div className="stat-value" style={{ color: 'var(--ok-600)' }}><MaskedMoney value={avgLucro} /></div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, var(--info-bg), var(--info-bg))' }}>
          <div className="stat-icon" style={{ background: 'var(--info-500)' }}><Calculator size={22} /></div>
          <div className="stat-label">Custo Médio por Cookie</div>
          <div className="stat-value" style={{ color: 'var(--info-500)' }}><MaskedMoney value={avgCusto} /></div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, var(--cz-50), var(--cz-100))' }}>
          <div className="stat-icon" style={{ background: 'var(--cz-500)' }}><Package size={22} /></div>
          <div className="stat-label">Margem Média</div>
          <div className="stat-value" style={{ color: 'var(--cz-700)' }}>{fmtPct(avgMargem)}</div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th className="text-right">Preço Venda</th>
                <th>Custo Unitário</th>
                <th className="text-right">Lucro Unitário</th>
                <th className="text-right">Margem %</th>
              </tr>
            </thead>
            <tbody>
              {custos.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td className="text-right" style={{ fontWeight: 600 }}><MaskedMoney value={c.precoVenda} /></td>
                  <td>
                    {editingId === c.id ? (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="num-input"
                        style={{ width: '100%', minWidth: '100px' }}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => saveEdit(c.id)}
                        onKeyDown={e => e.key === 'Enter' && saveEdit(c.id)}
                        autoFocus
                      />
                    ) : (
                      <span style={{ cursor: 'pointer' }} onClick={() => startEdit(c)}>
                        {fmtBRL(c.custoUnitario)}
                        <Edit2 size={14} style={{ marginLeft: 'var(--sp-2)', verticalAlign: 'middle', opacity: 0.5 }} />
                      </span>
                    )}
                  </td>
                  <td className="text-right" style={{ fontWeight: 700, color: 'var(--ok-600)' }}><MaskedMoney value={c.lucroUnitario} /></td>
                  <td className="text-right" style={{ fontWeight: 700, color: 'var(--cz-600)' }}>{fmtPct(c.margem)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 'var(--sp-6)' }}>
        <h3 className="card-title"><Calculator size={18} /> Como funciona</h3>
        <ul style={{ color: 'var(--tx-2)', lineHeight: 1.8, paddingLeft: 'var(--sp-6)' }}>
          <li>Clique no custo unitário para editar</li>
          <li>O <strong>Lucro Unitário</strong> = Preço de Venda − Custo Unitário (recalcula automaticamente)</li>
          <li>A <strong>Margem %</strong> = Lucro Unitário ÷ Preço de Venda (recalcula automaticamente)</li>
          <li>As alterações são salvas automaticamente no navegador</li>
        </ul>
      </div>
    </>
  )
}