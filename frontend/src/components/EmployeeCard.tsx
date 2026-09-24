import { useNavigate } from 'react-router-dom'
import type { Employee } from '../mock/data'
import SkillBadge from './SkillBadge'

interface Props { employee: Employee }

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function EmployeeCard({ employee }: Props) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`/employees/${employee.id}`)}
      className="group w-full text-left rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-high)] transition-colors duration-[var(--transition)] p-4 flex flex-col gap-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-surface-high)] border border-[var(--color-border-high)] flex items-center justify-center text-xs font-semibold text-[var(--color-sub)] shrink-0 font-mono">
          {initials(employee.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text)] truncate">{employee.name}</p>
          <p className="text-xs text-[var(--color-muted)] truncate">{employee.department}</p>
        </div>
        <svg className="w-3.5 h-3.5 text-[var(--color-muted)] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {employee.skills.slice(0, 3).map(s => <SkillBadge key={s.name} skill={s} size="sm" />)}
        {employee.skills.length > 3 && (
          <span className="text-xs text-[var(--color-muted)] self-center">+{employee.skills.length - 3}</span>
        )}
      </div>
    </button>
  )
}
