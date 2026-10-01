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
  const [purchasesConfirmed, setPurchasesConfirmed] = useState(false), [paymentsConfirmed, setPaymentsConfirmed] = useState(false), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let stopPurchases = () => {}, stopPayments = () => {}, ended = false
    setPurchasesConfirmed(false); setPaymentsConfirmed(false)
    void (async () => {
      const local = await Promise.allSettled([get(`cc_ingredients:${owner.toLowerCase()}`), get(`cc_payments:${owner.toLowerCase()}`)])
      if (ended) return
      const savedPurchases = local[0].status === 'fulfilled' ? local[0].value : undefined
      const savedPayments = local[1].status === 'fulfilled' ? local[1].value : undefined
      if (Array.isArray(savedPurchases) && savedPurchases.every(validPurchase)) setPurchases(savedPurchases)
      if (Array.isArray(savedPayments) && savedPayments.every(validCashPayment)) setPayments(savedPayments)
      setReady(true)
      try { stopPurchases = watchPurchases((rows, cached) => {if (!ended) {setPurchases(rows); setPurchasesConfirmed(!cached)}}, () => {if (!ended) setPurchasesConfirmed(false)}) } catch {setPurchasesConfirmed(false)}
      try { stopPayments = watchCashPayments((rows, cached) => {if (!ended) {setPayments(rows); setPaymentsConfirmed(!cached)}}, () => {if (!ended) setPaymentsConfirmed(false)}) } catch {setPaymentsConfirmed(false)}
    })()
    return () => {ended = true; stopPurchases(); stopPayments()}
  }, [owner, attempt])
  const result = useMemo(() => { const revenue = sales.filter(s => s.status !== 'Presente' && s.status !== 'Debitado').reduce((sum, sale) => sum + sale.total, 0); const costs = purchasesSummary(purchases).total; const cash = cashPaymentsTotal(payments); const cookies = sales.filter(s => s.status === 'Debitado').reduce((sum, sale) => sum + sale.total, 0); return { revenue, costs, cash, cookies, net: revenue - costs - cash - cookies } }, [sales, purchases, payments])
  if (!ready) return <p role="status">Calculando lucro líquido…</p>
  return <div className="payments-view"><header className="page-title"><h1>Lucro líquido</h1><p>Receita menos custos, pagamentos em dinheiro e cookies debitados.</p></header>{(!purchasesConfirmed || !paymentsConfirmed) && <div className="sync-banner" role="status"><div><strong>Resultado provisório</strong><p>{!purchasesConfirmed ? 'Compras' : ''}{!purchasesConfirmed && !paymentsConfirmed ? ' e pagamentos' : !paymentsConfirmed ? 'Pagamentos' : ''} ainda sem confirmação do servidor. Os valores abaixo usam a cópia disponível.</p></div><button className="btn btn-secondary" onClick={() => setAttempt(n => n + 1)}>Atualizar fontes</button></div>}<section className="payment-card profit-card"><p className="profit-formula">Receita − Compras/custos − Pagamentos em dinheiro − Cookies debitados</p><dl className="payment-summary"><div><dt>Receita</dt><dd>{fmtBRL(result.revenue)}</dd></div><div><dt>Custos / compras</dt><dd>− {fmtBRL(result.costs)}</dd></div><div><dt>Pagamentos em dinheiro</dt><dd>− {fmtBRL(result.cash)}</dd></div><div><dt>Cookies debitados</dt><dd>− {fmtBRL(result.cookies)}</dd></div><div className="payment-total"><dt>{purchasesConfirmed && paymentsConfirmed ? 'Lucro líquido' : 'Lucro líquido provisório'}</dt><dd>{fmtBRL(result.net)}</dd></div></dl><p className="payment-empty">Inclui todas as compras ativas, pagamentos em dinheiro registrados e vendas marcadas como debitadas. Presentes não entram na receita. A receita inclui vendas pendentes; este resultado não representa o saldo disponível em caixa.</p></section></div>
}
