import { api, postForm } from './client'
import type { Article } from '../mock/data'

// Backend article shape. Richer than the frontend Article: contributors are
// full employee objects and attachments are metadata records. The frontend
// Article keeps a flattened, display-oriented shape, so we map both ways here.
interface ApiEmployeeRef {
  id: number
  name: string
}

interface ApiAttachment {
  id: number
  article_id: number
  filename: string
  mime_type: string
  size_bytes: number
  created_at: string
}

interface ApiArticle {
  id: number
  title: string
  description: string
  content: string
  created_at: string
  updated_at: string
  skills: string[]
  contributors: ApiEmployeeRef[]
  attachments: ApiAttachment[]
}

// toArticle flattens the backend representation into the frontend Article the
// pages already consume: the first contributor is treated as the primary
// author, the rest as additional contributors, and attachments collapse to
// their filenames.
function toArticle(a: ApiArticle): Article {
  const contributors = a.contributors ?? []
  const [author, ...rest] = contributors
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    content: a.content,
    author: author?.name ?? 'Unknown',
    skills: a.skills ?? [],
    timestamp: a.created_at,
    contributors: rest.length ? rest.map(c => c.name) : undefined,
    attachments: (a.attachments ?? []).length
      ? a.attachments.map(f => ({ id: f.id, filename: f.filename }))
      : undefined,
  }
}

export interface ArticleInput {
  title: string
  description: string
  content: string
  skills: string[]
  // First id is the primary author, the remainder are additional contributors.
  contributorIds: number[]
}

export async function listArticles(): Promise<Article[]> {
  const rows = await api.get<ApiArticle[]>('/api/articles')
  return (rows ?? []).map(toArticle)
}

export async function getArticle(id: number): Promise<Article> {
  const a = await api.get<ApiArticle>(`/api/articles/${id}`)
  return toArticle(a)
}

export async function createArticle(input: ArticleInput): Promise<Article> {
  const created = await api.post<ApiArticle>('/api/articles', {
    title: input.title,
    description: input.description,
    content: input.content,
    skills: input.skills,
    contributor_ids: input.contributorIds,
  })
  return toArticle(created)
}

export async function updateArticle(id: number, input: ArticleInput): Promise<Article> {
  const updated = await api.put<ApiArticle>(`/api/articles/${id}`, {
    title: input.title,
    description: input.description,
    content: input.content,
    skills: input.skills,
    contributor_ids: input.contributorIds,
  })
  return toArticle(updated)
}

export async function deleteArticle(id: number): Promise<void> {
  await api.del(`/api/articles/${id}`)
}

// uploadAttachment posts a single file to an article. The backend accepts one
// file per request under the form field "file", so callers upload in a loop.
// It returns the flattened Article containing the new attachment metadata.
export async function uploadAttachment(articleId: number, file: File): Promise<void> {
  const form = new FormData()
  form.append('file', file)
  await postForm<ApiAttachment>(`/api/articles/${articleId}/attachments`, form)
}

export async function deleteAttachment(attachmentId: number): Promise<void> {
  await api.del(`/api/attachments/${attachmentId}`)
}

// attachmentDownloadUrl is the same-origin path the browser can hit directly
// (Vite proxies /api to the backend in dev).
export function attachmentDownloadUrl(attachmentId: number): string {
  return `/api/attachments/${attachmentId}`
}
