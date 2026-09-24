import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import FormField, { inputCls, textareaCls } from '../components/FormField'

export default function CreateSkill() {
  const navigate = useNavigate()
  const { skillDefs, addSkillDef, nextSkillDefId } = useData()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saved, setSaved] = useState(false)

  const nameNorm = name.trim().toLowerCase()
  const duplicate = skillDefs.some(s => s.name === nameNorm)
  const valid = nameNorm.length > 0 && description.trim().length > 0 && !duplicate

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    addSkillDef({ id: nextSkillDefId(), name: nameNorm, description: description.trim() })
    setSaved(true)
    setTimeout(() => navigate('/skills'), 800)
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
        Skills
      </button>

      <h1 className="text-lg font-semibold text-[var(--color-text)] mb-5">New Skill</h1>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5 flex flex-col gap-4">
          <FormField label="Title" required hint='Stored lowercase — e.g. "machine learning"'>
            <input
              className={inputCls}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. machine learning"
              autoFocus
            />
            {duplicate && (
              <p className="text-[10px] text-[var(--color-accent)]">A skill named "{nameNorm}" already exists.</p>
            )}
          </FormField>

          <FormField label="Description" required hint="What does this skill cover? How is it used at BASF?">
            <textarea
              className={textareaCls}
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the skill and its relevance..."
            />
          </FormField>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
          >
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
              Create Skill
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
