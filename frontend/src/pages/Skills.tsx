import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import type { SkillDefinition } from '../mock/data'
import ConfirmDialog from '../components/ConfirmDialog'
import { textareaCls } from '../components/FormField'

export default function Skills() {
  const navigate = useNavigate()
  const { skillDefs, editSkillDef, removeSkillDef } = useData()

  const [editingName, setEditingName] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [savingName, setSavingName] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<SkillDefinition | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEdit(skill: SkillDefinition) {
    setEditingName(skill.name)
    setDraft(skill.description)
    setError(null)
  }

  async function saveEdit(name: string) {
    setSavingName(name)
    setError(null)
    try {
      await editSkillDef(name, draft.trim())
      setEditingName(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not update skill')
    } finally {
      setSavingName(null)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    setError(null)
    try {
      await removeSkillDef(pendingDelete.name)
      setPendingDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not delete skill')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-text)]">Skills</h1>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">{skillDefs.length} defined</p>
        </div>
        <button
          onClick={() => navigate('/skills/new')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-black text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <span className="text-sm leading-none">+</span> New Skill
        </button>
      </div>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <div className="flex flex-col gap-2">
        {skillDefs.map(skill => (
          <div
            key={skill.id}
            className="flex items-start gap-4 px-4 py-3 rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-high)] transition-colors"
          >
            <Link
              to={`/skills/${encodeURIComponent(skill.name.toLowerCase())}`}
              className="font-mono text-sm text-[var(--color-accent)] shrink-0 mt-0.5 min-w-[140px] hover:underline"
            >
              {skill.name}
            </Link>
            {editingName === skill.name ? (
              <div className="flex-1 flex flex-col gap-2">
                <textarea
                  className={textareaCls}
                  rows={2}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  autoFocus
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => setEditingName(null)}
                    className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveEdit(skill.name)}
                    disabled={savingName === skill.name}
                    className="px-3 py-1 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-black text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
                  >
                    {savingName === skill.name ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="flex-1 text-xs text-[var(--color-muted)] leading-relaxed">
                  {skill.description || <span className="italic opacity-60">No description</span>}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(skill)}
                    className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setPendingDelete(skill)}
                    className="text-xs text-[var(--color-muted)] hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete skill"
        message={
          pendingDelete
            ? `Delete "${pendingDelete.name}"? If any employee or article still references this skill, deletion will be blocked.`
            : ''
        }
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
