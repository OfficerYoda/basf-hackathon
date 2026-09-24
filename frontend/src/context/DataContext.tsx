import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Employee, Article, SkillDefinition } from '../mock/data'
import {
  listEmployees, createEmployee, updateEmployee, deleteEmployee,
  type EmployeeInput,
} from '../api/employees'
import {
  listArticles, getArticle, createArticle, updateArticle, deleteArticle,
  uploadAttachment, deleteAttachment, type ArticleInput,
} from '../api/articles'
import { listSkills, createSkill, updateSkill, deleteSkill } from '../api/skills'
import { ApiError } from '../api/client'

interface Store {
  employees:      Employee[]
  articles:       Article[]
  skillDefs:      SkillDefinition[]
  skillNames:     string[]
  loading:        boolean
  error:          string | null
  reload:         () => Promise<void>
  addEmployee:    (e: EmployeeInput) => Promise<Employee>
  editEmployee:   (id: number, e: EmployeeInput) => Promise<Employee>
  removeEmployee: (id: number) => Promise<void>
  addArticle:     (a: ArticleInput, files?: File[]) => Promise<Article>
  editArticle:    (id: number, a: ArticleInput) => Promise<Article>
  removeArticle:  (id: number) => Promise<void>
  addAttachment:    (articleId: number, file: File) => Promise<Article>
  removeAttachment: (articleId: number, attachmentId: number) => Promise<Article>
  addSkillDef:    (name: string, description: string) => Promise<SkillDefinition>
  editSkillDef:   (name: string, description: string) => Promise<SkillDefinition>
  removeSkillDef: (name: string) => Promise<void>
}

const Ctx = createContext<Store | null>(null)

function messageOf(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'something went wrong'
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [articles,  setArticles]  = useState<Article[]>([])
  const [skillDefs, setSkillDefs] = useState<SkillDefinition[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const [emps, arts, skills] = await Promise.all([
        listEmployees(),
        listArticles(),
        listSkills(),
      ])
      setEmployees(emps)
      setArticles(arts)
      setSkillDefs(skills)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void reload() }, [])

  async function addEmployee(input: EmployeeInput): Promise<Employee> {
    const created = await createEmployee(input)
    setEmployees(prev => [...prev, created])
    return created
  }

  async function editEmployee(id: number, input: EmployeeInput): Promise<Employee> {
    const updated = await updateEmployee(id, input)
    setEmployees(prev => prev.map(e => (e.id === id ? updated : e)))
    return updated
  }

  async function removeEmployee(id: number): Promise<void> {
    await deleteEmployee(id)
    setEmployees(prev => prev.filter(e => e.id !== id))
  }

  async function addArticle(input: ArticleInput, files: File[] = []): Promise<Article> {
    const created = await createArticle(input)
    // Attachments are uploaded one-by-one after the article exists.
    for (const file of files) {
      await uploadAttachment(created.id, file)
    }
    // Re-fetch the article's final shape (with real attachment metadata) only
    // if we uploaded files; otherwise the create response is already complete.
    const finalArticle = files.length ? await getArticle(created.id) : created
    setArticles(prev => [...prev, finalArticle])
    return finalArticle
  }

  async function editArticle(id: number, input: ArticleInput): Promise<Article> {
    await updateArticle(id, input)
    // Re-fetch to keep attachment metadata (not part of the update payload).
    const fresh = await getArticle(id)
    setArticles(prev => prev.map(a => (a.id === id ? fresh : a)))
    return fresh
  }

  async function removeArticle(id: number): Promise<void> {
    await deleteArticle(id)
    setArticles(prev => prev.filter(a => a.id !== id))
  }

  async function addAttachment(articleId: number, file: File): Promise<Article> {
    await uploadAttachment(articleId, file)
    const fresh = await getArticle(articleId)
    setArticles(prev => prev.map(a => (a.id === articleId ? fresh : a)))
    return fresh
  }

  async function removeAttachment(articleId: number, attachmentId: number): Promise<Article> {
    await deleteAttachment(attachmentId)
    const fresh = await getArticle(articleId)
    setArticles(prev => prev.map(a => (a.id === articleId ? fresh : a)))
    return fresh
  }

  function reindexSkills(list: SkillDefinition[]): SkillDefinition[] {
    const next = [...list].sort((a, b) => a.name.localeCompare(b.name))
    next.forEach((s, i) => { s.id = i + 1 })
    return next
  }

  async function addSkillDef(name: string, description: string): Promise<SkillDefinition> {
    const created = await createSkill(name, description)
    setSkillDefs(prev => reindexSkills([...prev.filter(s => s.name !== created.name), created]))
    return created
  }

  async function editSkillDef(name: string, description: string): Promise<SkillDefinition> {
    const updated = await updateSkill(name, description)
    setSkillDefs(prev => reindexSkills(prev.map(s => (s.name === name ? { ...s, description: updated.description } : s))))
    return updated
  }

  async function removeSkillDef(name: string): Promise<void> {
    await deleteSkill(name)
    setSkillDefs(prev => reindexSkills(prev.filter(s => s.name !== name)))
  }

  const skillNames = skillDefs.map(s => s.name)

  return (
    <Ctx.Provider value={{
      employees, articles, skillDefs, skillNames, loading, error, reload,
      addEmployee, editEmployee, removeEmployee,
      addArticle, editArticle, removeArticle, addAttachment, removeAttachment,
      addSkillDef, editSkillDef, removeSkillDef,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useData(): Store {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}
