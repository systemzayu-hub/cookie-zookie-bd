import { Sale, salePaidAmount } from './types'
import { IngredientPurchase, cents, purchasesSummary } from './ingredients'
export function purchaseProfit(sales: Sale[], purchases: IngredientPurchase[]) {
  const revenue = sales.filter(s => s.status !== 'Presente').reduce((sum,s) => sum + cents(s.total),0) / 100
  const received = sales.reduce((sum,s) => sum + cents(salePaidAmount(s)),0) / 100
  const costs = purchasesSummary(purchases)
  return { revenue, received, receivable: (cents(revenue)-cents(received))/100, ...costs,
    net: (cents(revenue)-cents(costs.total))/100, cash: (cents(received)-cents(costs.paid))/100 }
}
