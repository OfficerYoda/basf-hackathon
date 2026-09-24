import { useState } from 'react'
import { useData } from '../context/DataContext'
import type { EmployeeInput } from '../api/employees'
import FormField, { inputCls } from './FormField'
import TagInput from './TagInput'

interface SkillEntry { name: string; rating: number }

interface EmployeeFormProps {
  initial?: EmployeeInput
  submitLabel: string
  submittingLabel: string
  onSubmit: (input: EmployeeInput) => Promise<void>
  onCancel: () => void
}

// Shared create/edit form for employees. The parent supplies initial values
// (for edit) and the submit handler; this component owns only local field state.
export default function EmployeeForm({
  initial, submitLabel, submittingLabel, onSubmit, onCancel,
}: EmployeeFormProps) {
  const { employees, skillNames } = useData()
  const [name,   setName]   = useState(initial?.name ?? '')
  const [email,  setEmail]  = useState(initial?.email ?? '')
  const [dept,   setDept]   = useState(initial?.department && initial.department !== 'Unassigned' ? initial.department : '')
  const [skills, setSkills] = useState<SkillEntry[]>(initial?.skills.map(s => ({ ...s })) ?? [])
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const departments = [...new Set(employees.map(e => e.department))]
  const selected    = skills.map(s => s.name)

  const valid = name.trim() && email.trim() && email.includes('@')

  function handleSkillsChange(names: string[]) {
    const added   = names.filter(n => !selected.includes(n))
    const removed = selected.filter(n => !names.includes(n))
    const next = skills.filter(s => !removed.includes(s.name))
    added.forEach(n => next.push({ name: n, rating: 5 }))
    setSkills(next)
  }

  function setRating(skillName: string, rating: number) {
    setSkills(prev => prev.map(s => s.name === skillName ? { ...s, rating } : s))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        email: email.trim(),
        department: dept.trim() || 'Unassigned',
        skills: skills.map(s => ({ name: s.name, rating: s.rating })),
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not save employee')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5 flex flex-col gap-4">
        <FormField label="Name" required>
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Ada Lovelace" autoFocus />
        </FormField>
        <FormField label="Email" required>
          <input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ada@basf.com" />
        </FormField>
        <FormField label="Department" hint="Optional — select existing or type a new one">
          <input
            className={inputCls}
            list="dept-list"
            value={dept}
            onChange={e => setDept(e.target.value)}
            placeholder="e.g. Digitalization"
          />
          <datalist id="dept-list">
            {departments.map(d => <option key={d} value={d} />)}
          </datalist>
        </FormField>
      </div>

      <div className="rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5 flex flex-col gap-4">
        <p className="text-xs font-medium text-[var(--color-sub)] uppercase tracking-widest">Skills</p>
        <FormField label="Add skills" hint="Search defined skills or type to create a new one">
          <TagInput
            options={skillNames}
            selected={selected}
            onChange={handleSkillsChange}
            placeholder="e.g. python, leadership…"
            allowNew
          />
        </FormField>
        {skills.length > 0 && (
          <div className="flex flex-col gap-3 pt-1">
            {skills.map(s => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="font-mono text-xs text-[var(--color-accent)] w-36 shrink-0 truncate">{s.name}</span>
                <input
                  type="range" min={1} max={10} value={s.rating}
                  onChange={e => setRating(s.name, Number(e.target.value))}
                  className="flex-1 accent-[var(--color-accent)] h-1 cursor-pointer"
                />
                <span className="text-xs font-mono text-[var(--color-sub)] w-6 text-right">{s.rating}</span>
              </div>
            ))}
          </div>
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
