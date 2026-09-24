import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useData } from '../context/DataContext'
import type { Employee } from '../mock/data'

function buildData(employees: Employee[]) {
  const depts = [...new Set(employees.map(e => e.department))]
  const allSkills = [...new Set(employees.flatMap(e => e.skills.map(s => s.name)))]
  const topSkills = allSkills
    .map(skill => ({
      skill,
      count: employees.filter(e => e.skills.some(s => s.name === skill)).length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return { depts, rows: topSkills.map(({ skill }) => {
    const row: Record<string, string | number> = { skill }
    depts.forEach(dept => {
      const emps = employees.filter(e => e.department === dept)
      const ratings = emps.flatMap(e => e.skills.filter(s => s.name === skill).map(s => s.rating))
      row[dept] = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0
    })
    return row
  })}
}

const BAR_COLORS = ['rgba(232,255,77,0.9)', 'rgba(232,255,77,0.55)', 'rgba(232,255,77,0.35)', 'rgba(232,255,77,0.2)']

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--color-surface-high)] border border-[var(--color-border-high)] rounded-[var(--radius-sm)] px-3 py-2.5 text-xs">
      <p className="font-mono font-semibold text-[var(--color-text)] mb-1.5">{label}</p>
      {payload.filter(p => p.value > 0).map(p => (
        <p key={p.name} className="text-[var(--color-sub)]">
          {p.name}: <span className="font-mono text-[var(--color-text)]">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

export default function Heatmap() {
  const { employees } = useData()
  const { depts, rows } = buildData(employees)

  return (
    <div className="p-5 max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-[var(--color-text)]">Competency Heatmap</h1>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">Average rating per skill by department</p>
      </div>

      <div className="rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] p-5 mb-4">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={rows} margin={{ top: 5, right: 10, left: -20, bottom: 55 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="skill"
              tick={{ fill: 'var(--color-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              angle={-35} textAnchor="end" interval={0}
              axisLine={false} tickLine={false}
            />
            <YAxis domain={[0, 10]} tick={{ fill: 'var(--color-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '11px', color: 'var(--color-muted)' }} />
            {depts.map((dept, i) => (
              <Bar key={dept} dataKey={dept} fill={BAR_COLORS[i % BAR_COLORS.length]} radius={[3, 3, 0, 0]} maxBarSize={20} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {depts.map((dept, i) => {
          const emps = employees.filter(e => e.department === dept)
          return (
            <div key={dept} className="rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] p-3">
              <p className="text-xs text-[var(--color-muted)] truncate">{dept}</p>
              <p className="text-xl font-bold mt-1 font-mono" style={{ color: BAR_COLORS[i % BAR_COLORS.length] }}>
                {emps.length}
              </p>
              <p className="text-[10px] text-[var(--color-muted)]">{emps.reduce((acc, e) => acc + e.skills.length, 0)} skills</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
