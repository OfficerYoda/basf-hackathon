import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'

type NodeKind = 'employee' | 'skill' | 'article'

interface GalaxyNode {
  id: string
  label: string
  meta: string
  kind: NodeKind
  x: number
  y: number
  href: string
}

interface Edge {
  from: string
  to: string
}

const nodeStyle: Record<NodeKind, { radius: number; fill: string; stroke: string }> = {
  employee: { radius: 44, fill: '#111111', stroke: '#e8ff4d' },
  skill: { radius: 22, fill: '#e8ff4d', stroke: '#e8ff4d' },
  article: { radius: 26, fill: '#181818', stroke: '#888888' },
}

function point(index: number, total: number, rx: number, ry: number, offset = -Math.PI / 2) {
  const angle = offset + (index / Math.max(total, 1)) * Math.PI * 2
  return { x: 500 + Math.cos(angle) * rx, y: 310 + Math.sin(angle) * ry }
}

function skillLabelLines(label: string) {
  if (label.length <= 8) return [label]
  const middle = Math.ceil(label.length / 2)
  const separators = [...label.matchAll(/[-/ ]/g)].map(match => match.index + 1)
  const split = separators.sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle))[0] ?? middle
  const first = label.slice(0, split).trim()
  const second = label.slice(split).trim()
  return [first.slice(0, 9), second.length > 9 ? `${second.slice(0, 8)}…` : second]
}

