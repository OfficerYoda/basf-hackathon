import { useState, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import EmployeeCard from '../components/EmployeeCard'

export default function Employees() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { employees } = useData()
  const [query, setQuery] = useState(searchParams.get('skill') ?? '')

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    if (!q) return employees
    return employees.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q) ||
      e.skills.some(s => s.name.toLowerCase().includes(q))
    )
  }, [query, employees])

  return (
    <div className="p-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-text)]">Employees</h1>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">{filtered.length} of {employees.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter..."
              className="pl-8 pr-3 py-1.5 text-sm rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-muted)] outline-none focus:border-[var(--color-border-high)] transition-colors w-48"
            />
          </div>
          <button
            onClick={() => navigate('/employees/new')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-black text-xs font-semibold hover:opacity-90 transition-opacity shrink-0"
          >
            <span className="text-sm leading-none">+</span> New
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[var(--color-muted)] text-sm">No results for "{query}"</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(e => <EmployeeCard key={e.id} employee={e} />)}
        </div>
      )}
    </div>
  )
}
