import { useParams, useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import SkillBadge from '../components/SkillBadge'
import RatingBar from '../components/RatingBar'

export default function EmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { employees } = useData()
  const employee = employees.find(e => e.id === Number(id))

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-muted)] gap-3 text-sm">
        <p>Employee not found</p>
        <button onClick={() => navigate('/employees')} className="text-[var(--color-accent)] hover:underline text-xs">← Back</button>
      </div>
    )
  }

  const initials = employee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="p-5 max-w-lg mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] mb-5 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Employees
      </button>

      <div className="rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
        <div className="h-px bg-[var(--color-accent)]" />
        <div className="p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-[var(--radius)] bg-[var(--color-surface-high)] border border-[var(--color-border-high)] flex items-center justify-center text-sm font-semibold text-[var(--color-sub)] shrink-0 font-mono">
            {initials}
          </div>
          <div>
            <h1 className="text-base font-semibold text-[var(--color-text)]">{employee.name}</h1>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">{employee.email}</p>
            <p className="text-xs text-[var(--color-sub)] mt-0.5">{employee.department}</p>
          </div>
        </div>
        <div className="px-5 pb-5 border-t border-[var(--color-border)] pt-4">
          <p className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-widest mb-4">Skills</p>
          {employee.skills.length === 0 ? (
            <p className="text-xs text-[var(--color-muted)]">No skills added yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {employee.skills
                .sort((a, b) => b.rating - a.rating)
                .map(skill => (
                  <div key={skill.name} className="flex items-center gap-3">
                    <div className="w-32 shrink-0">
                      <SkillBadge skill={skill} size="sm" />
                    </div>
                    <RatingBar value={skill.rating} className="flex-1" />
                    <span className="text-xs text-[var(--color-muted)] font-mono w-6 text-right">{skill.rating}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
