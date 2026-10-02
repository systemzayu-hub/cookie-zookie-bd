import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'
import { act, create } from 'react-test-renderer'
import { setRole } from '../src/auth'
import { AuditView } from '../src/views/Audit'
import { auditBackend, auditUI } from './audit-view-mock'

const row = (id: string, ts = Date.now(), detail = 'Alteração registrada') => ({ id, ts, actor: 'João', email: 'joao@example.test', action: 'alteracao', detail, hasUndo: false })
const content = (root: any) => JSON.stringify(root.toJSON())
const visibleText = (node: any): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  return Array.isArray(node?.children) ? node.children.map(visibleText).join('') : ''
}
const resetAuditMocks = () => {
  auditUI.load = async () => []
  auditUI.page = async () => ({ entries: await auditUI.load(), cursor: { v2: null, legacy: null, v2Done: true, legacyDone: true }, hasMore: false })
  auditUI.details = async () => ({ changes: [] })
  auditUI.receive = () => {}
  auditUI.fail = () => {}
  auditBackend.previewUndo = async () => []
  auditBackend.undoAction = async () => {}
}
beforeEach(resetAuditMocks)

test('auditoria mostra carregamento e preserva evento mais novo recebido antes da carga inicial', async () => {
  let finish!: (rows: ReturnType<typeof row>[]) => void
  auditUI.load = () => new Promise(resolve => { finish = resolve })
  setRole('owner')
  let root: any
  try {
    await act(async () => { root = create(<AuditView/>) })
    assert.match(content(root), /Carregando histórico/)
    assert.doesNotMatch(content(root), /Nenhuma ação encontrada/)
    await act(async () => { auditUI.receive([row('novo', Date.now(), 'Alteração nova')]); finish([row('antigo', Date.now() - 1000, 'Alteração antiga')]) })
    assert.match(content(root), /Alteração nova/)
    assert.match(content(root), /Alteração antiga/)
    assert.match(content(root), /Histórico de alterações/)
    assert.match(content(root), /joao@example.test/)
  } finally { act(() => root?.unmount()); setRole(null) }
})

test('falha de detalhes permite nova tentativa e não é apresentada como história ausente', async () => {
  auditUI.load = async () => [row('teste')]
  let calls = 0
  auditUI.details = async () => {
    calls++
    if (calls === 1) throw Error('unavailable')
    return { changes: [{ entity: 'Produto: Nutella', field: 'stock', before: 2, after: 5 }] }
  }
  setRole('owner')
  let root: any
  try {
    await act(async () => { root = create(<AuditView/>) })
    const toggle = root.root.findAllByType('button').find((button: any) => button.props.className === 'audit-event-summary')
    await act(async () => { toggle.props.onClick() })
    assert.match(content(root), /Não foi possível consultar as mudanças/)
    assert.doesNotMatch(content(root), /não contém dados suficientes/)
    const retry = root.root.findAllByType('button').find((button: any) => button.props.children === 'Tentar novamente')
    await act(async () => { retry.props.onClick() })
    assert.equal(calls, 2)
    assert.match(content(root), /Produto: Nutella/)
    assert.match(content(root), /Antes/)
    assert.match(content(root), /Depois/)
  } finally { act(() => root?.unmount()); setRole(null) }
})

test('paginação falha com nova tentativa e mescla registros repetidos sem duplicar', async () => {
  let pageCalls = 0
  auditUI.page = async () => {
    pageCalls++
    if (pageCalls === 1) return { entries: [row('primeiro', Date.now(), 'Primeiro')], cursor: { v2: null, legacy: null, v2Done: false, legacyDone: true }, hasMore: true }
    if (pageCalls === 2) throw Error('offline')
    return { entries: [row('primeiro', Date.now(), 'Primeiro'), row('seguinte', Date.now() - 1000, 'Seguinte')], cursor: { v2: null, legacy: null, v2Done: true, legacyDone: true }, hasMore: false }
  }
  setRole('owner')
  let root: any
  try {
    await act(async () => { root = create(<AuditView/>) })
    const button = (label: string) => root.root.findAllByType('button').find((item: any) => item.children.join('') === label)
    await act(async () => { button('Buscar registros mais antigos').props.onClick() })
    assert.match(content(root), /Não foi possível carregar mais registros/)
    await act(async () => { button('Tentar carregar novamente').props.onClick() })
    assert.match(content(root), /Seguinte/)
    assert.equal(root.root.findAll((node: any) => node.type === 'article' && node.props.className.startsWith('audit-event')).length, 2)
    assert.doesNotMatch(content(root), /Buscar registros mais antigos/)
    assert.equal(pageCalls, 3)
  } finally { act(() => root?.unmount()); setRole(null) }
})

