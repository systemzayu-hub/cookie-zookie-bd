import { useState, useMemo, useRef } from 'react'
import { ClipboardPaste, CheckCircle2, AlertCircle, ArrowRight, Undo2, Sparkles } from 'lucide-react'
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
  const normRaw = input.trim().toLowerCase()
  // alias matching: remove pontos e espaços internos (tolerante a 'm.a', 'm. a.', 'ma')
  const normAlias = normRaw.replace(/[.\s]+/g, '')
  if (PRODUCT_ALIASES[normRaw] || PRODUCT_ALIASES[normAlias]) {
    const name = PRODUCT_ALIASES[normRaw] || PRODUCT_ALIASES[normAlias]
    return products.find(p => p.name.toLowerCase() === name.toLowerCase()) || null
  }
  // exact match
  const normExact = normRaw.replace(/\.+$/g, '').trim()
  const exact = products.find(p => p.name.toLowerCase() === normExact)
  if (exact) return exact
  // partial match (product name contains input or vice-versa)
  const partial = products.find(p => p.name.toLowerCase().includes(normExact) || normExact.includes(p.name.toLowerCase()))
  if (partial) return partial
  // starts-with
  const starts = products.find(p => p.name.toLowerCase().startsWith(normExact))
  return starts || null
}

/* ========== STATUS PARSING ========== */
function parseStatus(code: string | undefined): Sale['status'] {
  if (!code) return 'Pendente'
  const c = code.trim().toUpperCase()
  if (c === 'C') return 'Pago'
  if (c === 'D') return 'Debitado'
  if (c === '--' || c === '—' || c === '-') return 'Presente'
  return 'Pendente'
}

/* ========== TEXT PARSER ========== */
export interface ParsedLine {
  lineNum: number
  date: string | null
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

export function parseText(text: string, products: Product[], customers: Customer[]): ParsedLine[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  const currentYear = new Date().getFullYear()
  let currentDate = ''
  const result: ParsedLine[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Date header: dd/mm or dd/mm/yy or dd/mm/yyyy
    const dateMatch = line.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/)
    if (dateMatch) {
      const [, dd, mm, yy] = dateMatch
      const year = yy ? (yy.length === 2 ? '20' + yy : yy) : String(currentYear)
      currentDate = `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
      continue
    }
    // Sale line: "qty Product - Customer [- Status]"
    // Pattern: number, then anything until ' - ' or '–', then customer, optionally ' - ' and status
    const saleMatch = line.match(/^(\d+)\s+(.+?)\s*[-–]\s*(.+?)(?:\s*[-–]\s*([A-Za-z]{1,2}|--|-|—))?$/)
    if (!saleMatch) {
      result.push({ lineNum: i + 1, date: currentDate, qty: 0, productNameRaw: line, productNameMatched: null, productId: null, customerNameRaw: line, customerNameMatched: null, customerId: null, status: 'Pendente', statusLabel: '', error: 'Formato não reconhecido', unitPrice: null, total: null })
      continue
    }
    const [, qtyStr, rawProduct, rawCustomer, rawStatus] = saleMatch
    const qty = parseInt(qtyStr, 10)
    const prodMatch = matchProduct(rawProduct, products)
    const candidates = customerCandidates(rawCustomer, customers)
    const custMatch = candidates.length === 1 && normalizeCustomerName(candidates[0].name) === normalizeCustomerName(rawCustomer) ? candidates[0] : null
    const customerChoice = custMatch?.id || (candidates.length ? '' : 'new')
    const status = parseStatus(rawStatus)
    const unitPrice = prodMatch?.price ?? null
    const total = unitPrice !== null ? qty * unitPrice : null

    let error: string | null = null
    if (!prodMatch) error = `Produto "${rawProduct.trim()}" não encontrado`
    else if (!Number.isSafeInteger(qty) || qty <= 0) error = 'Quantidade inválida'
    else if (rawCustomer.trim().length > 120) error = 'Nome do cliente deve ter até 120 caracteres'

    result.push({
      lineNum: i + 1,
      date: currentDate,
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
  const { guard } = usePasswordGuard()
  const [parsed, setParsed] = useState<ParsedLine[]>([])
  const [step, setStep] = useState<'input' | 'preview' | 'done'>('input')
  const [createdCount, setCreatedCount] = useState(0)
  const confirming = useRef(false)

  const doParse = () => {
    if (!text.trim()) { pushToast('Cole o texto das vendas.', 'error'); return }
    const lines = parseText(text, products, customers)
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

  const doReset = () => { setText(''); setParsed([]); setStep('input'); setCreatedCount(0); confirming.current = false }

  const parseStats = useMemo(() => {
    const valid = new Set(parsed.filter(l => l.productId && l.customerChoice && !l.error).map(l => `${l.date || dayKey(Date.now())}|${l.customerChoice === 'new' ? 'new:' + normalizeCustomerName(l.customerNameRaw) : l.customerChoice}|${l.status}`)).size
    const warnings = parsed.filter(l => l.error || !l.customerChoice).length
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
        <div className="grid grid-2" style={{ gridTemplateColumns: '1fr 280px' }}>
          <div className="card">
            <h3 className="card-title">Cole o texto das vendas</h3>
            <p style={{ color: 'var(--tx-2)', fontSize: '0.85em', marginBottom: 'var(--sp-4)' }}>
              Cada linha de venda no formato: <code style={{ color: 'var(--cz-600)' }}>Qtd Produto - Cliente - Status</code><br />
              Status: <code>C</code> = Pago · <code>D</code> = Debitado · <code>--</code> = Presente · vazio = Pendente
            </p>
            <textarea
              className="input"
              style={{ width: '100%', minHeight: 320, fontFamily: 'monospace', fontSize: '0.95em', lineHeight: 1.6 }}
              placeholder={`30/08\n2 Kinder - Lukas - C\n3 M. A. - Lukas - C\n31/08\n1 Trad. - Sophie - C\n1 Kinder - Leticya\n1 Kinder - Lara 2°\n1 Nutella - Lara 2°`}
              value={text}
              onChange={e => setText(e.target.value)}
            />
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
                <p>Linhas como <code>30/08</code> definem a data das vendas abaixo</p>
              </div>
              <div>
                <strong style={{ color: 'var(--tx-1)' }}>2. Venda</strong>
                <p><code>2 Kinder - Lukas - C</code></p>
                <p><code>Qtd</code> <code>Produto</code> - <code>Cliente</code> - <code>Status</code></p>
              </div>
              <div>
                <strong style={{ color: 'var(--tx-1)' }}>3. Status</strong>
                <ul style={{ paddingLeft: 'var(--sp-4)', margin: 0 }}>
                  <li><code>C</code> = Pago</li>
                  <li><code>D</code> = Debitado</li>
                  <li><code>--</code> = Presente</li>
                  <li>Vazio = Pendente</li>
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
                      <td>{l.date || '—'}</td>
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
                        {l.error || (!l.customerChoice ? 'Selecione o cliente' : l.customerChoice === 'new' ? 'Novo cliente · número não informado' : '✓ OK')}
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
