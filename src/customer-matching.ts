import type { Customer } from './types'

export function normalizeCustomerName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1]
    for (let j = 0; j < b.length; j++) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] === b[j] ? 0 : 1)))
    row = next
  }
  return row[b.length]
}

// Suggestions never merge people. Ambiguous and approximate names require a choice.
export function customerCandidates(input: string, customers: Customer[]): Customer[] {
  const name = normalizeCustomerName(input)
  if (!name) return []
  const compact = name.replace(/ /g, '')
  const score = (customer: Customer) => {
    const other = normalizeCustomerName(customer.name)
    if (name === other) return 0
    if (!other) return Infinity
    if (name.startsWith(other + ' ') || other.startsWith(name + ' ')) return 1
    const target = other.replace(/ /g, '')
    const limit = Math.min(compact.length, target.length) >= 8 ? 2 : 1
    if (Math.min(compact.length, target.length) < 4 || Math.abs(compact.length - target.length) > limit) return Infinity
    const edits = distance(compact, target)
    return edits <= limit ? edits + 2 : Infinity
  }
  return customers.map(customer => ({ customer, score: score(customer) })).filter(item => Number.isFinite(item.score))
    .sort((a, b) => a.score - b.score || a.customer.name.localeCompare(b.customer.name, 'pt-BR'))
    .map(item => item.customer)
}
