interface Props {
  value: number
  max?: number
  className?: string
}

export default function RatingBar({ value, max = 10, className = '' }: Props) {
  const pct = (value / max) * 100
  return (
    <div className={`h-px rounded-full bg-[var(--color-border-high)] overflow-visible ${className}`}>
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, backgroundColor: 'var(--color-accent)', opacity: 0.4 + (value / max) * 0.6 }}
      />
    </div>
  )
}
