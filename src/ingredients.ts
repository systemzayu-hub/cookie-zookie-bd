export type IngredientItem = { name: string; total: number }
export type IngredientPurchase = { id: string; date: string; shop: string; items: IngredientItem[]; photo?: string; archived?: boolean }
export const purchaseTotal = (p: { items: IngredientItem[] }) => Math.round(p.items.reduce((sum, item) => sum + item.total, 0) * 100) / 100
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
export function validPurchase(p: unknown): p is IngredientPurchase {
  if (!p || typeof p !== 'object') return false
  const v = p as IngredientPurchase
  return typeof v.id === 'string' && v.id.length > 0 && v.id.length < 100 && typeof v.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.date) && Number.isFinite(new Date(v.date).getTime()) && new Date(v.date).toISOString().slice(0,10) === v.date && typeof v.shop === 'string' && v.shop.length <= 200 && Array.isArray(v.items) && v.items.length > 0 && v.items.length <= 300 && v.items.every(i => i && typeof i.name === 'string' && i.name.trim().length > 0 && i.name.length <= 500 && Number.isFinite(i.total) && i.total > 0 && i.total <= 1000000) && (v.archived === undefined || typeof v.archived === 'boolean') && (v.photo === undefined || typeof v.photo === 'string' && v.photo.length < 22000000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v.photo))
}
