import { salePaidAmount, type Product, type Sale } from './types'

const businessDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
})
export const dayKey = (date: string | number | Date) => businessDate.format(new Date(date))

export function periodSales(sales: Sale[], days: number | 'all', now = Date.now()): Sale[] {
  const today = dayKey(now)
  const start = days === 'all' ? '' : dayKey(now - (days - 1) * 86400000)
  return sales.filter(sale => {
    if (!Number.isFinite(Date.parse(sale.date))) return false
    const day = dayKey(sale.date)
    return day >= start && day <= today
  }).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
}

export function salesSummary(sales: Sale[]) {
  const commercial = sales.filter(sale => sale.status !== 'Presente')
  const revenue = commercial.reduce((sum, sale) => sum + sale.total, 0)
  const received = commercial.reduce((sum, sale) => sum + salePaidAmount(sale), 0)
  const pending = sales.filter(sale => sale.status === 'Pendente').reduce((sum, sale) => sum + Math.max(0, sale.total - salePaidAmount(sale)), 0)
  return { revenue, received, pending, count: commercial.length, average: commercial.length ? revenue / commercial.length : 0,
    units: commercial.reduce((sum, sale) => sum + sale.items.reduce((n, item) => n + item.qty, 0), 0),
    gifts: sales.filter(sale => sale.status === 'Presente').reduce((sum, sale) => sum + sale.items.reduce((n, item) => n + item.qty, 0), 0),
  }
}

export function productionPlan(products: Product[], sales: Sale[], now = Date.now()) {
  const recent = periodSales(sales, 7, now)
  const units = new Map<string, number>()
  recent.forEach(sale => sale.items.forEach(item => units.set(item.productId, (units.get(item.productId) || 0) + item.qty)))
  return products.map(product => {
    const weekly = units.get(product.id) || 0
    const daily = weekly / 7
    const target = Math.ceil(daily * 3)
    return { ...product, weekly, coverage: daily ? product.stock / daily : null, suggested: Math.max(0, target - product.stock) }
  }).sort((a, b) => b.suggested - a.suggested || a.stock - b.stock)
}
