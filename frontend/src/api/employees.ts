import { api } from './client'
import type { Employee } from '../mock/data'

// The backend Employee shape matches the frontend one closely: id (number),
// name, email, department, skills:[{name,rating}]. department may be omitted
// (json omitempty) so we default it.
interface ApiEmployee {
  id: number
  name: string
  email: string
  department?: string
  skills: { name: string; rating: number }[]
}

function toEmployee(e: ApiEmployee): Employee {
  return {
    id: e.id,
    name: e.name,
    email: e.email,
    department: e.department ?? 'Unassigned',
    skills: e.skills ?? [],
  }
}

export interface EmployeeInput {
  name: string
  email: string
  department: string
  skills: { name: string; rating: number }[]
}

export async function listEmployees(): Promise<Employee[]> {
  const rows = await api.get<ApiEmployee[]>('/api/employees')
  return (rows ?? []).map(toEmployee)
}

export async function getEmployee(id: number): Promise<Employee> {
  const e = await api.get<ApiEmployee>(`/api/employees/${id}`)
  return toEmployee(e)
}

export async function createEmployee(input: EmployeeInput): Promise<Employee> {
  const created = await api.post<ApiEmployee>('/api/employees', input)
  return toEmployee(created)
}

export async function updateEmployee(id: number, input: EmployeeInput): Promise<Employee> {
  const updated = await api.put<ApiEmployee>(`/api/employees/${id}`, input)
  return toEmployee(updated)
}

export async function deleteEmployee(id: number): Promise<void> {
  await api.del(`/api/employees/${id}`)
}
