import { useId, useState } from 'react'
import { matchesSearch } from '../search'
import { SearchInput } from './SearchInput'

export function SearchableSelect({ label, value, onChange, options, emptyLabel = 'Selecione…', required = false }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ id: string; name: string }>; emptyLabel?: string; required?: boolean }) {
  const [query, setQuery] = useState('')
  const id = useId()
  const matches = options.filter(option => matchesSearch(query, option.name))
  const selected = options.find(option => option.id === value)
  const visible = selected && !matches.some(option => option.id === value) ? [selected, ...matches] : matches
  return <div className="searchable-select">
    <SearchInput value={query} onChange={setQuery} label={`Buscar ${label.toLocaleLowerCase('pt-BR')}`} placeholder="Digite o nome…" />
    <label htmlFor={id}>{label}</label>
    <select id={id} value={value} required={required} onChange={event => onChange(event.target.value)}>
      <option value="">{emptyLabel}</option>
      {visible.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
    </select>
    {query && <small role="status">{matches.length} opção(ões) encontrada(s){selected && !matches.includes(selected) ? ' · seleção atual preservada' : ''}</small>}
  </div>
}
