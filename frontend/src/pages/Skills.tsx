import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'

export default function Skills() {
  const navigate = useNavigate()
  const { skillDefs } = useData()

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

      <div className="flex flex-col gap-2">
        {skillDefs.map(skill => (
          <div
            key={skill.id}
            className="flex items-start gap-4 px-4 py-3 rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-high)] transition-colors"
          >
            <span className="font-mono text-sm text-[var(--color-accent)] shrink-0 mt-0.5 min-w-[140px]">
              {skill.name}
            </span>
            <p className="text-xs text-[var(--color-muted)] leading-relaxed">{skill.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
