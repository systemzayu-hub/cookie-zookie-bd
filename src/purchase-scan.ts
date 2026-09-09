import { IngredientItem, IngredientUnit, parseIngredients, parseProductScreenshot, purchaseTotal, validDate } from './ingredients'
export type PurchaseScan = { items: IngredientItem[]; ignored: string[]; warning: string; expectedTotal?: number; date?: string; shop?: string }
const amount = (value: string) => Number(value.includes(',') ? value.replace(/\./g,'').replace(',','.') : value)
const money = /(?<![\d.,])\d+(?:\.\d{3})*[,.]\d{2}(?!\d)/g
const values = (s: string) => [...s.matchAll(money)].map(m => amount(m[0]))
const clean = (s: string) => s.replace(/^[|!\s]+/,'').trim()
function packaging(name: string): Partial<IngredientItem> {
  // A truncated title does not establish the package size or unit.
  if (/\.{2,}|…/.test(name)) return {}
  const match = name.match(/(?:\b1\s*[xX]\s*)?(\d+(?:[,.]\d+)?)\s*(kg|gr|g|ml|l)\b/i)
  if (!match) return {}
  const size = Number(match[1].replace(',','.'))
  return size > 0 ? {packageSize:size,unit:(match[2].toLowerCase() === 'gr' ? 'g' : match[2].toLowerCase()) as IngredientUnit} : {}
}
export function parsePurchaseImage(text: string, kind: 'receipt' | 'product'): PurchaseScan {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean)
  if (kind === 'product' || lines.some((line,i) => /R\$/.test(line) && /^\d+(?:[,.]\d+)?\s*unidades?$/i.test(lines[i+1] || ''))) {
    const items: IngredientItem[] = [], used = new Set<number>()
    lines.forEach((line,i) => {
      const match = line.match(/^(.+?)\s+R\$\s*(\d+(?:\.\d{3})*[,.]\d{2})\s*$/i)
      const qty = lines[i+1]?.match(/^(\d+(?:[,.]\d+)?)\s*(?:unidades?|un\b|itens?)\s*$/i)
      if (!match || !qty || Number(qty[1].replace(',','.')) <= 0) return
      items.push({name:match[1].trim(),total:amount(match[2]),quantity:Number(qty[1].replace(',','.')),...packaging(match[1])}); used.add(i); used.add(i+1)
    })
    if (items.length) return {items,ignored:lines.filter((_,i) => !used.has(i)),warning:'Confira os totais das linhas e as quantidades. Nomes cortados no print precisam ser completados; o valor da linha já inclui as unidades.'}
    const result = parseProductScreenshot(text)
    return {...result,items:result.items.map(i => ({...i,quantity:1,...packaging(i.name)}))}
  }
  const blocks: string[][] = [], ignored: string[] = []
  let current: string[] | null = null, ended = false
  const tableHeader = /(?:descri[cç]|c[oó]digo|qtde|unid.*unit|vl\.?\s*unit)/i
  const end = /^(?:[uv]alor\b|qtd[e.]?\.?\s*total|forma\s+de\s+paga|cart[aã]o|fonte:|chave\s+de|consumidor|trib\b)/i
  for (const line of lines) {
    if (end.test(line) && blocks.length) {ended=true; current=null}
    if (ended || tableHeader.test(line)) {ignored.push(line); continue}
    // NFC-e normally prefixes a line with a row number + barcode, or a product code alone.
    const indexed = line.match(/^[0-9OoIlDS$]{1,3}\s+[0-9A-Za-z?]{5,16}\s+(.+)$/i)
    const coded = /^(?=[^\s]*\d[^\s]*\d)[0-9A-Za-z?]{5,16}\s+/.test(line) ? line.match(/^[0-9A-Za-z?]{5,16}\s+(.+)$/) : null
    const start = indexed?.[1] || coded?.[1]
    if (start && /[A-Za-zÀ-ÿ]{2}/.test(start)) { current=[start]; blocks.push(current) }
    else if (/^[0-9OoIlDS$]{2,3}\s/i.test(line)) { ignored.push(line); current=null }
    else if (current) current.push(line)
    else ignored.push(line)
  }
  const items: IngredientItem[] = []
  const issues: string[] = []
  for (const block of blocks) {
    const joined = block.join(' ').replace(/\([^)]*\)/g,' ')
    // Preserve the printed row total; amounts in parentheses are taxes, not purchases.
    const qtyPattern = /(\d+(?:[,.]\d+)?)\s*(?:u[nm]\w*|und\w*|lt\w*)\b(?=\s*(?:[xX×]|\d+[,.]\d{2}))\s*(?:[xX×]\s*)?/i
    const qty = joined.match(qtyPattern)
    let name = qty ? joined.slice(0,qty.index).trim() : block[0].replace(/\s+\d+[,.]\d{2}\s*$/,'').trim()
    name = name.replace(/[\s:–-]+$/,'')
    const tail = qty ? joined.slice(qty.index! + qty[0].length) : block.slice(1).join(' ')
    const prices = values(tail)
    const total = prices.length >= 2 ? prices[prices.length-1] : 0
    const quantity = qty ? Number(qty[1].replace(',','.')) : undefined
    if (!name) {ignored.push(block.join('\n'));continue}
    items.push({name,total,quantity,unitPrice:prices.length ? prices[0] : undefined,...packaging(name)})
    if (!total) issues.push(`${name}: confira o valor total.`)
    if (!quantity) issues.push(`${name}: confira a quantidade.`)
    if (prices.length >= 2 && quantity && Math.abs(Math.round(prices[0]*quantity*100)-Math.round(total*100)) > 2) issues.push(`${name}: quantidade × preço não confere com o total.`)
  }
  if (!blocks.length && !/NFC|FISCAL|CNPJ|TRIB|C[oó]DIGO/i.test(text)) {
    const simple = parseIngredients(text); items.push(...simple.items); ignored.push(...simple.ignored)
  }
  let expectedTotal: number | undefined
  for (let i=0;i<lines.length;i++) {
    if (/^(?:[uv]alor\s+total|total\s*(?:r\$|:)|cart[aã]o\s+de\s+(?:cr[eé]dito|d[eé]bito))/i.test(lines[i])) {
      const found = values(lines[i]); const next = values(lines[i+1] || '')
      const value = found[found.length-1] ?? (/^[\d\sR$,.]+$/.test(lines[i+1] || '') ? next[0] : undefined)
      if (value !== undefined) expectedTotal = value
    }
  }
  const dateMatch = text.match(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/)
  const date = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : undefined
  const shop = lines.slice(0,8).find(line => /(?:mercad|atacad|compre|comercio|com[eé]rcio)/i.test(line) && !/cnpj|\d{3}/i.test(line))
  const mismatch = expectedTotal !== undefined && Math.abs(Math.round(purchaseTotal({items})*100)-Math.round(expectedTotal*100)) > 1
  return {items,ignored:[...issues,...ignored],expectedTotal,date:validDate(date)?date:undefined,shop,warning:!items.length || issues.length || mismatch ? 'Leitura parcial: confira os campos e o total da nota antes de salvar.' : 'Confira a lista com a foto. Abreviações e quantidades podem precisar de ajuste.'}
}
export function changeItemQuantity(item: IngredientItem, quantity: number): IngredientItem {
  const previous = item.quantity || 1
  const unitPrice = item.unitPrice ?? item.total / previous
  return {...item,quantity,unitPrice,total:Math.round(unitPrice * quantity * 100)/100}
}
