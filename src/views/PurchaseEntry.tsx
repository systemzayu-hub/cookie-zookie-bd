import { IngredientPurchase, creditorName, paymentLabel, purchaseDue, purchasePaid, purchaseTotal } from '../ingredients'
import { fmtBRL } from '../types'
export function PurchaseEntry({ purchase: p, busy, today, edit, pay, archive }: { purchase: IngredientPurchase; busy: boolean; today: string; edit: () => void; pay: () => void; archive: () => void }) {
  const due = purchaseDue(p), overdue = due > 0 && p.dueDate && p.dueDate < today
  return <details className="purchase-entry"><summary><span className="purchase-entry-main"><strong>{p.shop || 'Local não informado'}</strong><small>{p.date.split('-').reverse().join('/')} · {p.items.length} produto(s){p.archived ? ' · Arquivada' : overdue ? ' · Vencida' : ''}</small></span><span className={`purchase-status ${due > 0 ? 'pending' : ''}`}>{paymentLabel(p)}</span><strong>{fmtBRL(due > 0 ? due : purchaseTotal(p))}</strong></summary>
    <div className="purchase-entry-body"><p className="purchase-muted">Total da compra: {fmtBRL(purchaseTotal(p))} · Pago: {fmtBRL(purchasePaid(p))}</p><ul className="purchase-lines">{p.items.map((i,n) => <li key={n}><span>{i.name}{i.quantity && i.packageSize && i.unit ? <small> · {i.quantity} × {i.packageSize} {i.unit}</small> : ''}</span><strong>{fmtBRL(i.total)}</strong></li>)}</ul>
      {due > 0 ? <p className="purchase-debt-line"><strong>{fmtBRL(due)} a pagar</strong> para {creditorName(p)}{p.dueDate && <span> · {overdue ? 'Vencido em' : 'Vence em'} {p.dueDate.split('-').reverse().join('/')}</span>}{purchasePaid(p) > 0 && <small> · {fmtBRL(purchasePaid(p))} já pagos</small>}</p> : <p className="purchase-muted">✓ Pago{p.paidAt ? ` em ${p.paidAt.split('-').reverse().join('/')}` : ''}</p>}
      {p.note && <p className="purchase-observation">{p.note}</p>}
      {p.photo && <details><summary>Ver foto da nota</summary><img className="receipt-photo" src={p.photo} alt="Nota da compra" /></details>}
      <div className="purchase-actions">{due > 0 && !p.archived && <button className="btn btn-primary" disabled={busy} onClick={pay}>Marcar como paga · {fmtBRL(due)}</button>}<button className="btn btn-secondary" disabled={busy} onClick={edit}>Editar compra</button><button className="btn btn-ghost" disabled={busy} onClick={archive}>{p.archived ? 'Restaurar compra' : 'Arquivar'}</button></div>
    </div>
  </details>
}
