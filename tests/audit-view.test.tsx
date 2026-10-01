import assert from 'node:assert/strict'
import test from 'node:test'
import { act, create } from 'react-test-renderer'
import { setRole } from '../src/auth'
import { AuditView } from '../src/views/Audit'
import { auditUI } from './audit-view-mock'

const row = (id: string, ts = 1) => ({ id, ts, actor: 'João', email: 'joao@example.test', action: 'alteracao', detail: `Mudança ${id}`, hasUndo: false })
const content = (root: any) => JSON.stringify(root.toJSON())

test('auditoria mostra carregamento e preserva evento mais novo recebido antes da carga inicial', async () => {
  let finish!: (rows: ReturnType<typeof row>[]) => void
  auditUI.load = () => new Promise(resolve => { finish = resolve })
  setRole('owner')
  let root: any
  try {
    await act(async () => { root = create(<AuditView/>) })
    assert.match(content(root), /Carregando histórico/)
    assert.doesNotMatch(content(root), /Nenhuma ação encontrada/)
    await act(async () => { auditUI.receive([row('novo', 2)]); finish([row('antigo')]) })
    assert.match(content(root), /Mudança novo/)
    assert.match(content(root), /Mudança antigo/)
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
    if (pageCalls === 1) return { entries: [row('primeiro', 3)], cursor: { v2: null, legacy: null, v2Done: false, legacyDone: true }, hasMore: true }
    if (pageCalls === 2) throw Error('offline')
    return { entries: [row('primeiro', 3), row('seguinte', 2)], cursor: { v2: null, legacy: null, v2Done: true, legacyDone: true }, hasMore: false }
  }
  setRole('owner')
  let root: any
  try {
    await act(async () => { root = create(<AuditView/>) })
    const button = (label: string) => root.root.findAllByType('button').find((item: any) => item.children.join('') === label)
    await act(async () => { button('Carregar mais registros').props.onClick() })
    assert.match(content(root), /Não foi possível carregar mais registros/)
    await act(async () => { button('Tentar carregar novamente').props.onClick() })
    assert.match(content(root), /Mudança seguinte/)
    assert.equal(root.root.findAll((node: any) => node.type === 'article' && node.props.className.startsWith('audit-event')).length, 2)
    assert.doesNotMatch(content(root), /Carregar mais registros/)
    assert.equal(pageCalls, 3)
  } finally { act(() => root?.unmount()); setRole(null) }
})

test('resposta de página antiga não altera a lista após recarregar', async () => {
  let pageCalls = 0
  let finishOldPage!: (page: any) => void
  auditUI.page = async () => {
    pageCalls++
    if (pageCalls === 1) return { entries: [row('inicial', 3)], cursor: { v2: null, legacy: null, v2Done: false, legacyDone: true }, hasMore: true }
    if (pageCalls === 2) return new Promise(resolve => { finishOldPage = resolve })
    return { entries: [row('atualizado', 4)], cursor: { v2: null, legacy: null, v2Done: true, legacyDone: true }, hasMore: false }
  }
  setRole('owner')
  let root: any
  try {
    await act(async () => { root = create(<AuditView/>) })
    const button = (label: string) => root.root.findAllByType('button').find((item: any) => item.children.join('') === label)
    await act(async () => { button('Carregar mais registros').props.onClick() })
    await act(async () => { auditUI.fail() })
    await act(async () => { button('Recarregar histórico').props.onClick() })
    assert.match(content(root), /Mudança atualizado/)
    await act(async () => { finishOldPage({ entries: [row('obsoleto', 2)], cursor: {}, hasMore: false }) })
    assert.doesNotMatch(content(root), /Mudança obsoleto/)
    assert.match(content(root), /Mudança atualizado/)
    assert.equal(pageCalls, 3)
  } finally { act(() => root?.unmount()); setRole(null) }
})
