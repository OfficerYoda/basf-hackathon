import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import FormField, { inputCls, textareaCls } from '../components/FormField'
import TagInput from '../components/TagInput'

export default function CreateArticle() {
  const navigate = useNavigate()
  const fileRef  = useRef<HTMLInputElement>(null)
  const { employees, skillDefs, addArticle, nextArticleId } = useData()

  const [title,        setTitle]        = useState('')
  const [description,  setDescription]  = useState('')
  const [authorQuery,  setAuthorQuery]  = useState('')
  const [contributors, setContributors] = useState<string[]>([])
  const [skillTags,    setSkillTags]    = useState<string[]>([])
  const [files,        setFiles]        = useState<File[]>([])
  const [saved,        setSaved]        = useState(false)

  const employeeNames = employees.map(e => e.name)
  const skillNames    = skillDefs.map(s => s.name)
  const valid = title.trim() && description.trim() && authorQuery.trim()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      return [...prev, ...picked.filter(f => !existing.has(f.name))]
    })
    e.target.value = ''
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    addArticle({
      id: nextArticleId(),
      title: title.trim(),
      description: description.trim(),
      author: authorQuery.trim(),
      skills: skillTags,
      timestamp: new Date().toISOString(),
      contributors: contributors.length ? contributors : undefined,
      attachments: files.length ? files.map(f => f.name) : undefined,
    })
    setSaved(true)
    setTimeout(() => navigate('/wissensbasis'), 800)
  }

  return (
    <div className="p-5 max-w-lg mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] mb-5 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Wissensbasis
      </button>

      <h1 className="text-lg font-semibold text-[var(--color-text)] mb-5">New Article</h1>

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
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the content and purpose of this article..."
            />
          </FormField>
          <FormField label="Author" required hint="Primary author — type a name or pick from employees">
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

          <FormField label="Skill tags" hint="Topics this article covers">
            <TagInput
              options={skillNames}
              selected={skillTags}
              onChange={setSkillTags}
              placeholder="Search or create skill tags…"
              allowNew
            />
          </FormField>

          <FormField label="File attachments" hint="PDFs, diagrams, or other supporting files">
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
        </div>

        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate(-1)} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
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
              disabled={!valid}
              className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-black text-xs font-semibold hover:opacity-90 disabled:opacity-30 transition-opacity"
            >
              Publish Article
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
