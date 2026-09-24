import { useState, useMemo } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import SkillTag from '../components/SkillTag'

export default function Wissensbasis() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { articles, employees } = useData()
  const [query, setQuery] = useState('')
  const highlightId = Number(searchParams.get('article'))

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    if (!q) return articles
    return articles.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.skills.some(s => s.toLowerCase().includes(q)) ||
      a.author.toLowerCase().includes(q)
    )
  }, [query, articles])

  return (
    <div className="p-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-text)]">Knowledge Base</h1>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">{articles.length} articles</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Filter articles..."
              className="pl-8 pr-3 py-1.5 text-sm rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-muted)] outline-none focus:border-[var(--color-border-high)] transition-colors w-44"
            />
          </div>
          <button
            onClick={() => navigate('/wissensbasis/new')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-black text-xs font-semibold hover:opacity-90 transition-opacity shrink-0"
          >
            <span className="text-sm leading-none">+</span> New
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[var(--color-muted)] text-sm">No results for "{query}"</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(article => (
            <div
              key={article.id}
              onClick={() => navigate(`/wissensbasis/${article.id}`)}
              className={`rounded-[var(--radius)] bg-[var(--color-surface)] border transition-colors p-4 flex flex-col gap-3 cursor-pointer ${
                article.id === highlightId
                  ? 'border-[var(--color-accent)]/40'
                  : 'border-[var(--color-border)] hover:border-[var(--color-border-high)]'
              }`}
            >
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text)] leading-snug">{article.title}</h3>
                <p className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed line-clamp-2">{article.description}</p>
              </div>
              {article.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {article.skills.map(s => (
                    <SkillTag key={s} name={s} stopPropagation />
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-muted)] pt-2 border-t border-[var(--color-border)] mt-auto font-mono flex-wrap">
                {employees.find(employee => employee.name === article.author) ? (
                  <Link
                    to={`/employees/${employees.find(employee => employee.name === article.author)!.id}`}
                    onClick={event => event.stopPropagation()}
                    className="text-[var(--color-sub)] transition-colors hover:text-[var(--color-accent)]"
                  >
                    {article.author}
                  </Link>
                ) : <span>{article.author}</span>}
                {article.contributors && article.contributors.length > 0 && (
                  <>
                    <span>+</span>
                    <span>{article.contributors.join(', ')}</span>
                  </>
                )}
                <span>·</span>
                <span>{new Date(article.timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                {article.attachments && article.attachments.length > 0 && (
                  <>
                    <span>·</span>
                    <span>{article.attachments.length} file{article.attachments.length > 1 ? 's' : ''}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
