import { SearchInput } from '../components/SearchInput'
import { matchesSearch } from '../search'
import { useTrackedState } from '../useTrackedState'
import { useRef, useState, useMemo } from 'react'
import { Edit2, Package, TrendingUp, Calculator } from 'lucide-react'
import { CUSTOS_PRODUCAO } from '../pendencias-avancado'
import { load, save } from '../data'
import { usePasswordGuard } from '../components/PasswordGate'
import { MaskedMoney } from '../components/MaskedMoney'
import { commitLocalFinancialChanges } from '../local-financial-cloud'

export interface CustoProducao {
  id: string
  name: string
  precoVenda: number
  custoUnitario: number
  lucroUnitario: number
  margem: number
}

export function CustosView() {
  const [custos, setCustos] = useTrackedState<CustoProducao>("custos", () =>
    load('cc_custos', CUSTOS_PRODUCAO as unknown as CustoProducao[]) as CustoProducao[]
  )
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const { guard } = usePasswordGuard()

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
    if (busyRef.current) return
    const novoCusto = Number(editValue.replace(',', '.'))
    if (!editValue.trim() || !Number.isFinite(novoCusto) || novoCusto < 0) {setError('Informe um custo válido, maior ou igual a zero.'); return}
    const c = custos.find(x => x.id === id)
    if (!c) { setError('Este custo não está mais disponível. Recarregue a tela e tente novamente.'); return }
    const before = custos.map(row => ({ ...row }))
    const after = before.map(row => {
      if (row.id !== id) return row
      const precoVenda = row.precoVenda
      const lucroUnitario = precoVenda - novoCusto
      const margem = precoVenda > 0 ? lucroUnitario / precoVenda : 0
      return { ...row, custoUnitario: novoCusto, lucroUnitario, margem }
    })
    guard('Alterar custo de produção', () => {
      busyRef.current = true
      setBusy(true)
      setError('')
      void (async () => {
        try {
          await commitLocalFinancialChanges('cost', before as unknown as Record<string, unknown>[], after as unknown as Record<string, unknown>[])
          if (!save('cc_custos', after)) throw new Error('Não foi possível salvar a alteração neste aparelho.')
          setCustos(after)
          setEditingId(null)
          setEditValue('')
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : 'Não foi possível registrar a alteração.'
          setError(`${message} O custo permanece aberto para tentar novamente.`)
        } finally {
          busyRef.current = false
          setBusy(false)
        }
      })()
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
        <p className="hint" role="status">Registro financeiro deste aparelho.{busy ? ' Registrando alteração…' : ''}</p>
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

      <div className="list-toolbar card"><SearchInput label="Buscar custo de produção" placeholder="Nome do produto…" value={search} onChange={setSearch} /></div>
      {error && <p role="alert" className="login-error">{error}</p>}
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
              {custos.filter(c => matchesSearch(search, c.name)).map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td className="text-right" style={{ fontWeight: 600 }}><MaskedMoney value={c.precoVenda} /></td>
                  <td>
                    {editingId === c.id ? (
                      <div className="cost-edit"><input
                        type="number"
                        min={0}
                        step="0.01"
                        className="num-input"
                        style={{ width: '100%', minWidth: '100px' }}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        disabled={busy}
                        aria-label={`Custo unitário de ${c.name}`}
                        onKeyDown={e => {if (e.key === 'Enter') saveEdit(c.id); if (e.key === 'Escape') cancelEdit()}}
                        autoFocus
                      /><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveEdit(c.id)}>{busy ? 'Salvando…' : 'Salvar'}</button><button className="btn btn-ghost btn-sm" disabled={busy} onClick={cancelEdit}>Cancelar</button></div>
                    ) : (
                      <button className="btn btn-ghost btn-sm" disabled={busy} aria-label={`Editar custo de ${c.name}`} onClick={() => startEdit(c)}>
                        {fmtBRL(c.custoUnitario)}
                        <Edit2 size={14} style={{ marginLeft: 'var(--sp-2)', verticalAlign: 'middle', opacity: 0.5 }} />
                      </button>
                    )}
                  </td>
                  <td className="text-right" style={{ fontWeight: 700, color: 'var(--ok-600)' }}><MaskedMoney value={c.lucroUnitario} /></td>
                  <td className="text-right" style={{ fontWeight: 700, color: 'var(--cz-600)' }}>{fmtPct(c.margem)}</td>
                </tr>
              ))}
              {!custos.some(c => matchesSearch(search, c.name)) && <tr><td colSpan={5}>Nenhum produto corresponde à busca.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 'var(--sp-6)' }}>
        <h3 className="card-title"><Calculator size={18} /> Como funciona</h3>
        <ul style={{ color: 'var(--tx-2)', lineHeight: 1.8, paddingLeft: 'var(--sp-6)' }}>
          <li>Clique no custo unitário para editar e confirme em Salvar</li>
          <li>O <strong>Lucro Unitário</strong> = Preço de Venda − Custo Unitário (recalcula automaticamente)</li>
          <li>A <strong>Margem %</strong> = Lucro Unitário ÷ Preço de Venda (recalcula automaticamente)</li>
          <li>As alterações são salvas automaticamente no navegador</li>
        </ul>
      </div>
    </>
  )
}
