import { useState, useRef } from 'react'
import { useData } from '../context/DataContext'
import type { ArticleInput } from '../api/articles'
import type { Attachment } from '../mock/data'
import { attachmentDownloadUrl } from '../api/articles'
import FormField, { inputCls, textareaCls } from './FormField'
import TagInput from './TagInput'

export interface ArticleFormInitial {
  title: string
  description: string
  content: string
  author: string
  contributors: string[]
  skills: string[]
}

interface ArticleFormProps {
  initial?: ArticleFormInitial
  submitLabel: string
  submittingLabel: string
  // Attachments can be added in both create and edit mode. In edit mode, the
  // parent also passes the existing attachments and a remover so they can be
  // managed inline.
  allowAttachments?: boolean
  existingAttachments?: Attachment[]
  onRemoveAttachment?: (attachmentId: number) => Promise<void>
  onSubmit: (input: ArticleInput, files: File[]) => Promise<void>
  onCancel: () => void
}

// Shared create/edit form for knowledge-base articles. The author and helpers
// must resolve to real employees, since the backend links contributors by id.
export default function ArticleForm({
  initial, submitLabel, submittingLabel,
  allowAttachments = false, existingAttachments, onRemoveAttachment,
  onSubmit, onCancel,
}: ArticleFormProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const { employees, skillNames } = useData()

  const [title,        setTitle]        = useState(initial?.title ?? '')
  const [description,  setDescription]  = useState(initial?.description ?? '')
  const [content,      setContent]      = useState(initial?.content ?? '')
  const [authorQuery,  setAuthorQuery]  = useState(initial?.author ?? '')
  const [contributors, setContributors] = useState<string[]>(initial?.contributors ?? [])
  const [skillTags,    setSkillTags]    = useState<string[]>(initial?.skills ?? [])
  const [files,        setFiles]        = useState<File[]>([])
  const [removingId,   setRemovingId]   = useState<number | null>(null)
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [submitting,   setSubmitting]   = useState(false)

  const employeeNames = employees.map(e => e.name)
  const authorMatch = employees.find(e => e.name === authorQuery.trim())
  const valid = title.trim() && description.trim() && content.trim() && authorMatch

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      return [...prev, ...picked.filter(f => !existing.has(f.name))]
    })
    e.target.value = ''
  }

  async function removeExisting(attachmentId: number) {
    if (!onRemoveAttachment) return
    setRemovingId(attachmentId)
    setError(null)
    try {
      await onRemoveAttachment(attachmentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not remove attachment')
    } finally {
      setRemovingId(null)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || !authorMatch || submitting) return
    setError(null)
    setSubmitting(true)
    // First contributor id is the primary author; the rest are helpers.
    const contributorIds = [
      authorMatch.id,
      ...contributors
        .map(name => employees.find(emp => emp.name === name)?.id)
        .filter((id): id is number => typeof id === 'number'),
    ]
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        content: content.trim(),
        skills: skillTags,
        contributorIds,
      }, files)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not save article')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5 flex flex-col gap-4">
        <FormField label="Title" required>
          <input
            className={inputCls}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Python Best Practices at BASF"
            autoFocus
          />
        </FormField>
        <FormField label="Description" required hint="Summary of what this article covers">
          <textarea
            className={textareaCls}
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the content and purpose of this article..."
          />
        </FormField>
        <FormField label="Content" required hint="The full article body">
          <textarea
            className={textareaCls}
            rows={6}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write the article content here..."
          />
        </FormField>
        <FormField label="Author" required hint="Primary author — must be an existing employee">
          <input
            className={inputCls}
            list="author-list"
            value={authorQuery}
            onChange={e => setAuthorQuery(e.target.value)}
            placeholder="e.g. Ada Lovelace"
          />
          <datalist id="author-list">
            {employeeNames.map(n => <option key={n} value={n} />)}
          </datalist>
          {authorQuery.trim() && !authorMatch && (
            <p className="text-[10px] text-[var(--color-accent)]">Pick an existing employee as author.</p>
          )}
        </FormField>
      </div>

      <div className="rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5 flex flex-col gap-4">
        <p className="text-xs font-medium text-[var(--color-sub)] uppercase tracking-widest">Optional</p>

        <FormField label="Additional helpers" hint="Other employees who contributed">
          <TagInput
            options={employeeNames.filter(n => n !== authorQuery.trim())}
            selected={contributors}
            onChange={setContributors}
            placeholder="Search contributors…"
          />
        </FormField>

        <FormField label="Skill tags" hint="Existing skills this article covers">
          <TagInput
            options={skillNames}
            selected={skillTags}
            onChange={setSkillTags}
            placeholder="Search skill tags…"
          />
        </FormField>

        {allowAttachments && (
          <FormField label="File attachments" hint="PDFs, diagrams, or other supporting files">
            {existingAttachments && existingAttachments.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-2">
                {existingAttachments.map(att => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-high)] border border-[var(--color-border)]"
                  >
                    <a
                      href={attachmentDownloadUrl(att.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[var(--color-sub)] hover:text-[var(--color-accent)] font-mono truncate transition-colors"
                    >
                      {att.filename}
                    </a>
                    <button
                      type="button"
                      onClick={() => removeExisting(att.id)}
                      disabled={removingId === att.id}
                      className="text-[var(--color-muted)] hover:text-red-400 text-xs shrink-0 disabled:opacity-40 transition-colors"
                    >
                      {removingId === att.id ? '…' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div
              className="border border-dashed border-[var(--color-border-high)] rounded-[var(--radius-sm)] p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-[var(--color-accent)]/40 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <svg className="w-5 h-5 text-[var(--color-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <p className="text-xs text-[var(--color-muted)]">Click to attach files</p>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileChange} />
            </div>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {files.map(f => (
                  <span key={f.name} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--color-border-high)] text-xs text-[var(--color-sub)] font-mono">
                    {f.name}
                    <button type="button" onClick={() => setFiles(p => p.filter(x => x.name !== f.name))} className="text-[var(--color-muted)] hover:text-[var(--color-text)] leading-none">×</button>
                  </span>
                ))}
              </div>
            )}
          </FormField>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={onCancel} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
          Cancel
        </button>
        {saved ? (
          <span className="flex items-center gap-1.5 text-xs text-[var(--color-accent)]">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </span>
        ) : (
          <button
            type="submit"
            disabled={!valid || submitting}
            className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-black text-xs font-semibold hover:opacity-90 disabled:opacity-30 transition-opacity"
          >
            {submitting ? submittingLabel : submitLabel}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  )
}
