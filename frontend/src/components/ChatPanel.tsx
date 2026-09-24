import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'assistant' | 'user'
  text: string
}

/** Mock LLM conversation for the exit-interview / knowledge-capture skill.
 *  Real implementation: replace `mockReply` with a streaming Claude tool-call. */
const SCRIPT: { trigger: RegExp; reply: string }[] = [
  {
    trigger: /.*/,
    reply: "I'll help you document your knowledge before you leave. First — what are the 2–3 most critical processes or topics only you currently handle?",
  },
  {
    trigger: /.*/,
    reply: "Got it. Who should be the primary contact for each of those after you leave? (Name + topic is enough)",
  },
  {
    trigger: /.*/,
    reply: "Thanks. Finally — is there any existing documentation (wikis, docs, repos) people should know about, or anything that still needs to be written?",
  },
  {
    trigger: /.*/,
    reply: "Perfect. I've compiled this into a draft knowledge base article under your name. It will appear in the knowledge base once reviewed. Thank you for your contribution. 🎯",
  },
]

interface Props {
  onClose: () => void
}

export default function ChatPanel({ onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: "Hi! I can help document your knowledge as part of an exit interview. Ready to start?" },
  ])
  const [input, setInput] = useState('')
  const [step, setStep] = useState(0)
  const [typing, setTyping] = useState(false)
  const [done, setDone] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  useEffect(() => {
    inputRef.current?.focus()
  }, [typing])

  function send() {
    const text = input.trim()
    if (!text || typing || done) return
    setInput('')
    setMessages(m => [...m, { role: 'user', text }])
    setTyping(true)

    const nextStep = step
    setTimeout(() => {
      const reply = SCRIPT[Math.min(nextStep, SCRIPT.length - 1)].reply
      setMessages(m => [...m, { role: 'assistant', text: reply }])
      setTyping(false)
      if (nextStep >= SCRIPT.length - 1) setDone(true)
      else setStep(s => s + 1)
    }, 800 + Math.random() * 400)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 flex flex-col rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border-high)] shadow-[var(--shadow)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
          <span className="text-xs font-semibold text-[var(--color-text)]">Exit Interview</span>
        </div>
        <button onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5 max-h-72">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] text-xs leading-relaxed px-3 py-2 rounded-[var(--radius-sm)] ${
                m.role === 'user'
                  ? 'bg-[var(--color-accent)] text-black font-medium'
                  : 'bg-[var(--color-surface-high)] text-[var(--color-text)] border border-[var(--color-border-high)]'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
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
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={done ? 'Interview complete' : 'Type your answer...'}
          disabled={typing || done}
          className="flex-1 bg-transparent text-xs text-[var(--color-text)] placeholder:text-[var(--color-muted)] outline-none disabled:opacity-40"
        />
        <button
          onClick={send}
          disabled={!input.trim() || typing || done}
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
