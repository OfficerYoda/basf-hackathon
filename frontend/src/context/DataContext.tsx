import { createContext, useContext, useState, type ReactNode } from 'react'
import {
  mockEmployees as seedEmployees,
  mockArticles as seedArticles,
  mockSkillDefs as seedSkillDefs,
  type Employee,
  type Article,
  type SkillDefinition,
} from '../mock/data'

interface Store {
  employees:   Employee[]
  articles:    Article[]
  skillDefs:   SkillDefinition[]
  addEmployee: (e: Employee) => void
  addArticle:  (a: Article)  => void
  addSkillDef: (s: SkillDefinition) => void
  nextEmployeeId: () => number
  nextArticleId:  () => number
  nextSkillDefId: () => number
}

const Ctx = createContext<Store | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>(seedEmployees)
  const [articles,  setArticles]  = useState<Article[]>(seedArticles)
  const [skillDefs, setSkillDefs] = useState<SkillDefinition[]>(seedSkillDefs)

  const addEmployee = (e: Employee) => setEmployees(prev => [...prev, e])
  const addArticle  = (a: Article)  => setArticles(prev  => [...prev, a])
  const addSkillDef = (s: SkillDefinition) => setSkillDefs(prev => [...prev, s])

  const nextEmployeeId = () => Math.max(0, ...employees.map(e => e.id)) + 1
  const nextArticleId  = () => Math.max(0, ...articles.map(a => a.id))  + 1
  const nextSkillDefId = () => Math.max(0, ...skillDefs.map(s => s.id)) + 1

  return (
    <Ctx.Provider value={{ employees, articles, skillDefs, addEmployee, addArticle, addSkillDef, nextEmployeeId, nextArticleId, nextSkillDefId }}>
      {children}
    </Ctx.Provider>
  )
}

export function useData(): Store {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}
