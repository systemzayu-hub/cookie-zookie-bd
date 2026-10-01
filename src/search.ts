/** Display searches are independent of identity matching and never change stored values. */
export function searchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()
}

export function matchesSearch(query: string, ...values: Array<string | undefined | null>): boolean {
  const text = searchText(values.filter(Boolean).join(' '))
  return searchText(query).split(' ').filter(Boolean).every(term => text.includes(term) || (/^\d{3,}$/.test(term) && text.replace(/\D/g, '').includes(term)))
}
