import { useState, useMemo, useRef } from 'react'
import { ClipboardPaste, CheckCircle2, AlertCircle, Undo2, Sparkles } from 'lucide-react'
import { Product, Customer, Sale, uid, fmtBRL } from '../types'
import { usePasswordGuard } from '../components/PasswordGate'
import { dayKey } from '../analytics'
import { customerCandidates, normalizeCustomerName } from '../customer-matching'
import { MaskedPII } from '../components/MaskedPII'
import { logAction } from '../audit'

/* ========== PRODUCT NAME ALIASES ========== */
const PRODUCT_ALIASES: Record<string, string> = {
  'nutella': 'Nutella',
  'kinder': 'Kinder',
  'trad': 'Tradicional',
  'tradicional': 'Tradicional',
  'm. a': 'Meio Amargo',
  'm.a': 'Meio Amargo',
  'm.a.': 'Meio Amargo',
  'm. a.': 'Meio Amargo',
  'ma': 'Meio Amargo',
  'meio amargo': 'Meio Amargo',
  'meio-amargo': 'Meio Amargo',
  'meioamargo': 'Meio Amargo',
  'm a': 'Meio Amargo',
  'amargo': 'Meio Amargo',
}

function matchProduct(input: string, products: Product[]): Product | null {
  const norm = normalizeCustomerName(input).replace(/ /g, '')
  if (!norm) return null
  const alias = PRODUCT_ALIASES[input.trim().toLowerCase()] || PRODUCT_ALIASES[norm]
  const wanted = normalizeCustomerName(alias || input).replace(/ /g, '')
  const exact = products.filter(product => normalizeCustomerName(product.name).replace(/ /g, '') === wanted)
  if (exact.length === 1) return exact[0]
  const partial = products.filter(product => normalizeCustomerName(product.name).replace(/ /g, '').includes(wanted))
  return partial.length === 1 ? partial[0] : null
}

const STATUS_CODES: Record<string, Sale['status']> = {
  c: 'Pago', pago: 'Pago', paga: 'Pago',
  d: 'Debitado', debitado: 'Debitado', debitada: 'Debitado',
  p: 'Pendente', pendente: 'Pendente',
  '--': 'Presente', '-': 'Presente', '—': 'Presente', presente: 'Presente', brinde: 'Presente',
}

export function validImportDate(date: string): boolean {
  const timestamp = Date.parse(date + 'T12:00:00-03:00')
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(timestamp) && dayKey(timestamp) === date
}

function saleParts(line: string, products: Product[]): { qty: number; product: string; customer: string; status?: string } | null {
  // Spreadsheet columns: quantity, product, customer, optional status.
  const columns = line.split('\t').map(value => value.trim())
  if (columns.length >= 3 && columns.length <= 4 && /^\d+$/.test(columns[0])) {
    if (columns[3] && !STATUS_CODES[normalizeCustomerName(columns[3])] && !STATUS_CODES[columns[3]]) return null
    return { qty: Number(columns[0]), product: columns[1], customer: columns[2], status: columns[3] }
  }
  const quantity = line.match(/^(\d+)\s*(?:[x×]\s*)?(.+)$/i)
  const qty = quantity ? Number(quantity[1]) : 1
  const content = quantity ? quantity[2] : line
  let product = '', customer = ''
  const spaced = content.match(/^(.+?)\s+[-–—]\s+(.+)$/)
  if (spaced) { product = spaced[1].trim(); customer = spaced[2].trim() }
  else {
    // Prefer the longest recognized product so Meio-Amargo keeps its hyphen.
    for (let index = content.length - 2; index > 0; index--) {
      if (/[-–—]/.test(content[index]) && matchProduct(content.slice(0, index), products)) {
        product = content.slice(0, index).trim(); customer = content.slice(index + 1).trim(); break
      }
    }
  }
  if (!product || !customer) return null
  const statusMatch = customer.match(/\s*[-–—]\s*(C|D|P|pago|paga|pendente|debitado|debitada|presente|brinde|--|—|-)\s*$/i)
  if (statusMatch && customer.slice(0, statusMatch.index).trim()) {
    return { qty, product, customer: customer.slice(0, statusMatch.index).trim(), status: statusMatch[1] }
  }
  return { qty, product, customer }

}

