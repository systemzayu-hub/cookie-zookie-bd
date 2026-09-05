import { Plus, Minus, AlertTriangle, Boxes } from 'lucide-react'
import { Product, LOW_STOCK_THRESHOLD, CAT_LABEL } from '../types'
import { usePasswordGuard } from '../components/PasswordGate'
import { logAction } from '../audit'

export function StockView({ products, setProducts, pushToast }: {
  products: Product[]; setProducts: React.Dispatch<React.SetStateAction<Product[]>>; pushToast: (m: string, t?: 'success' | 'error') => void
}) {
  const { guard } = usePasswordGuard()
  const adjust = (id: string, delta: number) => {
    const p = products.find(x => x.id === id)
    guard(delta > 0 ? 'Repor estoque' : 'Registrar saída', () => {
      setProducts(ps => ps.map(p => p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p))
      logAction('estoque', `${delta > 0 ? 'Repôs +' : 'Registrou saída de '}${Math.abs(delta)} un de "${p?.name || id}"`)
      pushToast(delta > 0 ? 'Reposição registrada!' : 'Saída registrada.')
    })
  }
  const low = products.filter(p => p.stock <= LOW_STOCK_THRESHOLD)

  return (
    <>
      <div className="page-header">
        <h2>Controle de Estoque</h2>
        <p>Visualize, reponha e ajuste a quantidade por sabor</p>
      </div>

      {low.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--sp-6)', borderColor: 'var(--warn-500)', background: 'var(--warn-bg)' }}>
          <h3 className="card-title" style={{ color: 'var(--warn-600)' }}><AlertTriangle size={18} /> Alerta de estoque baixo</h3>
          {low.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--sp-2) 0' }}>
              <span>{p.name}</span>
              <span className={`badge ${p.stock === 0 ? 'badge-danger' : 'badge-warning'}`}>{p.stock} un restantes</span>
            </div>
          ))}
        </div>
      )}

      {products.length === 0 ? (
        <div className="card empty-state"><Boxes className="icon" size={48} /><p>Sem produtos.</p></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Sabor</th><th>Categoria</th><th>Estoque</th><th>Status</th><th className="text-right">Ações</th></tr></thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td>{p.emoji} {p.name}</td>
                    <td><span className="badge badge-neutral">{CAT_LABEL[p.category]}</span></td>
                    <td style={{ fontWeight: 700 }}>{p.stock} un</td>
                    <td>
                      {p.stock === 0 ? <span className="badge badge-danger">Esgotado</span>
                        : p.stock <= LOW_STOCK_THRESHOLD ? <span className="badge badge-warning">Baixo</span>
                        : <span className="badge badge-success">OK</span>}
                    </td>
                    <td className="text-right">
                      <button className="btn btn-secondary btn-sm" aria-label={`Retirar uma unidade de ${p.name}`} onClick={() => adjust(p.id, -1)} disabled={p.stock === 0}><Minus size={14} /></button>
                      <span style={{ padding: '0 var(--sp-2)', fontWeight: 700 }}>{p.stock}</span>
                      <button className="btn btn-secondary btn-sm" aria-label={`Repor uma unidade de ${p.name}`} onClick={() => adjust(p.id, +1)}><Plus size={14} /></button>
                      <button className="btn btn-primary btn-sm" style={{ marginLeft: 'var(--sp-2)' }} onClick={() => adjust(p.id, +10)}>+10</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