test('resposta de página antiga não altera a lista após recarregar', async () => {
  let pageCalls = 0
  let finishOldPage!: (page: any) => void
  auditUI.page = async () => {
    pageCalls++
    if (pageCalls === 1) return { entries: [row('inicial', Date.now(), 'Inicial')], cursor: { v2: null, legacy: null, v2Done: false, legacyDone: true }, hasMore: true }
    if (pageCalls === 2) return new Promise(resolve => { finishOldPage = resolve })
    return { entries: [row('atualizado', Date.now(), 'Atualizado')], cursor: { v2: null, legacy: null, v2Done: true, legacyDone: true }, hasMore: false }
  }
  setRole('owner')
  let root: any
  try {
    await act(async () => { root = create(<AuditView/>) })
    const button = (label: string) => root.root.findAllByType('button').find((item: any) => item.children.join('') === label)
    await act(async () => { button('Buscar registros mais antigos').props.onClick() })
    await act(async () => { auditUI.fail() })
    await act(async () => { button('Recarregar histórico').props.onClick() })
    assert.match(content(root), /Atualizado/)
    await act(async () => { finishOldPage({ entries: [row('obsoleto', Date.now() - 1000, 'Obsoleto')], cursor: {}, hasMore: false }) })
    assert.doesNotMatch(content(root), /Obsoleto/)
    assert.match(content(root), /Atualizado/)
    assert.equal(pageCalls, 3)
  } finally { act(() => root?.unmount()); setRole(null) }
})

test('agrupa por dia e apresenta o evento sem expor o UUID no resumo', async () => {
  const now = Date.now()
  const saleId = '550e8400-e29b-41d4-a716-446655440000'
  const productId = '6ba7b810-9dad-41d1-80b4-00c04fd430c8'
  auditUI.page = async () => ({ entries: await auditUI.load(), cursor: { v2: null, legacy: null, v2Done: true, legacyDone: true }, hasMore: false })
  auditUI.load = async () => [
    { ...row(saleId, now, `Venda ${saleId}: Venda de Ana: 2x Nutella; total R$ 17,00.`), action: 'venda' },
    { ...row(productId, now - 86400000, 'Produto Nutella: preço de R$ 8,50 para R$ 9,00.'), action: 'produto' },
  ]
  setRole('owner')
  let root: any
  try {
    await act(async () => { root = create(<AuditView/>) })
    const text = content(root)
    const summaryText = root.root.findAll((node: any) => node.props?.className === 'audit-event-summary-copy').map(visibleText).join('\n')
    assert.match(text, /Hoje/)
    assert.match(text, /Ontem/)
    assert.match(text, /Venda de Ana/)
    assert.match(text, /Produto Nutella/)
    assert.doesNotMatch(summaryText, new RegExp(saleId))
    assert.doesNotMatch(summaryText, new RegExp(productId))
  } finally { act(() => root?.unmount()); setRole(null) }
})

test('mantém objetos distintos separados quando detalhes trazem identidade', async () => {
  auditUI.page = async () => ({ entries: await auditUI.load(), cursor: { v2: null, legacy: null, v2Done: true, legacyDone: true }, hasMore: false })
  auditUI.load = async () => [row('event-id', Date.now(), 'Venda alterada')]
  auditUI.details = async () => ({
    changes: [
      { entity: 'Venda: Ana', source: 'sales', entityId: 'v1', field: 'total', before: 10, after: 12 },
      { entity: 'Venda: Ana', source: 'sales', entityId: 'v1', field: 'status', before: 'Pendente', after: 'Pago' },
      { entity: 'Venda: Ana', source: 'sales', entityId: 'v2', field: 'total', before: 20, after: 22 },
    ] as any,
  })
  setRole('owner')
  let root: any
  try {
    await act(async () => { root = create(<AuditView/>) })
    const toggle = root.root.findAllByType('button').find((button: any) => button.props.className === 'audit-event-summary')
    await act(async () => { toggle.props.onClick() })
    assert.equal(root.root.findAll((node: any) => node.props.className === 'audit-change-group').length, 2)
    assert.match(content(root), /Campo/)
    assert.match(content(root), /Antes/)
    assert.match(content(root), /Depois/)
    assert.match(content(root), /Informações técnicas/)
  } finally { act(() => root?.unmount()); setRole(null) }
})

test('com paginação pendente explica que a lista carregada pode ser ampliada', async () => {
  auditUI.page = async () => ({ entries: [], cursor: { v2: null, legacy: null, v2Done: false, legacyDone: true }, hasMore: true })
  setRole('owner')
  let root: any
  try {
    await act(async () => { root = create(<AuditView/>) })
    assert.match(content(root), /Nenhum registro encontrado nos registros já carregados/)
    assert.match(content(root), /Buscar registros mais antigos/)
  } finally { act(() => root?.unmount()); setRole(null) }
})

