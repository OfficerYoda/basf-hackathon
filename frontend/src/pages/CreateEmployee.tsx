import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import EmployeeForm from '../components/EmployeeForm'

export default function CreateEmployee() {
  const navigate = useNavigate()
  const { addEmployee } = useData()

  return (
    <div className="p-5 max-w-lg mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] mb-5 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Employees
      </button>

      <h1 className="text-lg font-semibold text-[var(--color-text)] mb-5">New Employee</h1>

      <EmployeeForm
        submitLabel="Create Employee"
        submittingLabel="Creating…"
        onCancel={() => navigate(-1)}
        onSubmit={async input => {
          const created = await addEmployee(input)
          setTimeout(() => navigate(`/employees/${created.id}`), 600)
        }}
      />
    </div>
  )
}
