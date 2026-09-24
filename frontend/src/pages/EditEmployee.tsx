import { useParams, useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import EmployeeForm from '../components/EmployeeForm'

export default function EditEmployee() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { employees, editEmployee } = useData()
  const employee = employees.find(e => e.id === Number(id))

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-muted)] gap-3 text-sm">
        <p>Employee not found</p>
        <button onClick={() => navigate('/employees')} className="text-[var(--color-accent)] hover:underline text-xs">← Back</button>
      </div>
    )
  }

  return (
    <div className="p-5 max-w-lg mx-auto">
      <button
        onClick={() => navigate(`/employees/${employee.id}`)}
        className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] mb-5 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {employee.name}
      </button>

      <h1 className="text-lg font-semibold text-[var(--color-text)] mb-5">Edit Employee</h1>

      <EmployeeForm
        initial={{
          name: employee.name,
          email: employee.email,
          department: employee.department,
          skills: employee.skills,
        }}
        submitLabel="Save Changes"
        submittingLabel="Saving…"
        onCancel={() => navigate(`/employees/${employee.id}`)}
        onSubmit={async input => {
          await editEmployee(employee.id, input)
          setTimeout(() => navigate(`/employees/${employee.id}`), 600)
        }}
      />
    </div>
  )
}
