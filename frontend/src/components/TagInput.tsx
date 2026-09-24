import { useState, useRef, useEffect } from 'react'

interface Props {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  allowNew?: boolean
}

export default function TagInput({ options, selected, onChange, placeholder = 'Type to search…', allowNew = false }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = options
    .filter(o => !selected.includes(o) && o.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8)

  const showNew = allowNew && query.trim() && !options.includes(query.trim().toLowerCase()) && !selected.includes(query.trim().toLowerCase())

  function add(value: string) {
    const v = value.trim().toLowerCase()
    if (!v || selected.includes(v)) return
    onChange([...selected, v])
    setQuery('')
    setOpen(false)
  }

  function remove(value: string) {
    onChange(selected.filter(s => s !== value))
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(s => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--color-border-high)] text-[var(--color-sub)] font-mono text-xs"
            >
              {s}
              <button
                type="button"
                onClick={() => remove(s)}
                className="text-[var(--color-muted)] hover:text-[var(--color-text)] ml-0.5 leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); if (filtered[0]) add(filtered[0]); else if (showNew) add(query) }
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-high)] border border-[var(--color-border)] text-[var(--color-text)] text-sm outline-none focus:border-[var(--color-border-high)] placeholder:text-[var(--color-muted)] transition-colors"
        autoComplete="off"
      />

      {/* Dropdown */}
      {open && (filtered.length > 0 || showNew) && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border-high)] shadow-[var(--shadow)] overflow-hidden">
          {filtered.map(o => (
            <button
              key={o}
              type="button"
              onMouseDown={e => { e.preventDefault(); add(o) }}
              className="w-full text-left px-3 py-2 text-sm text-[var(--color-text)] font-mono hover:bg-[var(--color-surface-high)] transition-colors"
            >
              {o}
            </button>
          ))}
          {showNew && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); add(query) }}
              className="w-full text-left px-3 py-2 text-sm font-mono hover:bg-[var(--color-surface-high)] transition-colors flex items-center gap-2"
            >
              <span className="text-[var(--color-accent)]">+</span>
              <span className="text-[var(--color-sub)]">Create</span>
              <span className="text-[var(--color-text)]">"{query.trim().toLowerCase()}"</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