test('exportação cria BOM e linhas CSV reais e protege prefixos de fórmula', async () => {
  const unsafe = ['=formula', '+formula', '-formula', '@formula', '\tformula', '\rformula']
  const originalBlob = globalThis.Blob
  const originalDocument = (globalThis as any).document
  const originalURLDescriptor = Object.getOwnPropertyDescriptor(globalThis.URL, 'createObjectURL')
  const originalRevokeURLDescriptor = Object.getOwnPropertyDescriptor(globalThis.URL, 'revokeObjectURL')
  let captured: Blob | undefined
  const anchor = { href: '', download: '', click: () => {} }
  class CaptureBlob extends originalBlob {
    constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options)
      captured = this
    }
  }
  Object.defineProperty(globalThis, 'Blob', { configurable: true, writable: true, value: CaptureBlob })
  Object.defineProperty(globalThis.URL, 'createObjectURL', { configurable: true, writable: true, value: () => 'blob:audit' })
  Object.defineProperty(globalThis.URL, 'revokeObjectURL', { configurable: true, writable: true, value: () => {} })
  ;(globalThis as any).document = { createElement: () => anchor, getElementById: () => null }
  auditUI.page = async () => ({
    entries: unsafe.map((value, index) => ({ ...row('csv-' + index, Date.now() - index * 1000, value), actor: value })),
    cursor: { v2: null, legacy: null, v2Done: true, legacyDone: true },
    hasMore: false,
  })
  setRole('owner')
  let root: any
  try {
    await act(async () => { root = create(<AuditView/>) })
    const exportButton = root.root.findAllByType('button').find((button: any) => button.children.join('') === 'Exportar histórico')
    await act(async () => { exportButton.props.onClick() })
    assert.ok(captured)
    const bytes = new Uint8Array(await captured!.arrayBuffer())
    assert.deepEqual([...bytes.slice(0, 3)], [0xEF, 0xBB, 0xBF])
    const csv = await captured!.text()
    assert.equal(csv.split('\r\n').length, unsafe.length + 1)
    for (const value of unsafe) assert.ok(csv.includes('"' + "'" + value))
  } finally {
    Object.defineProperty(globalThis, 'Blob', { configurable: true, writable: true, value: originalBlob })
    if (originalURLDescriptor) Object.defineProperty(globalThis.URL, 'createObjectURL', originalURLDescriptor)
    else delete (globalThis.URL as any).createObjectURL
    if (originalRevokeURLDescriptor) Object.defineProperty(globalThis.URL, 'revokeObjectURL', originalRevokeURLDescriptor)
    else delete (globalThis.URL as any).revokeObjectURL
    if (originalDocument === undefined) delete (globalThis as any).document
    else (globalThis as any).document = originalDocument
    act(() => root?.unmount()); setRole(null)
  }
})

test('pré-visualiza reversão, cancelar preserva e confirmar marca o evento como desfeito', async () => {
  let undoCalls = 0
  auditUI.page = async () => ({ entries: await auditUI.load(), cursor: { v2: null, legacy: null, v2Done: true, legacyDone: true }, hasMore: false })
  auditUI.load = async () => [{ ...row('undo-id', Date.now(), 'Produto alterado'), hasUndo: true }]
  auditBackend.previewUndo = async () => [{ source: 'products', count: 1 }]
  auditBackend.undoAction = async () => { undoCalls++ }
  setRole('owner')
  let root: any
  try {
    await act(async () => { root = create(<AuditView/>) })
    const buttons = () => root.root.findAllByType('button')
    const actionButton = () => buttons().find((button: any) => String(button.props.className || '').includes('audit-undo-button'))
    await act(async () => { actionButton().props.onClick() })
    assert.match(content(root), /1 produtos/)
    await act(async () => { buttons().find((button: any) => button.children.join('') === 'Cancelar').props.onClick() })
    assert.equal(undoCalls, 0)
    assert.ok(actionButton())
    await act(async () => { actionButton().props.onClick() })
    await act(async () => { buttons().find((button: any) => button.children.join('') === 'Confirmar reversão').props.onClick() })
    assert.equal(undoCalls, 1)
    assert.match(content(root), /Desfeita/)
    assert.equal(actionButton(), undefined)
  } finally {
    auditBackend.previewUndo = async () => []
    auditBackend.undoAction = async () => {}
    act(() => root?.unmount()); setRole(null)
  }
})

test('falha de conflito na reversão continua visível e não anuncia sucesso', async () => {
  auditUI.page = async () => ({ entries: await auditUI.load(), cursor: { v2: null, legacy: null, v2Done: true, legacyDone: true }, hasMore: false })
  auditUI.load = async () => [{ ...row('conflict-id', Date.now(), 'Produto alterado'), hasUndo: true }]
  auditBackend.previewUndo = async () => [{ source: 'products', count: 1 }]
  auditBackend.undoAction = async () => { throw Error('Conflito detectado') }
  setRole('owner')
  let root: any
  try {
    await act(async () => { root = create(<AuditView/>) })
    const buttons = () => root.root.findAllByType('button')
    const actionButton = () => buttons().find((button: any) => String(button.props.className || '').includes('audit-undo-button'))
    await act(async () => { actionButton().props.onClick() })
    await act(async () => { buttons().find((button: any) => button.children.join('') === 'Confirmar reversão').props.onClick() })
    assert.match(content(root), /Conflito detectado/)
    assert.doesNotMatch(content(root), /Desfeita/)
    assert.ok(actionButton())
  } finally {
    auditBackend.previewUndo = async () => []
    auditBackend.undoAction = async () => {}
    act(() => root?.unmount()); setRole(null)
  }
})
