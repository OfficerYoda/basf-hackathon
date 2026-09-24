import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseIntent } from '../../mock/llm'
import { useData } from '../../context/DataContext'
import type { Employee, Article } from '../../mock/data'
import type { CommandResult } from '../../mock/llm'

export type ResultItem =
  | { kind: 'employee'; data: Employee }
  | { kind: 'article'; data: Article }
  | { kind: 'command'; data: CommandResult }

export function useSpotlight(onOpenChat?: () => void) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResultItem[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const navigate = useNavigate()
  const { employees, articles } = useData()

  const search = useCallback((q: string) => {
    setQuery(q)
    setSelectedIdx(0)
    if (!q.trim()) { setResults([]); return }

    const lower = q.toLowerCase()
    const items: ResultItem[] = []

    const command = parseIntent(q)
    if (command) items.push({ kind: 'command', data: command })

    employees
      .filter(e =>
        e.name.toLowerCase().includes(lower) ||
        e.department.toLowerCase().includes(lower) ||
        e.skills.some(s => s.name.toLowerCase().includes(lower))
      )
      .slice(0, 5)
      .forEach(e => items.push({ kind: 'employee', data: e }))

    articles
      .filter(a =>
        a.title.toLowerCase().includes(lower) ||
        a.description.toLowerCase().includes(lower) ||
        a.skills.some(s => s.toLowerCase().includes(lower)) ||
        a.author.toLowerCase().includes(lower)
      )
      .slice(0, 3)
      .forEach(a => items.push({ kind: 'article', data: a }))

    setResults(items.slice(0, 8))
  }, [employees, articles])

  const activate = useCallback((item: ResultItem) => {
    if (item.kind === 'employee') {
      navigate(`/employees/${item.data.id}`)
    } else if (item.kind === 'article') {
      navigate(`/wissensbasis/${item.data.id}`)
    } else if (item.kind === 'command') {
      const intent = item.data.intent
      switch (intent.type) {
        case 'navigate':      navigate(intent.route); break
        case 'create_profile':
        case 'exit_interview':
          onOpenChat?.()
          break
        case 'show_heatmap':  navigate('/employees'); break
        case 'wissensbasis':  navigate('/wissensbasis'); break
        case 'find_skill':
          navigate(`/employees?skill=${encodeURIComponent(intent.skill)}`)
          break
      }
    }
    setQuery('')
    setResults([])
  }, [navigate, onOpenChat])

  const moveUp   = useCallback(() => setSelectedIdx(i => Math.max(0, i - 1)), [])
  const moveDown = useCallback(() => setSelectedIdx(i => Math.min(results.length - 1, i + 1)), [results.length])
  const clear    = useCallback(() => { setQuery(''); setResults([]) }, [])

  return { query, results, selectedIdx, search, activate, moveUp, moveDown, clear }
}
