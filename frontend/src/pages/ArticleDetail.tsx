import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { attachmentDownloadUrl } from '../api/articles'
import ConfirmDialog from '../components/ConfirmDialog'
import MarkdownContent from '../components/MarkdownContent'
import SkillTag from '../components/SkillTag'

export default function ArticleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { articles, employees, removeArticle } = useData()
  const article = articles.find(a => a.id === Number(id))

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!article) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-muted)] gap-3 text-sm">
        <p>Article not found</p>
        <button onClick={() => navigate('/wissensbasis')} className="text-[var(--color-accent)] hover:underline text-xs">← Back</button>
      </div>
    )
  }

  async function handleDelete() {
    if (!article) return
    setDeleting(true)
    setError(null)
    try {
      await removeArticle(article.id)
      navigate('/wissensbasis')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not delete article')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const attachments = article.attachments ?? []

  // Render a person's name as a link to their employee page when it resolves to
  // a known employee; otherwise plain text.
  function personName(name: string) {
    const match = employees.find(e => e.name === name)
    if (!match) return <span>{name}</span>
    return (
      <Link to={`/employees/${match.id}`} className="hover:text-[var(--color-accent)] transition-colors">
        {name}
      </Link>
    )
  }

  return (
    <div className="p-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => navigate('/wissensbasis')}
          className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Knowledge Base
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/wissensbasis/${article.id}/edit`)}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-high)] text-xs text-[var(--color-sub)] transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-red-500/30 text-red-300 hover:bg-red-500/10 text-xs transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <article className="rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
        <div className="h-px bg-[var(--color-accent)]" />
        <div className="p-6 flex flex-col gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[var(--color-text)] leading-snug">{article.title}</h1>
            <p className="text-sm text-[var(--color-muted)] mt-2 leading-relaxed">{article.description}</p>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted)] font-mono flex-wrap">
            <span className="text-[var(--color-sub)]">{personName(article.author)}</span>
            {article.contributors && article.contributors.length > 0 && (
              <>
                <span>+</span>
                {article.contributors.map((c, i) => (
                  <span key={c}>
                    {personName(c)}{i < article.contributors!.length - 1 ? ',' : ''}
                  </span>
                ))}
              </>
            )}
            <span>·</span>
            <span>{new Date(article.timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>

          {article.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {article.skills.map(s => (
                <SkillTag key={s} name={s} />
              ))}
            </div>
          )}

          {article.content && (
            <div className="border-t border-[var(--color-border)] pt-4">
              <MarkdownContent content={article.content} />
            </div>
          )}

          {attachments.length > 0 && (
            <div className="border-t border-[var(--color-border)] pt-4">
              <p className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-widest mb-3">
                Attachments
              </p>
              <div className="flex flex-col gap-1.5">
                {attachments.map(att => (
                  <a
                    key={att.id}
                    href={attachmentDownloadUrl(att.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-high)] border border-[var(--color-border)] text-xs text-[var(--color-sub)] hover:text-[var(--color-accent)] hover:border-[var(--color-border-high)] font-mono truncate transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="truncate">{att.filename}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete article"
        message={`Delete "${article.title}"? This removes the article and all its attachments. This cannot be undone.`}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
