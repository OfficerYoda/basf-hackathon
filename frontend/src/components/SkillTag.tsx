import { Link } from 'react-router-dom'

interface SkillTagProps {
  name: string
  // When the tag lives inside another click target (e.g. a clickable card),
  // pass stopPropagation so the tag navigates to the skill page instead of
  // triggering the parent.
  stopPropagation?: boolean
}

// A skill name rendered as a link to its dedicated skill detail page. Styled to
// match the small tag chips used across articles.
export default function SkillTag({ name, stopPropagation = false }: SkillTagProps) {
  return (
    <Link
      to={`/skills/${encodeURIComponent(name.toLowerCase())}`}
      onClick={stopPropagation ? e => e.stopPropagation() : undefined}
      className="text-[10px] px-1.5 py-0.5 rounded font-mono border border-[var(--color-border-high)] text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/40 transition-colors"
    >
      {name}
    </Link>
  )
}