/* ========== TEXT PARSER ========== */
export interface ParsedLine {
  lineNum: number
  date: string | null
  dateAutomatic?: boolean
  qty: number
  productNameRaw: string
  productNameMatched: string | null
  productId: string | null
  customerNameRaw: string
  customerNameMatched: string | null
  customerId: string | null
  customerChoice?: string
  status: Sale['status']
  statusLabel: string
  error: string | null
  unitPrice: number | null
  total: number | null
}

const STATUS_LABEL: Record<string, string> = {
  Pago: 'Pago (C)', Pendente: 'Pendente', Debitado: 'Debitado (D)', Presente: 'Presente (--)',
}

export function parseText(text: string, products: Product[], customers: Customer[], options: { date?: string; status?: Sale['status'] } = {}): ParsedLine[] {
  const lines = text.split('\n').map(l => l.trim())
  const defaultDate = options.date || dayKey(Date.now())
  const currentYear = defaultDate.slice(0, 4)
  let currentDate = defaultDate
  let dateAutomatic = true
  const result: ParsedLine[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const relative = normalizeCustomerName(line)
    if (relative === 'hoje' || relative === 'ontem') {
      currentDate = dayKey(Date.now() - (relative === 'ontem' ? 86_400_000 : 0))
      dateAutomatic = false
      continue
    }
    // Date header: dd/mm or dd/mm/yy or dd/mm/yyyy
    const dateMatch = line.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2}|\d{4}))?:?$/)
    if (dateMatch) {
      const [, dd, mm, yy] = dateMatch
      const year = yy ? (yy.length === 2 ? '20' + yy : yy) : String(currentYear)
      currentDate = `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
      dateAutomatic = false
      continue
    }
    const parts = saleParts(line, products)
    if (!parts || !parts.customer || !parts.product) {
      result.push({ lineNum: i + 1, date: currentDate, dateAutomatic, qty: 0, productNameRaw: line, productNameMatched: null, productId: null, customerNameRaw: line, customerNameMatched: null, customerId: null, status: 'Pendente', statusLabel: '', error: 'Formato não reconhecido. Use: 2 Kinder - Nome - C', unitPrice: null, total: null })
      continue
    }
    const { qty, product: rawProduct, customer: rawCustomer, status: rawStatus } = parts
    const prodMatch = matchProduct(rawProduct, products)
    const candidates = customerCandidates(rawCustomer, customers)
    const custMatch = candidates.length === 1 && normalizeCustomerName(candidates[0].name) === normalizeCustomerName(rawCustomer) ? candidates[0] : null
    const customerChoice = custMatch?.id || (candidates.length ? '' : 'new')
    const status = rawStatus ? STATUS_CODES[rawStatus.toLowerCase()] || options.status || 'Pendente' : options.status || 'Pendente'
    const unitPrice = prodMatch?.price ?? null
    const total = unitPrice !== null ? qty * unitPrice : null

    let error: string | null = null
    if (!prodMatch) error = `Produto "${rawProduct.trim()}" não encontrado`
    else if (!Number.isSafeInteger(qty) || qty <= 0) error = 'Quantidade inválida'
    else if (rawCustomer.trim().length > 120) error = 'Nome do cliente deve ter até 120 caracteres'

    result.push({
      lineNum: i + 1,
      date: currentDate,
      dateAutomatic,
      qty,
      productNameRaw: rawProduct.trim(),
      productNameMatched: prodMatch?.name ?? null,
      productId: prodMatch?.id ?? null,
      customerNameRaw: rawCustomer.trim(),
      customerNameMatched: custMatch?.name ?? null,
      customerId: custMatch?.id ?? null,
      customerChoice,
      status,
      statusLabel: STATUS_LABEL[status as string] ?? 'Pendente',
      error,
      unitPrice,
      total,
    })
  }
  return result
}

/* ========== QUICK SALE VIEW ========== */
export function QuickSaleView({ products, customers, onSalesImported, pushToast }: {
  products: Product[]; customers: Customer[]
  onSalesImported: (sales: Sale[], customers: Customer[]) => boolean; pushToast: (m: string, t?: 'success' | 'error') => void
}) {
  const [text, setText] = useState('')
  const [defaultDate, setDefaultDate] = useState('')
  const [defaultStatus, setDefaultStatus] = useState<Sale['status']>('Pendente')
  const draft = useMemo(() => parseText(text, products, customers, { date: defaultDate, status: defaultStatus }), [text, products, customers, defaultDate, defaultStatus])
  const { guard } = usePasswordGuard()
  const [parsed, setParsed] = useState<ParsedLine[]>([])
  const [step, setStep] = useState<'input' | 'preview' | 'done'>('input')
  const [createdCount, setCreatedCount] = useState(0)
  const confirming = useRef(false)

  const doParse = () => {
    if (!text.trim()) { pushToast('Cole o texto das vendas.', 'error'); return }
    const lines = parseText(text, products, customers, { date: defaultDate, status: defaultStatus })
    if (lines.length === 0) { pushToast('Nenhuma linha encontrada.', 'error'); return }
    confirming.current = false
    setParsed(lines)
    setStep('preview')
  }

  const doConfirm = () => guard('Confirmar vendas importadas', () => {
    if (step !== 'preview' || confirming.current) return
    if (parsed.some(line => line.error || !line.customerChoice || !line.productId || !Number.isSafeInteger(line.qty) || line.qty <= 0)) {
      pushToast('Corrija todas as linhas antes de importar.', 'error'); return
    }
    const quantities = new Map<string, number>()
    for (const line of parsed) {
      quantities.set(line.productId!, (quantities.get(line.productId!) || 0) + line.qty)
      const date = line.date || dayKey(Date.now())
      const timestamp = Date.parse(date + 'T12:00:00-03:00')
      if (!Number.isFinite(timestamp) || dayKey(timestamp) !== date) { pushToast('Confira as datas das vendas.', 'error'); return }
    }
    for (const [id, quantity] of quantities) {
      const product = products.find(item => item.id === id)
      if (!product || quantity > product.stock) { pushToast(`Estoque insuficiente para ${product?.name || 'produto'}. Confira o total do lote.`, 'error'); return }
    }
    const newCustomers = new Map<string, Customer>()
    const resolved = parsed.map(line => {
      if (line.customerChoice !== 'new') return { ...line, customerId: line.customerChoice! }
      const nameKey = normalizeCustomerName(line.customerNameRaw)
      if (!newCustomers.has(nameKey)) newCustomers.set(nameKey, { id: uid(), name: line.customerNameRaw, contact: '', createdAt: new Date().toISOString() })
      return { ...line, customerId: newCustomers.get(nameKey)!.id }
    })
    const saleDateMap = new Map<string, ParsedLine[]>()
    resolved.forEach(line => {
      const key = `${line.date || dayKey(Date.now())}|${line.customerId}|${line.status}`
      saleDateMap.set(key, [...(saleDateMap.get(key) || []), line])
    })

    const sales: Sale[] = []
    saleDateMap.forEach((lines, key) => {
      const [date, customerId, status] = key.split('|')
      const items = lines.map(l => ({
        productId: l.productId!,
        name: l.productNameMatched!,
        qty: l.qty,
        unitPrice: l.unitPrice!,
      }))
      const total = items.reduce((a, i) => a + i.qty * i.unitPrice, 0)
      const sale: Sale = {
        id: uid(),
        date: date ? new Date(date + 'T12:00:00-03:00').toISOString() : new Date().toISOString(),
        items,
        payment: 'pix',
        channel: 'loja',
        total,
        customerId: customerId || undefined,
        status: status as Sale['status'],
        paidAmount: status === 'Pago' ? total : 0,
      }
      sales.push(sale)
    })

    confirming.current = true
    if (!onSalesImported(sales, [...newCustomers.values()])) { confirming.current = false; return }
    const count = sales.length
    logAction('venda-rapida', `Importou ${count} venda(s) via cola de texto (${parsed.length} linhas)`)
    setCreatedCount(count)
    setStep('done')
    pushToast(`${count} venda(s) criada(s) com sucesso! 🎉`)
  })

  const doReset = () => { setText(''); setParsed([]); setStep('input'); setCreatedCount(0); setDefaultDate(''); setDefaultStatus('Pendente'); confirming.current = false }

  const parseStats = useMemo(() => {
    const valid = new Set(parsed.filter(l => l.productId && l.customerChoice && !l.error && validImportDate(l.date || '')).map(l => `${l.date || dayKey(Date.now())}|${l.customerChoice === 'new' ? 'new:' + normalizeCustomerName(l.customerNameRaw) : l.customerChoice}|${l.status}`)).size
    const warnings = parsed.filter(l => l.error || !l.customerChoice || !validImportDate(l.date || '')).length
    const total = parsed.filter(l => l.total).reduce((a, l) => a + (l.total || 0), 0)
    return { valid, warnings, total, count: parsed.length }
  }, [parsed])

  const chooseCustomer = (name: string, choice: string) => {
    setParsed(lines => lines.map(line => normalizeCustomerName(line.customerNameRaw) === normalizeCustomerName(name)
      ? { ...line, customerChoice: choice, customerId: choice === 'new' ? null : choice, customerNameMatched: customers.find(customer => customer.id === choice)?.name || null }
      : line))
  }

  return (
    <>
      <div className="page-row">
        <div className="page-row-inner">
          <div className="page-title"><h2>Venda Rápida</h2><p>Cole texto da planilha e gere vendas automaticamente</p></div>
        </div>
        {step !== 'input' && (
          <button className="btn btn-secondary" onClick={doReset}><Undo2 size={16} /> Nova importação</button>
        )}
      </div>

      {/* ===== STEP 1: INPUT ===== */}
      {step === 'input' && (
        <div className="paste-layout">
          <div className="card">
            <h3 className="card-title">Cole o texto das vendas</h3>
            <p style={{ color: 'var(--tx-2)', fontSize: '0.85em', marginBottom: 'var(--sp-4)' }}>
              Cada linha de venda no formato: <code style={{ color: 'var(--cz-600)' }}>Qtd Produto - Cliente - Status</code><br />
              Status: <code>C</code> = Pago · <code>D</code> = Debitado · <code>--</code> = Presente · vazio = status escolhido abaixo
            </p>
            <div className="form-grid" style={{ marginBottom: 'var(--sp-4)' }}>
              <div className="field">
                <label htmlFor="import-default-date">Data das vendas sem data no texto</label>
                <input id="import-default-date" type="date" value={defaultDate} onChange={event => setDefaultDate(event.target.value)} />
                <span className="hint">{defaultDate ? 'A data escolhida vale para as linhas sem data.' : `Automático: hoje, ${dayKey(Date.now()).split('-').reverse().join('/')}. Não precisa preencher.`}</span>
              </div>
              <div className="field">
                <label htmlFor="import-default-status">Quando o status não estiver no texto</label>
                <select id="import-default-status" value={defaultStatus} onChange={event => setDefaultStatus(event.target.value as Sale['status'])}>
                  {Object.keys(STATUS_LABEL).map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>
            <textarea
              aria-label="Texto das vendas"
              className="paste-textarea"
              style={{ width: '100%', minHeight: 320, fontFamily: 'monospace', fontSize: '0.95em', lineHeight: 1.6 }}
              placeholder={`2 Kinder - Lukas - C\n3 M. A. - Lukas - Pago\nTrad. - Sophie\n1 Kinder - Lara 2°\n\nNão precisa colocar a data: usamos hoje automaticamente.`}
              value={text}
              onChange={e => setText(e.target.value)}
            />
            {text.trim() && <p className="hint" role="status" style={{ marginTop: 'var(--sp-3)' }}>{draft.length} linha(s) de venda · {draft.filter(line => line.error).length} aviso(s) de formato · total estimado {fmtBRL(draft.reduce((sum, line) => sum + (line.total || 0), 0))}</p>}
            <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
              <button className="btn btn-cz" onClick={doParse} disabled={!text.trim()}>
                <Sparkles size={16} /> Processar texto
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Como funciona</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', fontSize: '0.85em', color: 'var(--tx-2)' }}>
              <div>
                <strong style={{ color: 'var(--tx-1)' }}>1. Data</strong>
                <p>Sem data? Usamos hoje automaticamente. Você pode escolher outra no campo ao lado.</p><p>No texto, <code>30/08</code>, <code>hoje</code> ou <code>ontem</code> definem a data das próximas linhas.</p>
              </div>
              <div>
                <strong style={{ color: 'var(--tx-1)' }}>2. Venda</strong>
                <p><code>2 Kinder - Lukas - C</code></p>
                <p>Também aceita <code>2x Kinder - Lukas</code> e <code>Kinder - Lukas</code> (1 unidade). Pode colar colunas de uma planilha: quantidade, produto, cliente e status.</p>
              </div>
              <div>
                <strong style={{ color: 'var(--tx-1)' }}>3. Status</strong>
                <ul style={{ paddingLeft: 'var(--sp-4)', margin: 0 }}>
                  <li><code>C</code> = Pago</li>
                  <li><code>D</code> = Debitado</li>
                  <li><code>--</code> = Presente</li>
                  <li>Vazio = status escolhido (começa em Pendente)</li><li>Também aceita Pago, Pendente, Debitado e Presente por extenso</li>
                </ul>
              </div>
              <div>
                <strong style={{ color: 'var(--tx-1)' }}>4. Abreviações</strong>
                <p><code>Trad.</code> → Tradicional<br/><code>M. A.</code> → Meio Amargo</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== STEP 2: PREVIEW ===== */}
      {step === 'preview' && (
        <>
          <div className="grid grid-3" style={{ marginBottom: 'var(--sp-6)' }}>
            <div className="card">
              <h3 className="card-title">Linhas detectadas</h3>
              <span className="stat-value">{parseStats.count}</span>
              <span className="stat-label">linhas totais</span>
            </div>
            <div className="card">
              <h3 className="card-title">Vendas válidas</h3>
              <span className="stat-value" style={{ color: parseStats.warnings > 0 ? 'var(--ok-500)' : undefined }}>{parseStats.valid}</span>
              <span className="stat-label">vendas prontas</span>
            </div>
            <div className="card">
              <h3 className="card-title">Total estimado</h3>
              <span className="stat-value">{fmtBRL(parseStats.total)}</span>
              <span className="stat-label">valor das vendas</span>
            </div>
          </div>

          {parseStats.warnings > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-4)', background: 'rgba(251,191,36,0.1)', border: '1px solid var(--warn-600)', borderRadius: 'var(--r-lg)', marginBottom: 'var(--sp-6)' }}>
              <AlertCircle size={20} style={{ color: 'var(--warn-500)' }} />
              <span>{parseStats.warnings} linha(s) precisam de revisão. Escolha os clientes e corrija os avisos antes de confirmar.</span>
            </div>
          )}

          <p style={{ marginBottom: 'var(--sp-4)' }}>Nomes novos serão cadastrados ao confirmar. Para nomes parecidos, escolha o cliente ou “Criar novo cliente”. A escolha vale para todas as linhas com o mesmo nome.</p>
          <div className="card" style={{ marginBottom: 'var(--sp-6)' }}>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>#</th><th>Data</th><th>Qtd</th><th>Produto</th><th>Cliente</th><th>Status</th><th>Subtotal</th><th>Observação</th></tr></thead>
                <tbody>
                  {parsed.map((l, i) => (
                    <tr key={i} style={{ opacity: l.error && !l.productId ? 0.5 : 1 }}>
                      <td>{l.lineNum}</td>
                      <td style={{ minWidth: 160 }}><input aria-label={`Data da linha ${l.lineNum}`} type="date" value={l.date || ''} onChange={event => setParsed(lines => lines.map((line, index) => index === i ? { ...line, date: event.target.value, dateAutomatic: false } : line))} /><span className="hint">{l.dateAutomatic ? 'Data automática' : 'Data informada'}</span></td>
                      <td style={{ fontWeight: 700, textAlign: 'center' }}>{l.qty}</td>
                      <td>
                        {l.productNameMatched ? (
                          <span style={{ color: 'var(--ok-500)' }}>{l.productNameMatched}</span>
                        ) : (
                          <span style={{ color: 'var(--danger-500)' }}>{l.productNameRaw}</span>
                        )}
                      </td>
                      <td style={{ minWidth: 230 }}>
                        <div style={{ fontWeight: 600, marginBottom: 'var(--sp-2)' }}>{l.customerNameRaw}</div>
                        {l.productId && <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                          <legend className="hint">Selecionar cliente</legend>
                          {customerCandidates(l.customerNameRaw, customers).map(customer => <label key={customer.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                            <input className="customer-choice" type="radio" name={`customer-${i}`} checked={l.customerChoice === customer.id} onChange={() => chooseCustomer(l.customerNameRaw, customer.id)} style={{ width: 16, height: 16, flexShrink: 0 }} />
                            <span>{customer.name} · <MaskedPII value={customer.contact} type="phone" /> · cadastro {new Date(customer.createdAt).toLocaleDateString('pt-BR')} · cód. {customer.id.slice(-6)}</span>
                          </label>)}
                          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                            <input className="customer-choice" type="radio" name={`customer-${i}`} checked={l.customerChoice === 'new'} onChange={() => chooseCustomer(l.customerNameRaw, 'new')} style={{ width: 16, height: 16, flexShrink: 0 }} />
                            <span>Criar novo cliente: {l.customerNameRaw}</span>
                          </label>
                          <select className="input" aria-label={`Outro cliente para linha ${l.lineNum}`} value={l.customerChoice !== 'new' ? l.customerChoice || '' : ''} onChange={event => chooseCustomer(l.customerNameRaw, event.target.value)}>
                            <option value="">Selecionar outro cliente...</option>
                            {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name} · cód. {customer.id.slice(-6)}</option>)}
                          </select>
                        </fieldset>}
                      </td>
                      <td><span className={`badge badge-${l.status === 'Pago' ? 'success' : l.status === 'Pendente' ? 'warning' : l.status === 'Debitado' ? 'danger' : 'neutral'}`}>{l.statusLabel}</span></td>
                      <td style={{ fontWeight: 700 }}>{l.total !== null ? fmtBRL(l.total) : '—'}</td>
                      <td style={{ fontSize: '0.8em', color: l.error ? 'var(--warn-500)' : 'var(--tx-2)' }}>
                        {l.error || (!validImportDate(l.date || '') ? 'Confira a data desta linha' : '') || (!l.customerChoice ? 'Selecione o cliente' : l.customerChoice === 'new' ? 'Novo cliente · número não informado' : '✓ OK')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <button className="btn btn-cz" onClick={doConfirm} disabled={parseStats.valid === 0 || parseStats.warnings > 0}>
              <CheckCircle2 size={16} /> Confirmar e criar {parseStats.valid} venda(s)
            </button>
            <button className="btn btn-secondary" onClick={() => setStep('input')}>
              <Undo2 size={16} /> Voltar e editar
            </button>
          </div>
        </>
      )}

      {/* ===== STEP 3: DONE ===== */}
      {step === 'done' && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-8)' }}>
          <div style={{ fontSize: 48, marginBottom: 'var(--sp-4)' }}>🎉</div>
          <h2 style={{ marginBottom: 'var(--sp-3)' }}>{createdCount} venda(s) criada(s)!</h2>
          <p style={{ color: 'var(--tx-2)', marginBottom: 'var(--sp-6)' }}>
            As vendas já aparecem no Dashboard, Relatórios e nas contas dos clientes.
          </p>
          <button className="btn btn-cz" onClick={doReset}>
            <ClipboardPaste size={16} /> Importar mais vendas
          </button>
        </div>
      )}
    </>
  )
}
