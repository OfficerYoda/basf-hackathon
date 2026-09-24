import { useParams, useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import ArticleForm from '../components/ArticleForm'

export default function EditArticle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { articles, editArticle, addAttachment, removeAttachment } = useData()
  const article = articles.find(a => a.id === Number(id))

  if (!article) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-muted)] gap-3 text-sm">
        <p>Article not found</p>
        <button onClick={() => navigate('/wissensbasis')} className="text-[var(--color-accent)] hover:underline text-xs">← Back</button>
      </div>
    )
  }

  return (
    <div className="p-5">
      <button
        onClick={() => navigate(`/wissensbasis/${article.id}`)}
        className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] mb-5 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Article
      </button>

      <h1 className="text-lg font-semibold text-[var(--color-text)] mb-5">Edit Article</h1>

      <ArticleForm
        initial={{
          title: article.title,
          description: article.description,
          content: article.content ?? '',
          author: article.author,
          contributors: article.contributors ?? [],
          skills: article.skills,
        }}
        submitLabel="Save Changes"
        submittingLabel="Saving…"
        allowAttachments
        existingAttachments={article.attachments ?? []}
        onRemoveAttachment={async attachmentId => { await removeAttachment(article.id, attachmentId) }}
        onCancel={() => navigate(`/wissensbasis/${article.id}`)}
        onSubmit={async (input, files) => {
          await editArticle(article.id, input)
          for (const file of files) {
            await addAttachment(article.id, file)
          }
          setTimeout(() => navigate(`/wissensbasis/${article.id}`), 600)
        }}
      />
    </div>
  )
}
