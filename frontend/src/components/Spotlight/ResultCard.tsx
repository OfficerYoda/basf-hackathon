import type { ResultItem } from './useSpotlight'
import SkillBadge from '../SkillBadge'

interface Props {
  item: ResultItem
  selected: boolean
  onActivate: (item: ResultItem) => void
  onMouseEnter: () => void
}

export default function ResultCard({ item, selected, onActivate, onMouseEnter }: Props) {
  const base = 'flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-[var(--radius-sm)] transition-colors'
  const state = selected
    ? 'bg-[var(--color-surface-high)] border border-[var(--color-border-high)]'
    : 'border border-transparent hover:bg-[var(--color-surface-high)]'

  if (item.kind === 'command') {
    const { data } = item
    return (
      <div className={`${base} ${state} mx-1`} onClick={() => onActivate(item)} onMouseEnter={onMouseEnter}>
        <span className="w-6 h-6 flex items-center justify-center text-sm shrink-0">{data.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-text)]">{data.label}</p>
          <p className="text-xs text-[var(--color-muted)] truncate">{data.description}</p>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-accent-dim)] text-[var(--color-accent)] border border-[var(--color-accent)]/20 shrink-0">
          cmd
        </span>
      </div>
    )
  }

  if (item.kind === 'employee') {
    const e = item.data
    const initials = e.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    return (
      <div className={`${base} ${state} mx-1`} onClick={() => onActivate(item)} onMouseEnter={onMouseEnter}>
        <div className="w-6 h-6 rounded-[var(--radius-sm)] bg-[var(--color-surface-high)] border border-[var(--color-border-high)] flex items-center justify-center text-[10px] font-semibold text-[var(--color-sub)] shrink-0 font-mono">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-text)]">{e.name}</p>
          <p className="text-xs text-[var(--color-muted)] truncate">{e.department}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          {e.skills.slice(0, 2).map(s => <SkillBadge key={s.name} skill={s} size="sm" />)}
        </div>
      </div>
    )
  }

  if (item.kind === 'article') {
    const a = item.data
    return (
      <div className={`${base} ${state} mx-1`} onClick={() => onActivate(item)} onMouseEnter={onMouseEnter}>
        <div className="w-6 h-6 flex items-center justify-center text-sm shrink-0 text-[var(--color-muted)]">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-text)] truncate">{a.title}</p>
          <p className="text-xs text-[var(--color-muted)] truncate">{a.author} · {a.skills.slice(0, 2).join(', ')}</p>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-surface-high)] text-[var(--color-muted)] border border-[var(--color-border-high)] shrink-0">
          article
        </span>
      </div>
    )
  }

  return null
}
