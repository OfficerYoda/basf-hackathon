// Shared domain types used across the app. Data itself now comes from the Go
// backend via src/api/* — see DataContext. (These types intentionally live in
// mock/ so existing import paths keep working after the live-API cutover.)

export interface Skill {
  name: string
  rating: number
}

export interface Employee {
  id: number
  name: string
  email: string
  department: string
  skills: Skill[]
}

export interface SkillDefinition {
  id: number
  name: string
  description: string
}

export interface Attachment {
  id: number
  filename: string
}

export interface Article {
  id: number
  title: string
  description: string
  content?: string
  author: string
  skills: string[]
  timestamp: string
  contributors?: string[]
  attachments?: Attachment[]
}
