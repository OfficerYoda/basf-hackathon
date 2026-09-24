// Thin fetch wrapper around the Go backend. In dev, Vite proxies /api and
// /health to http://localhost:8080 (see vite.config.ts), so requests are
// same-origin and need no CORS handling.

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (body && typeof body.error === 'string') return body.error
    if (body && typeof body.message === 'string') return body.message
  } catch {
    // fall through to status text
  }
  return res.statusText || `request failed (${res.status})`
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, headers: {} }
  if (body !== undefined) {
    ;(init.headers as Record<string, string>)['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  let res: Response
  try {
    res = await fetch(path, init)
  } catch (err) {
    throw new ApiError(0, err instanceof Error ? err.message : 'network error')
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res))
  }

  // 204 No Content or empty body
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export const api = {
  get:  <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put:  <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del:  <T>(path: string) => request<T>('DELETE', path),
}

// postForm sends multipart/form-data (used for file attachments). The browser
// sets the multipart boundary Content-Type automatically for FormData bodies.
export async function postForm<T>(path: string, form: FormData): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, { method: 'POST', body: form })
  } catch (err) {
    throw new ApiError(0, err instanceof Error ? err.message : 'network error')
  }
  if (!res.ok) throw new ApiError(res.status, await parseError(res))
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}
