import { useRef, useEffect, KeyboardEvent } from 'react'
import { useSpotlight } from './useSpotlight'
import { isSearchIntent } from '../../mock/llm'
import ResultCard from './ResultCard'

interface Props {
  variant?: 'page' | 'modal'
  onClose?: () => void
  onOpenChat?: (prompt?: string) => void
  autoFocus?: boolean
}

export default function Spotlight({ onClose, onOpenChat, autoFocus = true }: Props) {
  const { query, results, selectedIdx, search, activate, moveUp, moveDown, clear } = useSpotlight(onOpenChat)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 50)
  }, [autoFocus])

  function submit() {
    // If the user explicitly arrowed to a result, honour that selection.
    if (selectedIdx > 0 && results[selectedIdx]) {
      activate(results[selectedIdx])
      onClose?.()
      return
    }
    // Otherwise decide by intent: a plain search opens the top result (if any);
    // anything conversational/command-like hands off to the assistant chat.
    if (query.trim() && !isSearchIntent(query)) {
      onOpenChat?.(query.trim())
      clear()
      onClose?.()
      return
    }
    if (results[0]) {
      activate(results[0])
      onClose?.()
    }
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); moveDown(); break
      case 'ArrowUp':   e.preventDefault(); moveUp(); break
      case 'Enter':
        e.preventDefault()
        submit()
        break
      case 'Escape':
        e.preventDefault()
        if (query) { clear() } else { onClose?.() }
        break
    }
  }

  const hasResults = results.length > 0
  const trimmed = query.trim()
  // Show an explicit "Ask the assistant" affordance whenever the query reads as
  // a command/question, so the chat handoff is discoverable (not just Enter).
  const showAskAssistant = trimmed.length > 0 && !isSearchIntent(query)
  const panelOpen = hasResults || showAskAssistant

  return (
    <div className="w-full">
      {/* Input */}
      <div
        className={`flex items-center gap-2.5 px-4 py-3 bg-[var(--color-surface)] border transition-colors ${
          panelOpen
            ? 'border-[var(--color-border-high)] border-b-[var(--color-border)] rounded-t-[var(--radius-lg)]'
            : 'border-[var(--color-border-high)] rounded-[var(--radius-lg)]'
        }`}
      >
        <svg className="w-4 h-4 text-[var(--color-muted)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => search(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Search or type a command..."
          className="flex-1 bg-transparent text-[var(--color-text)] placeholder:text-[var(--color-muted)] outline-none text-sm"
          autoComplete="off"
          spellCheck={false}
        />
        {query ? (
          <button onClick={() => { clear(); inputRef.current?.focus() }} className="text-[var(--color-muted)] hover:text-[var(--color-sub)] transition-colors p-0.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <kbd className="text-[10px] font-mono text-[var(--color-muted)] border border-[var(--color-border-high)] px-1.5 py-0.5 rounded shrink-0">⌘K</kbd>
        )}
      </div>

      {/* Results / assistant handoff */}
      {panelOpen && (
        <div className="bg-[var(--color-surface)] border border-t-0 border-[var(--color-border-high)] rounded-b-[var(--radius-lg)] pb-1 overflow-hidden">
          <div className="pt-1 flex flex-col gap-0.5">
            {showAskAssistant && (
              <button
                onClick={() => { onOpenChat?.(trimmed); clear(); onClose?.() }}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-[var(--radius-sm)] transition-colors mx-1 text-left ${
                  selectedIdx <= 0
                    ? 'bg-[var(--color-accent-dim)] border border-[var(--color-accent)]/20'
                    : 'border border-transparent hover:bg-[var(--color-surface-high)]'
                }`}
              >
                <span className="w-6 h-6 flex items-center justify-center text-sm shrink-0">✦</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">Ask the assistant</p>
                  <p className="text-xs text-[var(--color-muted)] truncate">"{trimmed}"</p>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-accent-dim)] text-[var(--color-accent)] border border-[var(--color-accent)]/20 shrink-0">
                  chat
                </span>
              </button>
            )}
            {results.map((item, i) => (
              <ResultCard
                key={i}
                item={item}
                selected={i === selectedIdx}
                onActivate={r => { activate(r); onClose?.() }}
                onMouseEnter={() => {}}
              />
            ))}
          </div>
          <div className="mt-1 mx-3 pt-2 border-t border-[var(--color-border)] flex items-center gap-4 text-[10px] text-[var(--color-muted)] pb-1">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> {showAskAssistant && selectedIdx <= 0 ? 'ask' : 'select'}</span>
            <span><kbd className="font-mono">esc</kbd> close</span>
          </div>
        </div>
      )}
    </div>
  )
}
