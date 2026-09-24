import { useState, useEffect, useCallback } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import Spotlight from './Spotlight/Spotlight'
import ChatPanel from './ChatPanel'
import Logo from './Logo'
import { useData } from '../context/DataContext'

const navItems = [
  { to: '/',             icon: '⌕', label: 'Home' },
  { to: '/employees',    icon: '∴', label: 'Employees' },
  { to: '/skills',       icon: '#', label: 'Skills' },
  { to: '/wissensbasis', icon: '≡', label: 'Knowledge Base' },
]

export default function Layout() {
  const [spotlightOpen, setSpotlightOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatSeed, setChatSeed] = useState<string | undefined>(undefined)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const location = useLocation()
  const { loading, error, reload, employees, articles, skillDefs } = useData()
  // First load = still fetching and nothing cached yet.
  const initialLoading = loading && !employees.length && !articles.length && !skillDefs.length

  const handleGlobalKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setSpotlightOpen(o => !o)
    }
    if (e.key === 'Escape') { setSpotlightOpen(false) }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [handleGlobalKey])

  useEffect(() => { setSpotlightOpen(false) }, [location.pathname])

  // openChat is the Spotlight → assistant handoff. A seed prompt (the user's
  // typed query) is sent automatically when the panel mounts.
  const openChat = useCallback((prompt?: string) => {
    setSpotlightOpen(false)
    setChatSeed(prompt)
    setChatOpen(true)
  }, [])

  const isHome = location.pathname === '/'

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* Sidebar */}
      <aside className={`shrink-0 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-200 ${sidebarCollapsed ? 'w-12' : 'w-48'}`}>
        {/* Logo */}
        <div className={`flex items-center h-12 border-b border-[var(--color-border)] shrink-0 ${sidebarCollapsed ? 'justify-center px-0' : 'gap-2.5 px-4'}`}>
          <div className="w-6 h-6 rounded-[var(--radius-sm)] bg-[var(--color-accent)] flex items-center justify-center shrink-0">
            <Logo className="w-4 h-4 text-black" />
          </div>
          {!sidebarCollapsed && <span className="text-sm font-semibold text-[var(--color-text)] tracking-tight">Orbit</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 flex flex-col gap-0.5 px-1.5">
          {navItems.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-sm)] text-sm transition-colors ${
                  isActive
                    ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-high)]'
                } ${sidebarCollapsed ? 'justify-center' : ''}`
              }
              title={sidebarCollapsed ? label : undefined}
            >
              <span className="font-mono text-base leading-none shrink-0">{icon}</span>
              {!sidebarCollapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="p-1.5 border-t border-[var(--color-border)]">
          <button
            onClick={() => setSidebarCollapsed(c => !c)}
            className={`w-full flex items-center px-2.5 py-2 rounded-[var(--radius-sm)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-high)] transition-colors text-xs ${sidebarCollapsed ? 'justify-center' : 'gap-2'}`}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={sidebarCollapsed ? 'M13 5l7 7-7 7M6 5l7 7-7 7' : 'M11 19l-7-7 7-7M18 19l-7-7 7-7'} />
            </svg>
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {!isHome && (
          <header className="sticky top-0 z-10 flex items-center justify-end px-5 h-12 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
            <button
              onClick={() => setSpotlightOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-high)] text-xs text-[var(--color-muted)] transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
              <kbd className="font-mono text-[10px] border border-[var(--color-border-high)] px-1 py-0.5 rounded">⌘K</kbd>
            </button>
          </header>
        )}
        {error && (
          <div className="mx-5 mt-3 flex items-center justify-between gap-3 px-3 py-2 rounded-[var(--radius-sm)] border border-red-500/30 bg-red-500/10 text-xs text-red-300">
            <span>Backend unavailable: {error}</span>
            <button
              onClick={() => void reload()}
              className="shrink-0 px-2 py-1 rounded-[var(--radius-sm)] border border-red-500/40 text-red-200 hover:bg-red-500/20 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
        {initialLoading ? (
          <div className="flex items-center justify-center h-[60vh] text-sm text-[var(--color-muted)]">
            Loading…
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      {/* Spotlight modal (non-home pages) */}
      {spotlightOpen && !isHome && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-black/70"
          onClick={e => { if (e.target === e.currentTarget) setSpotlightOpen(false) }}
        >
          <div className="w-full max-w-xl">
            <Spotlight
              variant="modal"
              onClose={() => setSpotlightOpen(false)}
              onOpenChat={openChat}
            />
          </div>
        </div>
      )}

      {/* Chat panel */}
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
