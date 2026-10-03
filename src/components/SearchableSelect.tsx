import { useEffect, useId, useRef, useState } from 'react'
import { matchesSearch } from '../search'

type SearchableOption = { id: string; name: string; description?: string }

export function SearchableSelect({ label, value, onChange, options, emptyLabel = 'Selecione…', required = false }: { label: string; value: string; onChange: (value: string) => void; options: SearchableOption[]; emptyLabel?: string; required?: boolean }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const listboxId = `${id}-options`
  const matches = options.filter(option => matchesSearch(query, option.name, option.description))
  const selected = options.find(option => option.id === value)
  const visible = selected && !matches.some(option => option.id === value) ? [selected, ...matches] : matches
  const activeOption = visible[activeIndex]
  const activeOptionId = open && activeOption ? `${listboxId}-option-${activeIndex}` : undefined
  const displayValue = open ? (query || selected?.name || '') : (selected?.name || '')

  useEffect(() => {
    inputRef.current?.setCustomValidity(required && !selected ? 'Selecione uma opção.' : '')
  }, [required, selected?.id])

  const select = (option: SearchableOption) => {
    onChange(option.id)
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) { setOpen(true); setActiveIndex(0); return }
      setActiveIndex(index => Math.min(Math.max(visible.length - 1, 0), index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) { setOpen(true); setActiveIndex(Math.max(visible.length - 1, 0)); return }
      setActiveIndex(index => Math.max(0, index - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (open && visible[activeIndex]) select(visible[activeIndex])
      else { setOpen(true); setActiveIndex(0) }
    } else if (event.key === 'Escape') {
      setOpen(false)
      setActiveIndex(0)
    }
  }
  return <div className="searchable-select">
    <label htmlFor={id}>{label}</label>
    <div className="searchable-combo" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false) }}>
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-label={`Buscar ${label.toLocaleLowerCase('pt-BR')}`}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-autocomplete="list"
        aria-required={required || undefined}
        aria-invalid={required && !selected ? true : undefined}
        required={required}
        value={displayValue}
        placeholder={emptyLabel}
        onFocus={() => { setOpen(true); setActiveIndex(0) }}
        onChange={event => { setQuery(event.target.value); setActiveIndex(0); setOpen(true) }}
        onKeyDown={onKeyDown}
      />
      <button type="button" className="searchable-combo-toggle" aria-label={`${open ? 'Fechar' : 'Abrir'} opções de ${label.toLocaleLowerCase('pt-BR')}`} aria-expanded={open} onMouseDown={event => event.preventDefault()} onClick={() => { setOpen(current => { const next = !current; if (next) setActiveIndex(0); return next }); inputRef.current?.focus() }}>⌄</button>
      {open && <ul id={listboxId} role="listbox" aria-label={label} className="searchable-options">
        {visible.length ? visible.map((option, index) => <li id={`${listboxId}-option-${index}`} key={option.id} role="option" aria-selected={option.id === value} className={index === activeIndex ? 'is-active' : ''}>
          <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => select(option)}><span>{option.name}</span>{option.description && <small>{option.description}</small>}</button>
        </li>) : <li className="searchable-empty" role="status">Nenhuma opção encontrada.</li>}
      </ul>}
    </div>
      <select className="searchable-select-native" tabIndex={-1} aria-hidden="true" value={value} required={false} onChange={event => onChange(event.target.value)}>
        <option value="">{emptyLabel}</option>
        {visible.map(option => <option key={option.id} value={option.id}>{option.name}{option.description ? ` · ${option.description}` : ''}</option>)}
    </select>
    {query && <small role="status">{matches.length} opção(ões) encontrada(s){selected && !matches.includes(selected) ? ' · seleção atual preservada' : ''}</small>}
  </div>
}
