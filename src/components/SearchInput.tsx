import { Search, X } from 'lucide-react'
import { useId } from 'react'

export function SearchInput({ value, onChange, label, placeholder = label, inputId }: { value: string; onChange: (value: string) => void; label: string; placeholder?: string; inputId?: string }) {
  const generatedId = useId()
  const id = inputId || generatedId
  return <div className="search-control">
    <label htmlFor={id}>{label}</label>
    <div className="search-control-field"><Search size={17} aria-hidden="true" />
      <input id={id} aria-label={label} type="search" value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
      {value && <button type="button" className="search-clear" aria-label={`Limpar ${label.toLocaleLowerCase('pt-BR')}`} onClick={() => onChange('')}><X size={16} /></button>}
    </div>
  </div>
}
