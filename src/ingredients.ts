export type IngredientUnit = 'kg' | 'g' | 'l' | 'ml' | 'un'
export type IngredientItem = { name: string; total: number; unitPrice?: number; quantity?: number; packageSize?: number; unit?: IngredientUnit }
export type IngredientPurchase = {
  id: string; date: string; shop: string; items: IngredientItem[]; photo?: string; archived?: boolean
  paymentStatus?: 'paid' | 'pending'; paidAmount?: number; creditor?: string; dueDate?: string; note?: string; paidAt?: string
}
export const cents = (value: number) => Math.round((value + Number.EPSILON) * 100)
export const purchaseTotal = (p: { items: IngredientItem[] }) => p.items.reduce((sum, item) => sum + cents(item.total), 0) / 100
export const purchasePaid = (p: IngredientPurchase) => p.paymentStatus !== 'pending' ? purchaseTotal(p) : Math.min(purchaseTotal(p), Math.max(0, cents(p.paidAmount || 0) / 100))
export const purchaseDue = (p: IngredientPurchase) => Math.max(0, cents(purchaseTotal(p)) - cents(purchasePaid(p))) / 100
export const paymentLabel = (p: IngredientPurchase) => purchaseDue(p) > 0 ? '○ A pagar' : '✓ Pago'
export const normalizeIngredient = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
export const creditorName = (p: IngredientPurchase) => p.creditor?.trim() || p.shop.trim() || 'Local/pessoa não informado'
export function purchasesSummary(purchases: IngredientPurchase[]) {
  const active = purchases.filter(p => !p.archived)
  const total = active.reduce((s, p) => s + cents(purchaseTotal(p)), 0)
  const paid = active.reduce((s, p) => s + cents(purchasePaid(p)), 0)
  return { total: total / 100, paid: paid / 100, due: (total - paid) / 100 }
}
export function groupDebts(purchases: IngredientPurchase[]) {
  const groups = new Map<string, { name: string; purchases: IngredientPurchase[]; due: number }>()
  for (const p of purchases.filter(p => !p.archived && purchaseDue(p) > 0)) {
    const name = creditorName(p), key = normalizeIngredient(name)
    const group = groups.get(key) || { name, purchases: [], due: 0 }
    group.purchases.push(p); group.due = (cents(group.due) + cents(purchaseDue(p))) / 100; groups.set(key, group)
  }
  return [...groups.values()].sort((a,b) => b.due - a.due)
}
export function normalizedPrice(item: IngredientItem): { value: number; unit: 'kg' | 'l' | 'un' } | null {
  if (!item.unit || !item.quantity || !item.packageSize) return null
  const divisor = item.quantity * item.packageSize * (item.unit === 'g' || item.unit === 'ml' ? .001 : 1)
  if (!Number.isFinite(divisor) || divisor <= 0) return null
  return { value: item.total / divisor, unit: item.unit === 'g' ? 'kg' : item.unit === 'ml' ? 'l' : item.unit }
}
export function priceStats(rows: { value: number; date: string; shop: string }[]) {
  if (!rows.length) return null
  const sorted = [...rows].sort((a,b) => a.date.localeCompare(b.date))
  const min = sorted.reduce((a,b) => b.value < a.value ? b : a)
  const max = Math.max(...sorted.map(r => r.value)), first = sorted[0], last = sorted[sorted.length - 1]
  return { last: last.value, min: min.value, max, cheapest: min.shop || 'Local não informado', change: (last.value - first.value) / first.value * 100, sorted }
}
export function replacePurchase(old: IngredientPurchase[], before: IngredientPurchase, after: IngredientPurchase) {
  if (!validPurchase(after) || before.id !== after.id) throw Error('Confira os dados da compra.')
  const current = old.find(p => p.id === before.id)
  if (!current || JSON.stringify(current) !== JSON.stringify(before)) throw Error('Esta compra mudou em outra aba. Atualize a lista antes de tentar novamente; seu rascunho foi mantido.')
  return old.map(p => p.id === before.id ? after : p)
}
export function parseIngredients(text: string) {
  const items: IngredientItem[] = [], ignored: string[] = []
  for (const raw of text.split(/\r?\n/).filter(s => s.trim())) {
    const line = raw.trim()
    if (/^(total|subtotal|valor total|troco|dinheiro|pix|cart[aã]o|cnpj|cpf|tributos|desconto|forma de pagamento)\b/i.test(line)) { ignored.push(line); continue }
    const match = line.match(/^(.+?)\s*(?:R\$\s*)?(\d+(?:\.\d{3})*,\d{2}|\d+\.\d{2})\s*$/)
    const name = match?.[1].replace(/[\s;:–-]+$/, '').trim()
    if (!match || !name || !/[a-zà-ÿ]/i.test(name)) { ignored.push(line); continue }
    const total = Number(match[2].includes(',') ? match[2].replace(/\./g, '').replace(',', '.') : match[2])
    if (total > 0 && total <= 1000000) items.push({ name, total }); else ignored.push(line)
  }
  return { items, ignored }
}
export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString().slice(0,10) === value
}
export function validPurchase(p: unknown): p is IngredientPurchase {
  if (!p || typeof p !== 'object') return false
  const v = p as IngredientPurchase
  return typeof v.id === 'string' && v.id.length > 0 && v.id.length < 100 && validDate(v.date) && typeof v.shop === 'string' && v.shop.length <= 200 && Array.isArray(v.items) && v.items.length > 0 && v.items.length <= 300 && v.items.every(i => i && typeof i.name === 'string' && i.name.trim().length > 0 && i.name.length <= 500 && Number.isFinite(i.total) && i.total > 0 && i.total <= 1000000 && (i.unitPrice === undefined || Number.isFinite(i.unitPrice) && i.unitPrice >= 0 && i.unitPrice <= 1000000) && (i.quantity === undefined || Number.isFinite(i.quantity) && i.quantity > 0 && i.quantity <= 1000000) && (i.packageSize === undefined || Number.isFinite(i.packageSize) && i.packageSize > 0 && i.packageSize <= 1000000) && (i.unit === undefined || ['kg','g','l','ml','un'].includes(i.unit))) && (v.archived === undefined || typeof v.archived === 'boolean') && (v.photo === undefined || typeof v.photo === 'string' && v.photo.length < 22000000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v.photo)) && (v.paymentStatus === undefined || ['paid','pending'].includes(v.paymentStatus)) && (v.paidAmount === undefined || Number.isFinite(v.paidAmount) && v.paidAmount >= 0 && cents(v.paidAmount) <= cents(purchaseTotal(v))) && (v.creditor === undefined || typeof v.creditor === 'string' && v.creditor.length <= 200) && (v.note === undefined || typeof v.note === 'string' && v.note.length <= 2000) && (v.dueDate === undefined || v.dueDate === '' || validDate(v.dueDate)) && (v.paidAt === undefined || validDate(v.paidAt))
}
export function readPurchasesBackup(text: string): IngredientPurchase[] {
  const data = JSON.parse(text.replace(/^\uFEFF/, ''))
  if (data.kind !== 'cookie-zookie-ingredients' || ![1,2].includes(data.version) || !Array.isArray(data.purchases) || data.purchases.length > 5000 || !data.purchases.every(validPurchase) || new Set(data.purchases.map((p: IngredientPurchase) => p.id)).size !== data.purchases.length) throw Error('Backup inválido.')
  return data.purchases
}

