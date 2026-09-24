import { useState } from 'react'
import Spotlight from '../components/Spotlight/Spotlight'
import ChatPanel from '../components/ChatPanel'
import Logo from '../components/Logo'

const suggestions = [
  'who knows python',
  'find cryptography experts',
  'browse employees',
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
        <div className="flex flex-col items-center text-center gap-3">
          <Logo className="w-10 h-10 text-[var(--color-accent)]" />
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">
            Orbit
          </h1>
          <p className="text-sm text-[var(--color-muted)] -mt-1">
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
