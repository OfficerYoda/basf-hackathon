import { useParams, useNavigate, Link } from 'react-router-dom'
import { useData } from '../context/DataContext'

export default function SkillDetail() {
  const { name } = useParams()
  const navigate = useNavigate()
  const { skillDefs, employees, articles } = useData()

  const skillName = decodeURIComponent(name ?? '').toLowerCase()
  const definition = skillDefs.find(s => s.name.toLowerCase() === skillName)

  // Everyone who lists this skill, strongest first.
  const holders = employees
    .map(e => ({ employee: e, rating: e.skills.find(s => s.name.toLowerCase() === skillName)?.rating }))
    .filter((h): h is { employee: typeof employees[number]; rating: number } => typeof h.rating === 'number')
    .sort((a, b) => b.rating - a.rating)

  const relatedArticles = articles.filter(a => a.skills.some(s => s.toLowerCase() === skillName))

  const displayName = definition?.name ?? skillName

  return (
    <div className="p-5 max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/skills')}
        className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] mb-5 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Skills
      </button>

      <div className="rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden mb-4">
        <div className="h-px bg-[var(--color-accent)]" />
        <div className="p-5">
          <h1 className="text-lg font-semibold text-[var(--color-accent)] font-mono">{displayName}</h1>
          <p className="text-sm text-[var(--color-muted)] mt-2 leading-relaxed">
            {definition?.description || <span className="italic opacity-60">No description defined.</span>}
          </p>
        </div>
      </div>

      <div className="rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5 mb-4">
        <p className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-widest mb-3">
          Employees with this skill · {holders.length}
        </p>
        {holders.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">No employees list this skill yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {holders.map(({ employee, rating }) => (
              <Link
                key={employee.id}
                to={`/employees/${employee.id}`}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-high)] border border-[var(--color-border)] hover:border-[var(--color-border-high)] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[var(--color-text)] truncate">{employee.name}</p>
                  <p className="text-[10px] text-[var(--color-muted)] truncate">{employee.department}</p>
                </div>
                <span
                  className="text-[11px] font-semibold px-1.5 py-0.5 rounded font-mono shrink-0"
                  style={{ background: `rgba(232,255,77,${0.08 + (rating / 10) * 0.22})`, color: 'var(--color-accent)' }}
                >
                  {rating}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
        <p className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-widest mb-3">
          Articles tagged with this skill · {relatedArticles.length}
        </p>
        {relatedArticles.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">No articles reference this skill yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {relatedArticles.map(article => (
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
    </div>
  )
}
