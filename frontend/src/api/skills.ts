import { api } from './client'
import type { SkillDefinition } from '../mock/data'

interface ApiSkill {
  name: string
  description: string
}

// The backend keys skills by name (no numeric id). The frontend SkillDefinition
// carries an id purely as a stable React list key, so we synthesise one from the
// position in the (name-ordered) list returned by the backend.
function toSkillDef(s: ApiSkill, index: number): SkillDefinition {
  return { id: index + 1, name: s.name, description: s.description ?? '' }
}

export async function listSkills(): Promise<SkillDefinition[]> {
  const rows = await api.get<ApiSkill[]>('/api/skills')
  return (rows ?? []).map(toSkillDef)
}

export async function createSkill(name: string, description: string): Promise<SkillDefinition> {
  const created = await api.post<ApiSkill>('/api/skills', { name, description })
  // id is only meaningful within a full list; use 0 here — the DataContext
  // refetches / re-indexes on its own.
  return toSkillDef(created, -1)
}

// Skills are keyed by name in the backend; the name is immutable, so updates
// only change the description.
export async function updateSkill(name: string, description: string): Promise<SkillDefinition> {
  const updated = await api.put<ApiSkill>(`/api/skills/${encodeURIComponent(name)}`, { description })
  return toSkillDef(updated, -1)
}

export async function deleteSkill(name: string): Promise<void> {
  await api.del(`/api/skills/${encodeURIComponent(name)}`)
}
