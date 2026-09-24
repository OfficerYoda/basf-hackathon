import { useState } from 'react'

const STEPS = [
  { title: 'Personal Information', subtitle: 'Tell us who you are and your role at BASF.' },
  { title: 'Skills Declaration', subtitle: 'List the key skills and knowledge areas you hold.' },
  { title: 'Knowledge Summary', subtitle: 'Describe critical knowledge that should be documented.' },
]

interface FormData {
  name: string
  email: string
  department: string
  lastDay: string
  skills: { name: string; rating: number; notes: string }[]
  criticalProcesses: string
  contacts: string
  documentation: string
}

const empty: FormData = {
  name: '', email: '', department: '', lastDay: '',
  skills: [{ name: '', rating: 5, notes: '' }],
  criticalProcesses: '', contacts: '', documentation: '',
}

export default function ExitInterview() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(empty)
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-[var(--color-accent-dim)] flex items-center justify-center text-3xl">
          ✅
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text)]">Interview Submitted</h2>
          <p className="text-[var(--color-muted)] mt-2 max-w-sm">
            Thank you {form.name.split(' ')[0]}. Your knowledge has been documented and will be preserved.
          </p>
        </div>
        <button
          onClick={() => { setDone(false); setStep(0); setForm(empty) }}
          className="px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          Start over
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Exit Interview</h1>
        <p className="text-sm text-[var(--color-muted)] mt-0.5">Structured knowledge documentation</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((_s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                i < step ? 'bg-[var(--color-accent)] text-[var(--color-bg)]' :
                i === step ? 'bg-[var(--color-accent-dim)] border-2 border-[var(--color-accent)] text-[var(--color-accent)]' :
                'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)]'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 transition-all ${i < step ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="rounded-[var(--radius)] bg-[var(--color-surface)] border border-[var(--color-border)] p-6 shadow-[var(--shadow-sm)]">
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-1">{STEPS[step].title}</h2>
        <p className="text-sm text-[var(--color-muted)] mb-6">{STEPS[step].subtitle}</p>

        {step === 0 && <Step1 form={form} setForm={setForm} />}
        {step === 1 && <Step2 form={form} setForm={setForm} />}
        {step === 2 && <Step3 form={form} setForm={setForm} />}

        <div className="flex justify-between mt-8 pt-4 border-t border-[var(--color-border)]">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="px-4 py-2 rounded-[var(--radius-sm)] text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-30 transition-colors"
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="px-5 py-2 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[var(--color-bg)] text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={() => setDone(true)}
              className="px-5 py-2 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[var(--color-bg)] text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Submit Interview
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-high)] border border-[var(--color-border)] text-[var(--color-text)] text-sm outline-none focus:border-[var(--color-accent)]/50 transition-colors placeholder:text-[var(--color-muted)]'

function Step1({ form, setForm }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Full Name">
        <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ada Lovelace" />
      </Field>
      <Field label="Email">
        <input className={inputCls} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="ada@example.com" />
      </Field>
      <Field label="Department">
        <input className={inputCls} value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Digitalization" />
      </Field>
      <Field label="Last Working Day">
        <input className={inputCls} type="date" value={form.lastDay} onChange={e => setForm(f => ({ ...f, lastDay: e.target.value }))} />
      </Field>
    </div>
  )
}

function Step2({ form, setForm }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  const addSkill = () => setForm(f => ({ ...f, skills: [...f.skills, { name: '', rating: 5, notes: '' }] }))
  const removeSkill = (i: number) => setForm(f => ({ ...f, skills: f.skills.filter((_, j) => j !== i) }))
  const updateSkill = (i: number, key: keyof typeof form.skills[0], val: string | number) =>
    setForm(f => ({ ...f, skills: f.skills.map((s, j) => j === i ? { ...s, [key]: val } : s) }))

  return (
    <div className="flex flex-col gap-4">
      {form.skills.map((skill, i) => (
        <div key={i} className="p-4 rounded-[var(--radius-sm)] bg-[var(--color-surface-high)] border border-[var(--color-border)] flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <input
              className={`${inputCls} flex-1`}
              value={skill.name}
              onChange={e => updateSkill(i, 'name', e.target.value)}
              placeholder="e.g. python"
            />
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-[var(--color-muted)]">Rating</span>
              <input
                type="number" min={1} max={10}
                className={`${inputCls} w-16 text-center`}
                value={skill.rating}
                onChange={e => updateSkill(i, 'rating', Number(e.target.value))}
              />
            </div>
            {form.skills.length > 1 && (
              <button onClick={() => removeSkill(i)} className="text-[var(--color-muted)] hover:text-[var(--color-red)] transition-colors text-lg leading-none">×</button>
            )}
          </div>
        </div>
      ))}
      <button
        onClick={addSkill}
        className="flex items-center gap-2 text-sm text-[var(--color-accent)] hover:opacity-80 transition-opacity"
      >
        <span className="text-lg leading-none">+</span> Add skill
      </button>
    </div>
  )
}

function Step3({ form, setForm }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  const ta = `${inputCls} resize-none`
  return (
    <div className="flex flex-col gap-4">
      <Field label="Critical Processes">
        <textarea
          className={ta} rows={3} value={form.criticalProcesses}
          onChange={e => setForm(f => ({ ...f, criticalProcesses: e.target.value }))}
          placeholder="Describe processes only you currently handle..."
        />
      </Field>
      <Field label="Key Contacts">
        <textarea
          className={ta} rows={3} value={form.contacts}
          onChange={e => setForm(f => ({ ...f, contacts: e.target.value }))}
          placeholder="Who should be contacted for specific topics?"
        />
      </Field>
      <Field label="Documentation Notes">
        <textarea
          className={ta} rows={3} value={form.documentation}
          onChange={e => setForm(f => ({ ...f, documentation: e.target.value }))}
          placeholder="Where is existing documentation? What needs to be created?"
        />
      </Field>
    </div>
  )
}
