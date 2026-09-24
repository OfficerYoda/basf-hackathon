import { useState } from 'react'
import Spotlight from '../components/Spotlight/Spotlight'
import ChatPanel from '../components/ChatPanel'

const suggestions = [
  'who knows python',
  'find cryptography experts',
  'browse employees',
  'show skill galaxy',
  "I'm leaving the company",
]

export default function Home() {
  const [chatOpen, setChatOpen] = useState(false)
  const [chatSeed, setChatSeed] = useState<string | undefined>(undefined)

  function openChat(prompt?: string) {
    setChatSeed(prompt)
    setChatOpen(true)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-xl flex flex-col items-center gap-8">
        {/* Wordmark */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">
            Skill<span className="text-[var(--color-accent)]">Radar</span>
          </h1>
          <p className="text-sm text-[var(--color-muted)] mt-2">
            Search employees · discover expertise · preserve knowledge
          </p>
        </div>

        {/* Spotlight */}
        <div className="w-full">
          <Spotlight variant="page" onOpenChat={openChat} />
        </div>

        {/* Suggestion chips */}
        <div className="flex flex-wrap justify-center gap-2">
          {suggestions.map(hint => (
            <button
              key={hint}
              onClick={() => openChat(hint)}
              className="px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/40 text-xs font-mono transition-colors"
            >
              {hint}
            </button>
          ))}
        </div>
      </div>

      {chatOpen && (
        <ChatPanel
          key={chatSeed ?? 'chat'}
          onClose={() => { setChatOpen(false); setChatSeed(undefined) }}
          initialPrompt={chatSeed}
        />
      )}
    </div>
  )
}
