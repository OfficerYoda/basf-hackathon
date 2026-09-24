import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import SkillBadge from '../components/SkillBadge'
import RatingBar from '../components/RatingBar'
import SkillRadar from '../components/SkillRadar'
import ConfirmDialog from '../components/ConfirmDialog'

export default function EmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { employees, articles, removeEmployee } = useData()
  const employee = employees.find(e => e.id === Number(id))
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-muted)] gap-3 text-sm">
        <p>Employee not found</p>
        <button onClick={() => navigate('/employees')} className="text-[var(--color-accent)] hover:underline text-xs">← Back</button>
      </div>
    )
  }

  const initials = employee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  // Articles this person authored or contributed to (matched by name — the
  // flattened Article carries names, not ids).
  const authored = articles.filter(a =>
    a.author === employee.name || (a.contributors ?? []).includes(employee.name)
  )

  async function handleDelete() {
    if (!employee) return
    setDeleting(true)
    setError(null)
    try {
      await removeEmployee(employee.id)
      navigate('/employees')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not delete employee')
      setDeleting(false)
      setConfirmOpen(false)
    }
  }

  return (
    <div className="p-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Employees
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/employees/${employee.id}/edit`)}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-high)] text-xs text-[var(--color-sub)] transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-red-500/30 text-red-300 hover:bg-red-500/10 text-xs transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

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
            <>
              {employee.skills.length >= 3 && (
                <div className="mb-5 -mx-2">
                  <SkillRadar skills={employee.skills} />
                </div>
              )}
              <div className="flex flex-col gap-4">
                {employee.skills
                  .slice()
                  .sort((a, b) => b.rating - a.rating)
                  .map(skill => (
                    <div key={skill.name} className="flex items-center gap-3">
                      <Link to={`/skills/${encodeURIComponent(skill.name.toLowerCase())}`} className="w-32 shrink-0 hover:opacity-80 transition-opacity">
                        <SkillBadge skill={skill} size="sm" />
                      </Link>
                      <RatingBar value={skill.rating} className="flex-1" />
                      <span className="text-xs text-[var(--color-muted)] font-mono w-6 text-right">{skill.rating}</span>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5 mt-4">
        <p className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-widest mb-3">
          Articles · {authored.length}
        </p>
        {authored.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">No articles yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {authored.map(article => (
              <Link
                key={article.id}
                to={`/wissensbasis/${article.id}`}
                className="px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-high)] border border-[var(--color-border)] hover:border-[var(--color-border-high)] transition-colors"
              >
                <p className="text-sm text-[var(--color-text)] leading-snug">{article.title}</p>
                <p className="text-[10px] text-[var(--color-muted)] mt-0.5 line-clamp-1">{article.description}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete employee"
        message={`Delete ${employee.name}? This removes their profile and skill ratings. This cannot be undone.`}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
