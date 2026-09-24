import { useState, useRef, useEffect, useCallback } from 'react'
import { sendAgentMessage, type AgentMessage, type AgentAction } from '../api/agent'
import { useData } from '../context/DataContext'
import { ApiError } from '../api/client'

// A rendered chat turn: assistant messages may carry the actions the agent
// performed so we can show them as chips beneath the reply.
interface ChatMessage {
  role: 'assistant' | 'user'
  text: string
  actions?: AgentAction[]
}

interface Props {
  onClose: () => void
  // When provided, this prompt is sent automatically on mount — used for the
  // Spotlight → chat handoff so the user's typed query continues seamlessly.
  initialPrompt?: string
}

const GREETING =
  "Hi! I'm the Skill Radar assistant. Ask me to find experts, or tell me to create an employee, skill, or knowledge-base article."

export default function ChatPanel({ onClose, initialPrompt }: Props) {
  const { reload } = useData()
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', text: GREETING }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sentInitial = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  useEffect(() => {
    if (!busy) inputRef.current?.focus()
  }, [busy])

  // send runs one agent turn: it appends the user message, posts the whole
  // transcript, then appends the assistant reply. If the agent performed any
  // actions we reload the shared data so lists reflect the change immediately.
  const send = useCallback(async (raw: string) => {
    const text = raw.trim()
    if (!text || busy) return
    setInput('')

    // Build the transcript we send to the backend from the messages so far plus
    // this new user turn. The greeting is UI-only, so drop it from the wire.
    const priorTurns: AgentMessage[] = messages
      .filter(m => m.text !== GREETING)
      .map(m => ({ role: m.role, content: m.text }))
    const transcript: AgentMessage[] = [...priorTurns, { role: 'user', content: text }]

    setMessages(m => [...m, { role: 'user', text }])
    setBusy(true)
    try {
      const { reply, actions } = await sendAgentMessage(transcript)
      setMessages(m => [...m, { role: 'assistant', text: reply || '(no response)', actions: actions.length ? actions : undefined }])
      if (actions.length) void reload()
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 503
          ? 'The AI assistant is not configured on this server. Set ANTHROPIC_API_KEY on the backend to enable it.'
          : err instanceof ApiError
            ? `The assistant hit an error (${err.status}). Please try again.`
            : 'Could not reach the assistant. Please try again.'
      setMessages(m => [...m, { role: 'assistant', text: msg }])
    } finally {
      setBusy(false)
    }
  }, [busy, messages, reload])

  // Fire the seed prompt exactly once.
  useEffect(() => {
    if (initialPrompt && !sentInitial.current) {
      sentInitial.current = true
      void send(initialPrompt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt])

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] flex flex-col rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border-high)] shadow-[var(--shadow)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
          <span className="text-xs font-semibold text-[var(--color-text)]">Assistant</span>
        </div>
        <button onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5 max-h-96">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%] flex flex-col gap-1.5">
              <div
                className={`text-xs leading-relaxed px-3 py-2 rounded-[var(--radius-sm)] whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-[var(--color-accent)] text-black font-medium'
                    : 'bg-[var(--color-surface-high)] text-[var(--color-text)] border border-[var(--color-border-high)]'
                }`}
              >
                {m.text}
              </div>
              {m.actions?.map((a, j) => (
                <span
                  key={j}
                  className="self-start text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-accent-dim)] text-[var(--color-accent)] border border-[var(--color-accent)]/20"
                >
                  ✓ {a.summary}
                </span>
              ))}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-[var(--color-surface-high)] border border-[var(--color-border-high)] rounded-[var(--radius-sm)] px-3 py-2 flex gap-1 items-center">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full bg-[var(--color-muted)]"
                  style={{ animation: `bounce 1s ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[var(--color-border)] px-3 py-2.5 flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void send(input)}
          placeholder={busy ? 'Thinking…' : 'Ask or command…'}
          disabled={busy}
          className="flex-1 bg-transparent text-xs text-[var(--color-text)] placeholder:text-[var(--color-muted)] outline-none disabled:opacity-40"
        />
        <button
          onClick={() => void send(input)}
          disabled={!input.trim() || busy}
          className="w-6 h-6 rounded-[var(--radius-sm)] bg-[var(--color-accent)] flex items-center justify-center disabled:opacity-30 transition-opacity"
        >
          <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
