import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from 'recharts'
import type { Skill } from '../mock/data'

interface SkillRadarProps {
  skills: Skill[]
}

const RadarTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { skill: string; rating: number } }[] }) => {
  if (!active || !payload?.length) return null
  const { skill, rating } = payload[0].payload
  return (
    <div className="bg-[var(--color-surface-high)] border border-[var(--color-border-high)] rounded-[var(--radius-sm)] px-3 py-2 text-xs">
      <p className="font-mono font-semibold text-[var(--color-text)]">{skill}</p>
      <p className="text-[var(--color-sub)]">rating: <span className="font-mono text-[var(--color-accent)]">{rating}</span></p>
    </div>
  )
}

// A per-employee spider chart: one axis per skill, plotted at its 0–10 rating.
export default function SkillRadar({ skills }: SkillRadarProps) {
  const data = skills.map(s => ({ skill: s.name, rating: s.rating }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="var(--color-border)" />
        <PolarAngleAxis
          dataKey="skill"
          tick={{ fill: 'var(--color-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
        />
        <PolarRadiusAxis domain={[0, 10]} tick={{ fill: 'var(--color-muted)', fontSize: 9 }} axisLine={false} />
        <Radar
          dataKey="rating"
          stroke="var(--color-accent)"
          fill="var(--color-accent)"
          fillOpacity={0.25}
          strokeWidth={1.5}
        />
        <Tooltip content={<RadarTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  )
}
