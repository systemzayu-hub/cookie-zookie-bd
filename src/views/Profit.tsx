import { useEffect, useMemo, useState } from 'react'
import { get } from 'idb-keyval'
import { watchPurchases } from '../purchase-cloud'
import { watchCashPayments } from '../payment-cloud'
import { IngredientPurchase, purchasesSummary, validPurchase } from '../ingredients'
import { CashPayment, cashPaymentsTotal, validCashPayment } from '../payments'
import { Customer, Sale, fmtBRL } from '../types'
import './Payments.css'

export function ProfitView({ owner, sales }: { owner: string; sales: Sale[]; customers: Customer[] }) {
  const [purchases, setPurchases] = useState<IngredientPurchase[]>([]), [payments, setPayments] = useState<CashPayment[]>([]), [ready, setReady] = useState(false)
  useEffect(() => { let stopPurchases = () => {}, stopPayments = () => {}, ended = false; void (async () => { const [savedPurchases, savedPayments] = await Promise.all([get(`cc_ingredients:${owner.toLowerCase()}`), get(`cc_payments:${owner.toLowerCase()}`)]); if (!ended) { if (Array.isArray(savedPurchases) && savedPurchases.every(validPurchase)) setPurchases(savedPurchases); if (Array.isArray(savedPayments) && savedPayments.every(validCashPayment)) setPayments(savedPayments); setReady(true); stopPurchases = watchPurchases(rows => !ended && setPurchases(rows), () => {}); stopPayments = watchCashPayments(rows => !ended && setPayments(rows), () => {}) } })(); return () => { ended = true; stopPurchases(); stopPayments() } }, [owner])
  const result = useMemo(() => { const revenue = sales.filter(s => s.status !== 'Presente' && s.status !== 'Debitado').reduce((sum, sale) => sum + sale.total, 0); const costs = purchasesSummary(purchases).total; const cash = cashPaymentsTotal(payments); const cookies = sales.filter(s => s.status === 'Debitado').reduce((sum, sale) => sum + sale.total, 0); return { revenue, costs, cash, cookies, net: revenue - costs - cash - cookies } }, [sales, purchases, payments])
  if (!ready) return <p role="status">Calculando lucro líquido…</p>
  return <div className="payments-view"><header className="page-title"><h1>Lucro líquido</h1><p>Receita menos custos, pagamentos em dinheiro e cookies debitados.</p></header><section className="payment-card profit-card"><p className="profit-formula">Receita − Compras/custos − Pagamentos em dinheiro − Cookies debitados</p><dl className="payment-summary"><div><dt>Receita</dt><dd>{fmtBRL(result.revenue)}</dd></div><div><dt>Custos / compras</dt><dd>− {fmtBRL(result.costs)}</dd></div><div><dt>Pagamentos em dinheiro</dt><dd>− {fmtBRL(result.cash)}</dd></div><div><dt>Cookies debitados</dt><dd>− {fmtBRL(result.cookies)}</dd></div><div className="payment-total"><dt>Lucro líquido final</dt><dd>{fmtBRL(result.net)}</dd></div></dl><p className="payment-empty">Inclui todas as compras ativas, pagamentos em dinheiro registrados e vendas marcadas como debitadas. Presentes não entram na receita.</p></section></div>
}
