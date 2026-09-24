import { useEffect } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// A small modal used to confirm destructive actions (deletes) before they run.
export default function ConfirmDialog({
  open, title, message,
  confirmLabel = 'Delete', cancelLabel = 'Cancel',
  busy = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={() => { if (!busy) onCancel() }}
    >
      <div
        className="w-full max-w-sm rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{title}</h2>
          <p className="text-xs text-[var(--color-muted)] mt-1.5 leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-40 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-red-500/90 text-white text-xs font-semibold hover:bg-red-500 disabled:opacity-40 transition-colors"
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
