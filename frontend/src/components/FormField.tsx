import type { ReactNode } from 'react'

interface Props {
  label: string
  hint?: string
  required?: boolean
  children: ReactNode
}

export default function FormField({ label, hint, required, children }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1 text-xs font-medium text-[var(--color-sub)] uppercase tracking-widest">
        {label}
        {required && <span className="text-[var(--color-accent)] text-[10px]">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-[var(--color-muted)]">{hint}</p>}
    </div>
  )
}

export const inputCls =
  'px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-high)] border border-[var(--color-border)] text-[var(--color-text)] text-sm outline-none focus:border-[var(--color-border-high)] placeholder:text-[var(--color-muted)] transition-colors w-full'

export const textareaCls = `${inputCls} resize-none`
