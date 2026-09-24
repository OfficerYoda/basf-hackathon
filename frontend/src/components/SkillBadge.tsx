import type { Skill } from '../mock/data'

interface Props {
  skill: Skill
  size?: 'sm' | 'md'
}

export default function SkillBadge({ skill, size = 'md' }: Props) {
  const pad = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] font-mono border border-[var(--color-border-high)] text-[var(--color-sub)] bg-transparent ${pad}`}
    >
      {skill.name}
      <span
        className="text-[10px] font-semibold px-1 rounded"
        style={{ background: `rgba(232,255,77,${0.08 + (skill.rating / 10) * 0.22})`, color: 'var(--color-accent)' }}
      >
        {skill.rating}
      </span>
    </span>
  )
}