// Product screenshots often put the name and price on separate lines.
// Multiple prices are left for review rather than choosing a promotion or installment.
export function parseProductScreenshot(text: string) {
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  const money = /(?:R\$\s*)?(\d+(?:\.\d{3})*,\d{2}|\d+\.\d{2})/g
  const noise = /^(comprar|adicionar|carrinho|buscar|pesquisar|entrar|menu|inicio|início|frete|entrega|avaliações|avaliacoes|descrição|descricao|compartilhar|favoritar|vendido por|loja|oferta|promoção|promocao)\b/i
  const prices: { index: number; total: number; prefix: string }[] = []
  lines.forEach((line,index) => {
    if (noise.test(line) || /\b(?:\d+\s*x|parcelas?|sem juros|frete)\b/i.test(line)) return
    for (const match of line.matchAll(money)) {
      const total = Number(match[1].includes(',') ? match[1].replace(/\./g,'').replace(',','.') : match[1])
      if (total > 0 && total <= 1000000) prices.push({index,total,prefix:line.slice(0,match.index).replace(/[\s:–-]+$/,'')})
    }
  })
  const unique = [...new Set(prices.map(p => p.total))]
  if (unique.length !== 1) return { items: [] as IngredientItem[], ignored: lines, warning: unique.length ? 'O print mostra mais de um preço. Confira qual valor você realmente vai pagar e informe-o na revisão.' : 'Não identifiquei um preço completo no print. Informe o valor na revisão.' }
  const price = prices[0]
  const names = lines.slice(0,price.index).filter(line => !noise.test(line) && !/^(de|por|preço|preco|r\$|\d|no pix|à vista|a vista)\b/i.test(line) && /[a-zà-ÿ]{3}/i.test(line))
  const prefix = price.prefix.replace(/^(?:por|preço|preco)\s*:?\s*/i,'').trim()
  const name = /[a-zà-ÿ]{3}/i.test(prefix) && !/^(no pix|à vista|a vista|de)$/i.test(prefix) ? prefix : names.slice(-2).join(' ')
  if (!name) return { items: [] as IngredientItem[], ignored: lines, warning: 'O preço foi lido, mas o nome do produto não ficou claro. Preencha o nome na revisão.' }
  return { items: [{name,total:unique[0]}], ignored: lines.filter((_,i) => i !== price.index), warning: 'Confira nome e preço. Um print de anúncio não confirma uma compra; salve somente se ela foi realizada.' }
}
