import { useState, useEffect, useMemo } from 'react'
import { MessageSquare, CheckCircle2, Phone, Instagram, Copy, ChevronDown, ChevronUp, DollarSign, Users, AlertCircle } from 'lucide-react'
import { Pendencia } from '../types'
import PENDENCIAS_SEED from '../pendencias-seed'
import { load, save } from '../data'
import { fmtBRL } from '../types'

export function CobrancaView() {
  const [pendencias, setPendencias] = useState<Pendencia[]>(() => load<Pendencia[]>('cc_pendencias', PENDENCIAS_SEED))
  const [sortBy, setSortBy] = useState<'total' | 'nome' | 'qtd'>('total')
  const [sortDesc, setSortDesc] = useState(true)

  useEffect(() => {
    save('cc_pendencias', pendencias)
  }, [pendencias])

  const buildMessage = (p: Pendencia) =>
    `Oi, ${p.nome}! Passando aqui pra lembrar da pendência dos cookies 🍪\n${p.qtd} unidade(s) pendente(s) (${p.produtos})\nTotal: ${fmtBRL(p.total)}\nQuando puder acertar, me avisa 😊`

  const openWhatsApp = (p: Pendencia) => {
    if (!p.telefone.trim()) return
    const msg = encodeURIComponent(buildMessage(p))
    window.open(`https://wa.me/${p.telefone}?text=${msg}`, '_blank')
  }

  const copyMessage = (p: Pendencia) => {
    navigator.clipboard.writeText(buildMessage(p))
  }

  const togglePago = (p: Pendencia) => {
    setPendencias(prev => prev.map(item =>
      item === p ? { ...item, pago: !item.pago, pagoEm: !item.pago ? new Date().toISOString() : undefined } : item
    ))
  }

  const updateField = (p: Pendencia, field: 'telefone' | 'instagram', value: string) => {
    setPendencias(prev => prev.map(item => item === p ? { ...item, [field]: value } : item))
  }

  const sortedPendencias = useMemo(() => {
    return [...pendencias].sort((a, b) => {
      let comparison = 0
      if (sortBy === 'total') comparison = a.total - b.total
      else if (sortBy === 'nome') comparison = a.nome.localeCompare(b.nome)
      else if (sortBy === 'qtd') comparison = a.qtd - b.qtd
      return sortDesc ? -comparison : comparison
    })
  }, [pendencias, sortBy, sortDesc])

  const totalReceber = pendencias.filter(p => !p.pago).reduce((acc, p) => acc + p.total, 0)
  const pessoasDevendo = pendencias.filter(p => !p.pago).length
  const totalPendentes = pendencias.filter(p => !p.pago).reduce((acc, p) => acc + p.qtd, 0)

  const sortOptions = [
    { value: 'total', label: 'Quem deve mais' },
    { value: 'nome', label: 'Nome A-Z' },
    { value: 'qtd', label: 'Quantidade' },
  ] as const

  return (
    <>
      <div className="page-row">
        <div className="page-title">
          <h2>Cobrança</h2>
          <p>Gerencie pendências de clientes e envie lembretes via WhatsApp</p>
        </div>
      </div>

      <div className="grid grid-stats" style={{ marginBottom: 'var(--sp-6)' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, var(--cz-500), var(--cz-600))' }}>
              <DollarSign size={22} />
            </div>
            <div>
              <div className="stat-label">Total a receber</div>
              <div className="stat-value" style={{ color: 'var(--cz-600)' }}>{fmtBRL(totalReceber)}</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, var(--warn-500), var(--warn-600))' }}>
              <Users size={22} />
            </div>
            <div>
              <div className="stat-label">Pessoas devendo</div>
              <div className="stat-value">{pessoasDevendo}</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, var(--info-500), #2563eb)' }}>
              <AlertCircle size={22} />
            </div>
            <div>
              <div className="stat-label">Falta cobrar (unid.)</div>
              <div className="stat-value">{totalPendentes}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--sp-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: 'var(--tx-2)' }}>Ordenar por:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            style={{
              padding: 'var(--sp-2) var(--sp-3)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              background: 'var(--card)',
              color: 'var(--tx-1)',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            {sortOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSortDesc(d => !d)}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}
          >
            {sortDesc ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            <span>{sortDesc ? 'Maior primeiro' : 'Menor primeiro'}</span>
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 'var(--sp-5)' }}>
        {sortedPendencias.map(p => (
          <div key={p.nome} className="card" style={{ background: p.pago ? 'var(--ok-bg)' : 'var(--card)', borderColor: p.pago ? 'var(--ok-500)' : 'var(--border)', opacity: p.pago ? 0.7 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: p.pago ? 'var(--ok-600)' : 'var(--tx-1)' }}>
                  {p.nome}
                  {p.pago && <span className="badge badge-success" style={{ marginLeft: 'var(--sp-2)', fontSize: '0.7rem' }}>Pago</span>}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--tx-3)', marginTop: '2px' }}>{p.produtos}</p>
              </div>
              <button
                className={`btn btn-sm ${p.pago ? 'btn-ghost' : 'btn-primary'}`}
                onClick={() => togglePago(p)}
                style={{
                  width: 36, height: 36, borderRadius: '50%', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: p.pago ? 'transparent' : 'linear-gradient(135deg, var(--ok-500), var(--ok-600))',
                  color: p.pago ? 'var(--ok-600)' : '#fff',
                  border: p.pago ? '2px solid var(--ok-500)' : 'none',
                }}
                aria-label={p.pago ? 'Marcar como pendente' : 'Marcar como pago'}
              >
                <CheckCircle2 size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase' }}>Qtd:</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--cz-600)' }}>{p.qtd} un.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase' }}>Total:</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--cz-600)' }}>{fmtBRL(p.total)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
              <div className="field" style={{ margin: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  <Phone size={14} color="var(--tx-3)" />
                  <span>Telefone (WhatsApp)</span>
                </label>
                <input
                  type="tel"
                  value={p.telefone}
                  onChange={e => updateField(p, 'telefone', e.target.value)}
                  placeholder="(DDD) 9xxxx-xxxx"
                  style={{ width: '100%' }}
                  disabled={p.pago}
                />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  <Instagram size={14} color="var(--tx-3)" />
                  <span>Instagram</span>
                </label>
                <input
                  type="text"
                  value={p.instagram}
                  onChange={e => updateField(p, 'instagram', e.target.value)}
                  placeholder="@usuario"
                  style={{ width: '100%' }}
                  disabled={p.pago}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={() => openWhatsApp(p)}
                disabled={!p.telefone.trim() || p.pago}
                style={{ flex: 1, minWidth: 120 }}
              >
                <MessageSquare size={16} /> WhatsApp
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => copyMessage(p)}
                disabled={p.pago}
                style={{ flex: 1, minWidth: 120 }}
              >
                <Copy size={16} /> Copiar cobrança
              </button>
            </div>

            {p.pago && p.pagoEm && (
              <p style={{ marginTop: 'var(--sp-3)', fontSize: '0.75rem', color: 'var(--ok-600)', textAlign: 'center' }}>
                Marcado como pago em {new Date(p.pagoEm).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        ))}

        {sortedPendencias.length === 0 && (
          <div className="card empty-state" style={{ gridColumn: '1 / -1' }}>
            <CheckCircle2 className="icon" size={48} color="var(--ok-500)" />
            <p>Todas as pendências foram quitadas! 🎉</p>
          </div>
        )}
      </div>
    </>
  )
}