export default function SkillGalaxy() {
  const { employees, articles, skillDefs } = useData()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)

  const { nodes, edges } = useMemo(() => {
    const skillNames = Array.from(new Set([
      ...skillDefs.map(skill => skill.name),
      ...employees.flatMap(employee => employee.skills.map(skill => skill.name)),
      ...articles.flatMap(article => article.skills),
    ])).sort()

    const employeeNodes: GalaxyNode[] = employees.map((employee, index) => ({
      id: `employee:${employee.id}`,
      label: employee.name,
      meta: employee.department,
      kind: 'employee',
      ...point(index, employees.length, 245, 150, -Math.PI / 2),
      href: `/employees/${employee.id}`,
    }))
    const skillNodes: GalaxyNode[] = skillNames.map((skill, index) => ({
      id: `skill:${skill}`,
      label: skill,
      meta: 'Skill',
      kind: 'skill',
      ...point(index, skillNames.length, 410, 245, -Math.PI / 2.3),
      href: `/skills/${encodeURIComponent(skill)}`,
    }))
    const articleNodes: GalaxyNode[] = articles.map((article, index) => ({
      id: `article:${article.id}`,
      label: article.title,
      meta: 'Wissensartikel',
      kind: 'article',
      ...point(index, articles.length, 105, 65, 0),
      href: `/wissensbasis/${article.id}`,
    }))

    const graphEdges: Edge[] = [
      ...employees.flatMap(employee => employee.skills.map(skill => ({
        from: `employee:${employee.id}`,
        to: `skill:${skill.name}`,
      }))),
      ...articles.flatMap(article => article.skills.map(skill => ({
        from: `article:${article.id}`,
        to: `skill:${skill}`,
      }))),
    ]

    return { nodes: [...employeeNodes, ...skillNodes, ...articleNodes], edges: graphEdges }
  }, [employees, articles, skillDefs])

  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const nodeIndex = new Map(nodes.map((node, index) => [node.id, index]))
  const search = query.trim().toLowerCase()
  const focusIds = new Set<string>()
  const seeds = activeId
    ? [activeId]
    : search
      ? nodes.filter(node => `${node.label} ${node.meta}`.toLowerCase().includes(search)).map(node => node.id)
      : []
  seeds.forEach(id => focusIds.add(id))
  edges.forEach(edge => {
    if (seeds.includes(edge.from)) focusIds.add(edge.to)
    if (seeds.includes(edge.to)) focusIds.add(edge.from)
  })

  const focusedNode = activeId ? nodeById.get(activeId) : undefined
  const focusedConnections = activeId
    ? edges.filter(edge => edge.from === activeId || edge.to === activeId).length
    : 0
  const isFocused = (id: string) => focusIds.size === 0 || focusIds.has(id)

  function activate(node: GalaxyNode) {
    navigate(node.href)
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-[var(--color-bg)] px-4 py-5 sm:px-6">
      <div className="pointer-events-none absolute inset-0 galaxy-grid" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-accent)] opacity-[0.035] blur-3xl" />

      <header className="relative z-10 mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-accent)]">Live knowledge network</p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)] sm:text-4xl">Skill Galaxy</h1>
          <p className="mt-2 max-w-lg text-sm text-[var(--color-sub)]">See who knows what, where knowledge lives, and which connections keep it alive.</p>
        </div>
        <label className="flex w-full items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border-high)] bg-[var(--color-surface)] px-3 py-2.5 sm:w-72">
          <span className="font-mono text-[var(--color-accent)]">⌕</span>
          <span className="sr-only">Filter galaxy</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Find a person, skill or article"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-muted)]"
          />
        </label>
      </header>

      <div className="relative z-10 mx-auto mt-4 max-w-6xl overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-black/40">
        <div className="absolute left-4 top-4 z-10 flex gap-4 font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          <span><b className="text-[var(--color-text)]">{employees.length}</b> people</span>
          <span><b className="text-[var(--color-accent)]">{nodes.filter(node => node.kind === 'skill').length}</b> skills</span>
          <span><b className="text-[var(--color-text)]">{edges.length}</b> links</span>
        </div>

        {focusedNode && (
          <div className="absolute right-4 top-4 z-20 max-w-72 rounded-[var(--radius)] border border-[var(--color-border-high)] bg-[var(--color-surface)]/95 px-3 py-2 shadow-[var(--shadow-sm)]">
            <p className="text-xs font-semibold leading-relaxed text-[var(--color-text)]">{focusedNode.label}</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase text-[var(--color-accent)]">{focusedNode.meta} · {focusedConnections} links</p>
          </div>
        )}

        <svg viewBox="0 0 1000 620" className="block min-h-[32rem] w-full" aria-label="Interactive network of employees, skills and knowledge articles">
          <g>
            {edges.map((edge, index) => {
              const from = nodeById.get(edge.from)
              const to = nodeById.get(edge.to)
              if (!from || !to) return null
              const highlighted = isFocused(edge.from) && isFocused(edge.to)
              const arrivalDelay = Math.max(nodeIndex.get(edge.from) ?? 0, nodeIndex.get(edge.to) ?? 0) * 55 + 500
              return (
                <g
                  key={`${edge.from}-${edge.to}`}
                  style={{
                    opacity: focusIds.size === 0 ? 0.24 : highlighted ? 0.85 : 0.035,
                  }}
                >
                  <line
                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    className="galaxy-edge"
                    style={{ animationDelay: `${arrivalDelay}ms, ${arrivalDelay + index * 70}ms` }}
                  />
                </g>
              )
            })}
          </g>

          {nodes.map((node, index) => {
            const style = nodeStyle[node.kind]
            const focused = isFocused(node.id)
            const [firstName, ...rest] = node.label.split(' ')
            const skillLines = node.kind === 'skill' ? skillLabelLines(node.label) : []
            const skillFontSize = Math.min(8.5, 64 / Math.max(...skillLines.map(line => line.length), 1))
            return (
              <g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-label={`${node.label}, ${node.meta}`}
                onMouseEnter={() => setActiveId(node.id)}
                onMouseLeave={() => setActiveId(null)}
                onFocus={() => setActiveId(node.id)}
                onBlur={() => setActiveId(null)}
                onClick={() => activate(node)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') activate(node)
                }}
                className="galaxy-node cursor-pointer outline-none"
                style={{ opacity: focused ? 1 : 0.16, animationDelay: `${index * 55}ms` }}
              >
                <circle
                  cx={node.x} cy={node.y} r={style.radius}
                  fill={style.fill} stroke={style.stroke}
                  strokeWidth={node.kind === 'skill' ? 0 : 1.5}
                  className={activeId === node.id ? 'galaxy-orbit' : ''}
                />
                {node.kind === 'skill' && <circle cx={node.x} cy={node.y} r={style.radius + 7} fill="none" stroke="#e8ff4d" opacity="0.16" />}
                <text
                  x={node.x}
                  y={node.kind === 'skill' ? node.y + 3 : node.kind === 'article' ? node.y + 5 : node.y - 2}
                  textAnchor="middle"
                  fill={node.kind === 'skill' ? '#000000' : '#f2f2f2'}
                  fontSize={node.kind === 'skill' ? skillFontSize : node.kind === 'article' ? 16 : 11}
                  fontWeight="600"
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {node.kind === 'employee' ? (
                    <>
                      <tspan x={node.x} dy="-0.2em">{firstName}</tspan>
                      {rest.length > 0 && <tspan x={node.x} dy="1.15em">{rest.join(' ')}</tspan>}
                    </>
                  ) : node.kind === 'article' ? '≡' : (
                    skillLines.map((line, lineIndex) => (
                      <tspan key={lineIndex} x={node.x} dy={lineIndex === 0 ? (skillLines.length > 1 ? '-0.55em' : '0') : '1.05em'}>{line}</tspan>
                    ))
                  )}
                </text>
                {node.kind === 'article' && activeId === node.id && (
                  <foreignObject x={node.x - 110} y={node.y + style.radius + 8} width="220" height="64" pointerEvents="none">
                    <div className="text-center text-[10px] leading-tight text-[var(--color-sub)]">
                      {node.label}
                    </div>
                  </foreignObject>
                )}
              </g>
            )
          })}
        </svg>

        <div className="absolute bottom-3 left-4 flex gap-4 font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted)]">
          <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full border border-[var(--color-accent)]" />People</span>
          <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]" />Skills</span>
          <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full border border-[var(--color-sub)]" />Knowledge</span>
        </div>
      </div>

      <style>{`
        .galaxy-grid {
          background-image: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(circle at center, black, transparent 72%);
        }
        .galaxy-edge {
          stroke: var(--color-accent);
          stroke-width: 1;
          stroke-dasharray: 3 5;
          animation: galaxy-edge-arrive 300ms ease-out both, galaxy-flow 12s linear infinite;
          transition: opacity 180ms ease;
        }
        .galaxy-node { animation: galaxy-arrive 500ms both; transition: opacity 180ms ease; transform-box: fill-box; transform-origin: center; }
        .galaxy-node:focus circle:first-child { stroke-width: 3; }
        .galaxy-orbit { filter: drop-shadow(0 0 10px rgba(232,255,77,.55)); }
        @keyframes galaxy-flow { to { stroke-dashoffset: -80; } }
        @keyframes galaxy-edge-arrive { from { stroke-opacity: 0; } to { stroke-opacity: 1; } }
        @keyframes galaxy-arrive { from { opacity: 0; transform: scale(.82); transform-origin: center; } }
        @media (prefers-reduced-motion: reduce) {
          .galaxy-edge, .galaxy-node { animation: none; }
        }
      `}</style>
    </div>
  )
}
