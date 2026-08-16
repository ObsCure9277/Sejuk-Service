import { useEffect, useMemo, useState } from 'react'
import { isCompletedStatus, orderStatuses, STATUS } from './orderStatus.js'
import { buildManagerKpiDashboard } from './managerKpiDashboard.js'
import { answerOperationsQuery } from './operationsQueryAssistant.js'
import {
  completeOrder,
  previewFinalAmount,
} from './orderWorkflow.js'
import { getWorkflowAlerts } from './workflowSupervisor.js'
import { createOrderRepository } from './orderRepository.js'
import { createSessionRepository } from './sessionRepository.js'
import { createTechnicianRepository } from './technicianRepository.js'
import { createSupabaseClient } from './supabaseClient.js'
import {
  ROLE,
  canCloseOrderForProfile,
  canCompleteOrderForProfile,
  canReadOrderForProfile,
  canReviewOrderForProfile,
  getProfileTechnicianScope,
} from './roleAccess.js'
import './App.css'

const serviceTypes = [
  'Aircond cleaning',
  'Repair',
  'Gas refill',
  'Installation',
  'Inspection',
]

const demoCredentials = [
  { label: 'Admin', email: 'admin@sejuk-service.test', password: 'admin' },
  { label: 'Manager', email: 'manager@sejuk-service.test', password: 'manager' },
  { label: 'Ali', email: 'technician.ali@sejuk-service.test', password: 'ali' },
  { label: 'Bala', email: 'technician.bala@sejuk-service.test', password: 'bala' },
  { label: 'John', email: 'technician.john@sejuk-service.test', password: 'john' },
  { label: 'Yusoff', email: 'technician.yusoff@sejuk-service.test', password: 'yusoff' },
]

function buildInitialOrderForm(assignedTechnicianId = '') {
  return {
    customerName: '',
    phone: '',
    address: '',
    problem: '',
    serviceType: serviceTypes[0],
    quotedPrice: '',
    assignedTechnicianId,
    adminNotes: '',
  }
}
const initialCompletionForm = {
  workDone: '',
  extraCharges: '0',
  remarks: '',
  attachments: [],
  paymentReceived: false,
  paymentAmount: '',
  paymentMethod: 'Cash',
  receiptFile: null,
}

const supabase = createSupabaseClient()

const roleViews = {
  [ROLE.ADMIN]: {
    title: 'Order desk',
    description: 'Create orders, assign technician teams, and track live work.',
  },
  [ROLE.TECHNICIAN]: {
    title: 'Field jobs',
    description: 'Review assigned work and prepare service completion records.',
  },
  [ROLE.MANAGER]: {
    title: 'Review board',
    description: 'Inspect completed work and monitor service performance.',
  },
}

function getTechnicianName(technicians, technicianId) {
  return (
    technicians.find((technician) => technician.id === technicianId)?.name ??
    technicianId ??
    'Unassigned'
  )
}

function getStatusTone(status) {
  if (status === STATUS.JOB_DONE) return 'done'
  if (status === STATUS.REVIEWED || status === STATUS.CLOSED) return 'reviewed'
  if (status === STATUS.IN_PROGRESS) return 'active'
  return 'queued'
}

function validateOrderForm(form) {
  const errors = {}
  const requiredFields = [
    ['customerName', 'Enter customer name.'],
    ['phone', 'Enter phone number.'],
    ['address', 'Enter service address.'],
    ['problem', 'Describe the problem.'],
  ]

  requiredFields.forEach(([field, message]) => {
    if (!form[field].trim()) errors[field] = message
  })

  if (!form.serviceType) errors.serviceType = 'Choose service type.'
  if (!form.assignedTechnicianId) {
    errors.assignedTechnicianId = 'Assign a technician.'
  }

  const quotedPrice = Number(form.quotedPrice)
  if (!form.quotedPrice) {
    errors.quotedPrice = 'Enter quoted price.'
  } else if (Number.isNaN(quotedPrice) || quotedPrice <= 0) {
    errors.quotedPrice = 'Quoted price must be more than 0.'
  }

  return errors
}

function validateCompletionForm(form) {
  const errors = {}
  const extraCharges = Number(form.extraCharges || 0)

  if (!form.workDone.trim()) errors.workDone = 'Enter work done.'
  if (Number.isNaN(extraCharges) || extraCharges < 0) {
    errors.extraCharges = 'Extra charges must be 0 or more.'
  }
  if (form.attachments.length > 6) {
    errors.attachments = 'Upload up to 6 supporting files.'
  }
  if (form.paymentReceived) {
    const paymentAmount = Number(form.paymentAmount)
    if (!form.paymentAmount) {
      errors.paymentAmount = 'Enter payment amount.'
    } else if (Number.isNaN(paymentAmount) || paymentAmount <= 0) {
      errors.paymentAmount = 'Payment amount must be more than 0.'
    }
    if (!form.paymentMethod) errors.paymentMethod = 'Choose payment method.'
  }

  return errors
}

function App() {
  if (!supabase) {
    return (
      <SupabaseSetupPanel />
    )
  }

  return <OperationsApp supabase={supabase} />
}

function OperationsApp({ supabase }) {
  const [activeProfile, setActiveProfile] = useState(null)
  const [sessionLabel, setSessionLabel] = useState('Checking Supabase profile')
  const [authForm, setAuthForm] = useState({ email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [dataError, setDataError] = useState('')
  const [orders, setOrders] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('')
  const [submittedOrder, setSubmittedOrder] = useState(null)
  const orderRepository = useMemo(() => createOrderRepository(supabase), [supabase])
  const sessionRepository = useMemo(() => createSessionRepository(supabase), [supabase])
  const technicianRepository = useMemo(
    () => createTechnicianRepository(supabase),
    [supabase],
  )
  const activeRole = activeProfile?.role ?? null
  const activeView = activeRole
    ? roleViews[activeRole]
    : {
        description: 'Admin, Technician, or Manager profile required to access this workspace.',
        title: 'Sign In',
      }
  const technicianScope = getProfileTechnicianScope(activeProfile)
  const activeTechnicianId = technicianScope ?? selectedTechnicianId
  const assignedJobs = orders.filter((order) =>
    canReadOrderForProfile(activeProfile, order) &&
    order.assignedTechnicianId === activeTechnicianId,
  )
  const completedJobs = orders.filter((order) =>
    isCompletedStatus(order.status),
  )
  const managerKpis = useMemo(
    () => buildManagerKpiDashboard(orders, technicians),
    [orders, technicians],
  )
  useEffect(() => {
    let ignore = false

    sessionRepository
      .getCurrentProfile()
      .then((profile) => {
        if (ignore) return

        if (!profile) {
          setSessionLabel('No Supabase profile')
          return
        }

        setActiveProfile(profile)
        setSessionLabel(profile.displayName)
        if (profile.technicianId) setSelectedTechnicianId(profile.technicianId)
      })
      .catch(() => {
        if (!ignore) setSessionLabel('')
      })

    return () => {
      ignore = true
    }
  }, [sessionRepository])

  useEffect(() => {
    if (!activeProfile) return undefined

    let ignore = false

    orderRepository
      .listOrders()
      .then((loadedOrders) => {
        if (ignore) return

        setOrders(loadedOrders)
        setDataError('')
      })
      .catch((error) => {
        if (!ignore) setDataError(error.message ?? 'Unable to load orders.')
      })

    return () => {
      ignore = true
    }
  }, [activeProfile, orderRepository])


  useEffect(() => {
    if (!activeProfile) return undefined

    let ignore = false

    technicianRepository
      .listTechnicians()
      .then((loadedTechnicians) => {
        if (ignore) return

        setTechnicians(loadedTechnicians)
        if (!technicianScope && loadedTechnicians.length > 0) {
          setSelectedTechnicianId((currentTechnicianId) =>
            currentTechnicianId || loadedTechnicians[0].id,
          )
        }
        setDataError('')
      })
      .catch((error) => {
        if (!ignore) setDataError(error.message ?? 'Unable to load technicians.')
      })

    return () => {
      ignore = true
    }
  }, [activeProfile, technicianRepository, technicianScope])
  async function refreshOrders() {
    const loadedOrders = await orderRepository.listOrders()
    setOrders(loadedOrders)
    setDataError('')

    return loadedOrders
  }

  const metrics = useMemo(() => {
    const completedOrderCount = completedJobs.length
    const weeklyAmount = completedJobs.reduce(
      (total, order) => total + (order.finalAmount ?? order.quotedPrice),
      0,
    )
    const evidenceCount = completedJobs.filter(
      (order) => order.attachments > 0,
    ).length

    return [
      { label: 'Open orders', value: orders.length },
      { label: 'Completed jobs', value: completedOrderCount },
      { label: 'Weekly amount', value: `RM ${weeklyAmount.toLocaleString()}` },
      {
        label: 'With evidence',
        value: `${evidenceCount}/${completedOrderCount}`,
      },
    ]
  }, [completedJobs, orders.length])


  async function signIn(event) {
    event.preventDefault()
    if (!sessionRepository) return

    setAuthError('')
    setSessionLabel('Signing in')

    try {
      const profile = await sessionRepository.signInWithPassword(authForm)

      if (!profile) {
        setActiveProfile(null)
        setSessionLabel('No Supabase profile')
        return
      }

      setActiveProfile(profile)
      setSessionLabel(profile.displayName)
      if (profile.technicianId) setSelectedTechnicianId(profile.technicianId)
    } catch (error) {
      setActiveProfile(null)
      setAuthError(error.message ?? 'Unable to sign in.')
      setSessionLabel('Sign in required')
    }
  }

  async function signOut() {
    if (!sessionRepository) return

    await sessionRepository.signOut()
    setActiveProfile(null)
    setOrders([])
    setSubmittedOrder(null)
    setSessionLabel('Sign in required')
  }

  async function createOrder(form) {
    try {
      const createdOrder = await orderRepository.createOrder({
        assignedTechnicianName: getTechnicianName(technicians, form.assignedTechnicianId),
        form,
      })
      const loadedOrders = await refreshOrders()
      setSubmittedOrder(
        loadedOrders.find((order) => order.databaseId === createdOrder.id) ?? null,
      )
    } catch (error) {
      setDataError(error.message ?? 'Unable to create order.')
      return false
    }

    return true
  }

  async function completeJob(orderId, form) {
    const order = orders.find((currentOrder) => currentOrder.id === orderId)
    if (!order) return { error: 'Order is no longer available.' }

    if (!canCompleteOrderForProfile(activeProfile, order)) {
      return { error: 'This profile cannot complete this order.' }
    }

    const technicianName = getTechnicianName(technicians, order.assignedTechnicianId)

    try {
      await orderRepository.completeOrder({ form, order, technicianName })
      await refreshOrders()
      return {
        notification: completeOrder({ form, order, technicianName }).whatsAppNotification,
      }
    } catch (error) {
      const message = error.message ?? 'Unable to complete order.'
      setDataError(message)
      return { error: message }
    }
  }

  async function reviewJob(orderId) {
    const order = orders.find((currentOrder) => currentOrder.id === orderId)
    if (!order) return { error: 'Order is no longer available.' }

    if (!canReviewOrderForProfile(activeProfile, order)) {
      return { error: 'This profile cannot review this order.' }
    }

    try {
      await orderRepository.reviewOrder({ order })
      await refreshOrders()
      return { error: '' }
    } catch (error) {
      const message = error.message ?? 'Unable to review order.'
      setDataError(message)
      return { error: message }
    }
  }

  async function closeJob(orderId) {
    const order = orders.find((currentOrder) => currentOrder.id === orderId)
    if (!order) return { error: 'Order is no longer available.' }

    if (!canCloseOrderForProfile(activeProfile, order)) {
      return { error: 'This profile cannot close this order.' }
    }

    try {
      await orderRepository.closeOrder({ order })
      await refreshOrders()
      return { error: '' }
    } catch (error) {
      const message = error.message ?? 'Unable to close order.'
      setDataError(message)
      return { error: message }
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Operations navigation">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          <div>
            <p className="eyebrow">Sejuk Service</p>
            <h1>Operations</h1>
          </div>
        </div>


        <section className="status-rail" aria-label="Workflow states">
          <p className="section-label">Workflow</p>
          <ol>
            {orderStatuses.map((status) => (
              <li key={status}>{status}</li>
            ))}
          </ol>
        </section>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">
              {activeRole ? activeRole + ' portal - ' + sessionLabel : sessionLabel}
            </p>
            <h2>{activeView.title}</h2>
            <p>{activeView.description}</p>
          </div>
          {activeProfile && (
            <button className="secondary-action" onClick={signOut} type="button">
              Sign out
            </button>
          )}
        </header>

        {dataError && <p className="form-error">{dataError}</p>}

        {activeProfile && (
          <section className="metrics-grid" aria-label="Operations summary">
            {metrics.map((metric) => (
              <article className="metric" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </article>
            ))}
          </section>
        )}

        <section className="role-panel">
          {!activeProfile && (
            <SupabaseLoginPanel
              authError={authError}
              form={authForm}
              onChange={setAuthForm}
              onSignIn={signIn}
            />
          )}
          {activeProfile && activeRole === ROLE.ADMIN && (
            <AdminOverview
              onCreateOrder={createOrder}
              orders={orders}
              submittedOrder={submittedOrder}
              technicians={technicians}
            />
          )}
          {activeProfile && activeRole === ROLE.TECHNICIAN && (
            <TechnicianOverview
              activeProfile={activeProfile}
              jobs={assignedJobs}
              onCompleteJob={completeJob}
              selectedTechnicianId={activeTechnicianId}
              setSelectedTechnicianId={setSelectedTechnicianId}
              technicians={technicians}
            />
          )}
          {activeProfile && activeRole === ROLE.MANAGER && (
            <ManagerOverview
              activeProfile={activeProfile}
              completedJobs={completedJobs}
              managerKpis={managerKpis}
              onCloseJob={closeJob}
              onReviewJob={reviewJob}
              technicians={technicians}
            />
          )}
        </section>
      </section>
    </main>
  )
}


function SupabaseSetupPanel() {
  return (
    <main className="app-shell setup-shell">
      <section className="workspace">
        <section className="panel" aria-label="Supabase setup required">
          <PanelHeader
            eyebrow="Supabase required"
            title="Connect Supabase to use Sejuk Service"
            description="Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart the dev server. Runtime data is loaded only from Supabase."
          />
        </section>
      </section>
    </main>
  )
}


function DemoCredentialsList() {
  const [copiedKey, setCopiedKey] = useState('')

  async function copyCredential(value, key) {
    try {
      await copyTextToClipboard(value)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey(''), 1400)
    } catch {
      setCopiedKey('')
    }
  }

  return (
    <section className="demo-credentials" aria-label="Demo login credentials">
      <div className="demo-credentials-header">
        <p className="section-label">Demo accounts</p>
        <span>Email and password</span>
      </div>
      <ul>
        {demoCredentials.map((credential) => (
          <li key={credential.email}>
            <span className="demo-role">{credential.label}</span>
            <CopyableCodeBlock
              copied={copiedKey === `${credential.email}-email`}
              label={`${credential.label} email`}
              onCopy={() => copyCredential(credential.email, `${credential.email}-email`)}
              value={credential.email}
            />
            <CopyableCodeBlock
              copied={copiedKey === `${credential.email}-password`}
              label={`${credential.label} password`}
              onCopy={() => copyCredential(credential.password, `${credential.email}-password`)}
              value={credential.password}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

function CopyableCodeBlock({ copied, label, onCopy, value }) {
  return (
    <div className="copy-code-block">
      <pre><code>{value}</code></pre>
      <button aria-label={`Copy ${label}`} onClick={onCopy} type="button">
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

async function copyTextToClipboard(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = value
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()
  document.execCommand('copy')
  document.body.removeChild(textArea)
}

function SupabaseLoginPanel({ authError, form, onChange, onSignIn }) {
  function updateField(field, value) {
    onChange({ ...form, [field]: value })
  }

  return (
    <section className="panel" aria-label="Supabase sign in">
      <form className="order-form" noValidate onSubmit={onSignIn}>
        <div className="form-grid">
          <Field label="Email" name="authEmail">
            <input
              autoComplete="email"
              id="authEmail"
              name="authEmail"
              onChange={(event) => updateField('email', event.target.value)}
              type="email"
              value={form.email}
            />
          </Field>
          <Field label="Password" name="authPassword">
            <input
              autoComplete="current-password"
              id="authPassword"
              name="authPassword"
              onChange={(event) => updateField('password', event.target.value)}
              type="password"
              value={form.password}
            />
          </Field>
        </div>
        {authError && <p className="form-error">{authError}</p>}
        <button className="primary-action" type="submit">
          Sign in
        </button>
      </form>
      <DemoCredentialsList />
    </section>
  )
}

function AdminOverview({ onCreateOrder, orders, submittedOrder, technicians }) {
  return (
    <>
      <AdminOrderForm
        onCreateOrder={onCreateOrder}
        orders={orders}
        technicians={technicians}
      />
      {submittedOrder && (
        <OrderSummary order={submittedOrder} technicians={technicians} />
      )}
      <PanelHeader
        eyebrow="Dispatch queue"
        title="Current orders"
        description="Submitted orders appear here immediately with the assigned technician."
      />
      <OrderList orders={orders} technicians={technicians} />
    </>
  )
}

function AdminOrderForm({ onCreateOrder, technicians }) {
  const [form, setForm] = useState(() => buildInitialOrderForm())
  const [errors, setErrors] = useState({})


  function updateField(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const submissionForm = {
      ...form,
      assignedTechnicianId: form.assignedTechnicianId || technicians[0]?.id || '',
    }
    const nextErrors = validateOrderForm(submissionForm)

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    const wasCreated = await onCreateOrder(submissionForm)
    if (!wasCreated) return

    setForm(buildInitialOrderForm(technicians[0]?.id ?? ''))
    setErrors({})
  }

  return (
    <form className="order-form" noValidate onSubmit={handleSubmit}>
      <div className="form-header">
        <div>
          <p className="eyebrow">New service order</p>
          <h3>Submit and assign</h3>
          <p>Order number will be generated by Supabase.</p>
        </div>
        <span className="status-pill queued">Assigned on submit</span>
      </div>

      <div className="form-grid">
        <Field
          error={errors.customerName}
          label="Customer name"
          name="customerName"
        >
          <input
            id="customerName"
            onChange={(event) => updateField('customerName', event.target.value)}
            value={form.customerName}
          />
        </Field>

        <Field error={errors.phone} label="Phone" name="phone">
          <input
            id="phone"
            onChange={(event) => updateField('phone', event.target.value)}
            value={form.phone}
          />
        </Field>

        <Field error={errors.address} label="Address" name="address" wide>
          <textarea
            id="address"
            onChange={(event) => updateField('address', event.target.value)}
            rows="2"
            value={form.address}
          />
        </Field>

        <Field
          error={errors.problem}
          label="Problem description"
          name="problem"
          wide
        >
          <textarea
            id="problem"
            onChange={(event) => updateField('problem', event.target.value)}
            rows="3"
            value={form.problem}
          />
        </Field>

        <Field error={errors.serviceType} label="Service type" name="serviceType">
          <select
            id="serviceType"
            onChange={(event) => updateField('serviceType', event.target.value)}
            value={form.serviceType}
          >
            {serviceTypes.map((serviceType) => (
              <option key={serviceType} value={serviceType}>
                {serviceType}
              </option>
            ))}
          </select>
        </Field>

        <Field error={errors.quotedPrice} label="Quoted price" name="quotedPrice">
          <input
            id="quotedPrice"
            min="0"
            onChange={(event) => updateField('quotedPrice', event.target.value)}
            type="number"
            value={form.quotedPrice}
          />
        </Field>

        <Field
          error={errors.assignedTechnicianId}
          label="Assigned technician"
          name="assignedTechnicianId"
        >
          <select
            id="assignedTechnicianId"
            onChange={(event) =>
              updateField('assignedTechnicianId', event.target.value)
            }
            value={form.assignedTechnicianId || technicians[0]?.id || ''}
          >
            <option value="">Select technician</option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.name} - {technician.branch}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Admin notes" name="adminNotes" wide>
          <textarea
            id="adminNotes"
            onChange={(event) => updateField('adminNotes', event.target.value)}
            rows="2"
            value={form.adminNotes}
          />
        </Field>
      </div>

      <div className="form-actions">
        <button
          className="primary-action"
          disabled={technicians.length === 0}
          type="submit"
        >
          Submit order
        </button>
      </div>
    </form>
  )
}

function Field({ children, error, label, name, wide = false }) {
  return (
    <div className={wide ? 'field wide' : 'field'}>
      <label htmlFor={name}>{label}</label>
      {children}
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

function OrderSummary({ order, technicians }) {
  return (
    <section className="submission-summary" aria-label="Submitted order summary">
      <div>
        <p className="eyebrow">Order submitted</p>
        <h3>{order.id}</h3>
        <p>
          {order.customerName} assigned to{' '}
          {getTechnicianName(technicians, order.assignedTechnicianId)}.
        </p>
      </div>
      <dl>
        <div>
          <dt>Service</dt>
          <dd>{order.serviceType}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{order.status}</dd>
        </div>
        <div>
          <dt>Quoted</dt>
          <dd>RM {order.quotedPrice}</dd>
        </div>
      </dl>
    </section>
  )
}

function TechnicianOverview({
  activeProfile,
  jobs,
  onCompleteJob,
  selectedTechnicianId,
  technicians,
}) {
  return (
    <>
      <div className="panel-header split">
        <div>
          <p className="eyebrow">Assigned technician</p>
          <h3>{getTechnicianName(technicians, selectedTechnicianId)}</h3>
          <p>Supabase profile scope controls assigned jobs.</p>
        </div>
      </div>
      <div className="field-job-list">
        {jobs.length === 0 ? (
          <p className="empty-state">No jobs assigned.</p>
        ) : (
          jobs.map((job) => (
            <TechnicianJobCard
              activeProfile={activeProfile}
              job={job}
              key={job.id}
              onCompleteJob={onCompleteJob}
              technicians={technicians}
            />
          ))
        )}
      </div>
    </>
  )
}

function TechnicianJobCard({ activeProfile, job, onCompleteJob, technicians }) {
  const [form, setForm] = useState(initialCompletionForm)
  const [actionError, setActionError] = useState('')
  const [errors, setErrors] = useState({})
  const [whatsAppNotification, setWhatsAppNotification] = useState(job.whatsAppNotification)
  const isDone = isCompletedStatus(job.status)
  const canComplete = canCompleteOrderForProfile(activeProfile, job)
  const previewAmount = previewFinalAmount({ form, order: job })


  function updateField(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }))
  }

  function updateAttachments(files) {
    const nextFiles = Array.from(files)
    setForm((currentForm) => ({ ...currentForm, attachments: nextFiles }))
    setErrors((currentErrors) => ({
      ...currentErrors,
      attachments:
        nextFiles.length > 6 ? 'Upload up to 6 supporting files.' : undefined,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateCompletionForm(form)

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setActionError('')
    const result = await onCompleteJob(job.id, form)
    if (result?.error) {
      setActionError(result.error)
      return
    }

    setWhatsAppNotification(result?.notification ?? null)
    setForm(initialCompletionForm)
    setErrors({})
  }

  return (
    <article className="field-job-card">
      <div className="order-summary">
        <div>
          <p className="eyebrow">{job.id}</p>
          <h4>{job.customerName}</h4>
          <p>{job.address}</p>
        </div>
        <span className={`status-pill ${getStatusTone(job.status)}`}>
          {job.status}
        </span>
      </div>

      <dl className="order-details technician-details">
        <div>
          <dt>Service</dt>
          <dd>{job.serviceType}</dd>
        </div>
        <div>
          <dt>Quoted</dt>
          <dd>RM {job.quotedPrice}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{job.phone}</dd>
        </div>
        <div>
          <dt>Technician</dt>
          <dd>{getTechnicianName(technicians, job.assignedTechnicianId)}</dd>
        </div>
      </dl>

      <section className="job-brief" aria-label={`${job.id} service brief`}>
        <p className="section-label">Reported problem</p>
        <p>{job.problem}</p>
        {job.adminNotes && <p>Admin notes: {job.adminNotes}</p>}
      </section>

      {isDone ? (
        <CompletedJobSummary job={job} whatsAppNotification={whatsAppNotification} />
      ) : !canComplete ? (
        <p className="action-error">This Supabase profile cannot complete this order.</p>
      ) : (
        <form className="completion-form" noValidate onSubmit={handleSubmit}>
          <Field
            error={errors.workDone}
            label="Work done"
            name={`${job.id}-workDone`}
          >
            <textarea
              id={`${job.id}-workDone`}
              onChange={(event) => updateField('workDone', event.target.value)}
              rows="3"
              value={form.workDone}
            />
          </Field>

          <div className="form-grid compact">
            <Field
              error={errors.extraCharges}
              label="Extra charges"
              name={`${job.id}-extraCharges`}
            >
              <input
                id={`${job.id}-extraCharges`}
                min="0"
                onChange={(event) =>
                  updateField('extraCharges', event.target.value)
                }
                type="number"
                value={form.extraCharges}
              />
            </Field>

            <div className="calculated-total">
              <span>Final amount</span>
              <strong>RM {previewAmount.toLocaleString()}</strong>
            </div>
          </div>

          <Field
            error={errors.attachments}
            label="Supporting uploads"
            name={`${job.id}-attachments`}
          >
            <input
              accept="image/*,video/*,.pdf"
              id={`${job.id}-attachments`}
              multiple
              onChange={(event) => updateAttachments(event.target.files)}
              type="file"
            />
          </Field>

          <Field label="Remarks" name={`${job.id}-remarks`}>
            <textarea
              id={`${job.id}-remarks`}
              onChange={(event) => updateField('remarks', event.target.value)}
              rows="2"
              value={form.remarks}
            />
          </Field>

          <label className="checkbox-field">
            <input
              checked={form.paymentReceived}
              onChange={(event) =>
                updateField('paymentReceived', event.target.checked)
              }
              type="checkbox"
            />
            Payment received from customer
          </label>

          {form.paymentReceived && (
            <div className="payment-fields">
              <Field
                error={errors.paymentAmount}
                label="Payment amount"
                name={`${job.id}-paymentAmount`}
              >
                <input
                  id={`${job.id}-paymentAmount`}
                  min="0"
                  onChange={(event) =>
                    updateField('paymentAmount', event.target.value)
                  }
                  type="number"
                  value={form.paymentAmount}
                />
              </Field>

              <Field
                error={errors.paymentMethod}
                label="Payment method"
                name={`${job.id}-paymentMethod`}
              >
                <select
                  id={`${job.id}-paymentMethod`}
                  onChange={(event) =>
                    updateField('paymentMethod', event.target.value)
                  }
                  value={form.paymentMethod}
                >
                  <option>Cash</option>
                  <option>Bank transfer</option>
                  <option>Card</option>
                  <option>E-wallet</option>
                </select>
              </Field>

              <Field label="Receipt photo" name={`${job.id}-receiptFile`}>
                <input
                  accept="image/*,.pdf"
                  id={`${job.id}-receiptFile`}
                  onChange={(event) =>
                    updateField('receiptFile', event.target.files[0] ?? null)
                  }
                  type="file"
                />
              </Field>
            </div>
          )}

          {actionError && <p className="action-error">{actionError}</p>}
          <button className="primary-action large-action" type="submit">
            Mark Job Done
          </button>
        </form>
      )}
    </article>
  )
}

function CompletedJobSummary({ job, whatsAppNotification }) {
  return (
    <section className="completion-summary" aria-label={`${job.id} completion`}>
      <div>
        <p className="section-label">Completion</p>
        <p>{job.completion?.workDone ?? 'Completion details recorded.'}</p>
        {job.completion?.remarks && <p>Remarks: {job.completion.remarks}</p>}
      </div>

      <dl className="order-details technician-details">
        <div>
          <dt>Completed at</dt>
          <dd>{job.completedAt}</dd>
        </div>
        <div>
          <dt>Final amount</dt>
          <dd>RM {(job.finalAmount ?? job.quotedPrice).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>{job.attachments} files</dd>
        </div>
        <div>
          <dt>Payment</dt>
          <dd>
            {job.payment?.received
              ? `RM ${job.payment.amount} via ${job.payment.method}`
              : 'Not recorded'}
          </dd>
        </div>
      </dl>

      {whatsAppNotification && (
        <div className="whatsapp-preview">
          <div>
            <p className="section-label">WhatsApp trigger</p>
            <p>
              Ready for {whatsAppNotification.recipientName} at{' '}
              {whatsAppNotification.recipientPhone} when status reached{' '}
              {whatsAppNotification.triggerStatus}.
            </p>
          </div>
          <pre>{whatsAppNotification.message}</pre>
          <a
            className="whatsapp-link"
            href={whatsAppNotification.url}
            rel="noreferrer"
            target="_blank"
          >
            Open WhatsApp message
          </a>
        </div>
      )}
    </section>
  )
}

function ManagerOverview({
  activeProfile,
  completedJobs,
  managerKpis,
  onCloseJob,
  onReviewJob,
  technicians,
}) {
  const workflowAlerts = getWorkflowAlerts(completedJobs, technicians)
  const jobsAwaitingReview = completedJobs.filter(
    (order) => order.status === STATUS.JOB_DONE,
  ).length

  return (
    <>
      <ManagerKpiDashboard dashboard={managerKpis} />
      <OperationsQueryWindow orders={completedJobs} technicians={technicians} />
      <PanelHeader
        eyebrow="Review queue"
        title={`${jobsAwaitingReview} jobs awaiting review`}
        description="Job Done orders need action; Reviewed and Closed records remain visible for traceability."
      />
      <WorkflowAlerts alerts={workflowAlerts} />
      <OrderList
        activeProfile={activeProfile}
        emptyMessage="No completed jobs yet."
        onCloseJob={onCloseJob}
        onReviewJob={onReviewJob}
        orders={completedJobs}
        showReviewAction
        technicians={technicians}
      />
    </>
  )
}

const exampleOperationsQuestions = [
  'Which technician completed the most jobs this week?',
  'How many jobs were completed today?',
]

function OperationsQueryWindow({ orders, technicians }) {
  const [question, setQuestion] = useState(exampleOperationsQuestions[0])
  const answer = useMemo(
    () =>
      answerOperationsQuery({
        orders,
        question,
        technicians,
      }),
    [orders, question, technicians],
  )

  function submitQuery(event) {
    event.preventDefault()
  }

  function askExample(exampleQuestion) {
    setQuestion(exampleQuestion)
  }

  return (
    <section className="operations-query-window" aria-label="Operations query window">
      <PanelHeader
        eyebrow="AI assistant"
        title="Operations query window"
        description="Ask operational questions about completed service jobs."
      />
      <form className="query-form" onSubmit={submitQuery}>
        <label htmlFor="operations-query">Manager question</label>
        <div className="query-input-row">
          <input
            id="operations-query"
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about technician jobs, weekly leaders, or completed jobs today"
            type="text"
            value={question}
          />
          <button
            className="primary-action"
            disabled={technicians.length === 0}
            type="submit"
          >
            Ask
          </button>
        </div>
      </form>
      <div className="query-examples" aria-label="Example operations questions">
        {exampleOperationsQuestions.map((exampleQuestion) => (
          <button
            className="secondary-action"
            key={exampleQuestion}
            onClick={() => askExample(exampleQuestion)}
            type="button"
          >
            {exampleQuestion}
          </button>
        ))}
      </div>
      <article className="query-answer" aria-live="polite">
        <h4>{answer.title}</h4>
        <p>{answer.summary}</p>
        {answer.items.length > 0 && (
          <ul>
            {answer.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </article>
    </section>
  )
}
function ManagerKpiDashboard({ dashboard }) {
  return (
    <section className="manager-kpi-dashboard" aria-label="Manager KPI dashboard">
      <PanelHeader
        eyebrow="Weekly KPIs"
        title="Technician performance"
        description={`Completed, Reviewed, and Closed jobs from ${dashboard.periodLabel}.`}
      />
      {dashboard.rows.length === 0 ? (
        <p className="empty-state">No completed jobs for the KPI period.</p>
      ) : (
        <>
          <div className="kpi-totals">
            <div>
              <span>Total jobs</span>
              <strong>{dashboard.totalJobs}</strong>
            </div>
            <div>
              <span>Total billed</span>
              <strong>RM {dashboard.totalBilled.toLocaleString()}</strong>
            </div>
          </div>
          <div className="technician-leaderboard">
            {dashboard.rows.map((row, index) => (
              <article className="leaderboard-row" key={row.technicianId}>
                <div className="leaderboard-rank">#{index + 1}</div>
                <div className="leaderboard-main">
                  <div>
                    <h4>{row.technicianName}</h4>
                    <p>{row.branch}</p>
                    <span className="bar-label">Job volume vs top technician</span>
                  </div>
                  <div
                    aria-label={`${row.technicianName} job volume ${row.jobShare}% of the top technician`}
                    className="leaderboard-bar"
                    role="img"
                  >
                    <span style={{ width: `${row.jobShare}%` }} />
                  </div>
                </div>
                <dl className="leaderboard-stats">
                  <div>
                    <dt>Jobs</dt>
                    <dd>{row.jobsCompleted}</dd>
                  </div>
                  <div>
                    <dt>Billed</dt>
                    <dd>RM {row.billedAmount.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Awaiting review</dt>
                    <dd>{row.awaitingReview}</dd>
                  </div>
                  <div>
                    <dt>Evidence</dt>
                    <dd>{row.evidenceRate}%</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function WorkflowAlerts({ alerts }) {
  return (
    <section className="workflow-alerts" aria-label="AI workflow supervisor alerts">
      <PanelHeader
        eyebrow="Local supervisor"
        title="Operational flags"
        description="Deterministic checks flag completed jobs that may need manager attention."
      />
      {alerts.length === 0 ? (
        <p className="empty-state">No workflow alerts right now.</p>
      ) : (
        <div className="alert-list">
          {alerts.map((alert) => (
            <article className="alert-item" key={alert.id}>
              <div>
                <span className={`alert-severity ${alert.severity.id}`}>
                  {alert.severity.label}
                </span>
                <h4>{alert.title}</h4>
                <p>{alert.detail}</p>
              </div>
              <dl>
                <div>
                  <dt>Order</dt>
                  <dd>{alert.orderId}</dd>
                </div>
                <div>
                  <dt>Technician</dt>
                  <dd>{alert.technicianName}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
function PanelHeader({ eyebrow, title, description }) {
  return (
    <div className="panel-header">
      <p className="eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}

function OrderList({
  activeProfile,
  emptyMessage = 'No orders available.',
  onCloseJob,
  onReviewJob,
  orders,
  showReviewAction = false,
  technicians,
}) {
  const [actionErrors, setActionErrors] = useState({})

  if (orders.length === 0) {
    return <p className="empty-state">{emptyMessage}</p>
  }

  async function handleReview(orderId) {
    setActionErrors((currentErrors) => ({ ...currentErrors, [orderId]: '' }))
    const result = await onReviewJob(orderId)
    if (result?.error) {
      setActionErrors((currentErrors) => ({
        ...currentErrors,
        [orderId]: result.error,
      }))
    }
  }

  async function handleClose(orderId) {
    setActionErrors((currentErrors) => ({ ...currentErrors, [orderId]: '' }))
    const result = await onCloseJob(orderId)
    if (result?.error) {
      setActionErrors((currentErrors) => ({
        ...currentErrors,
        [orderId]: result.error,
      }))
    }
  }

  return (
    <div className="order-list">
      {orders.map((order) => {
        const latestAction = order.history.at(-1)
        const actionError = actionErrors[order.id]

        return (
          <article className="order-card" key={order.id}>
            <div className="order-summary">
              <div>
                <p className="eyebrow">{order.id}</p>
                <h4>{order.customerName}</h4>
                <p>{order.problem}</p>
              </div>
              <span className={`status-pill ${getStatusTone(order.status)}`}>
                {order.status}
              </span>
            </div>

            <dl className="order-details">
              <div>
                <dt>Service</dt>
                <dd>{order.serviceType}</dd>
              </div>
              <div>
                <dt>Technician</dt>
                <dd>{getTechnicianName(technicians, order.assignedTechnicianId)}</dd>
              </div>
              <div>
                <dt>Quoted</dt>
                <dd>RM {order.quotedPrice}</dd>
              </div>
              <div>
                <dt>Final</dt>
                <dd>RM {(order.finalAmount ?? order.quotedPrice).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>{order.attachments} files</dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>
                  {order.payment?.received
                    ? `RM ${order.payment.amount} via ${order.payment.method}`
                    : 'Not recorded'}
                </dd>
              </div>
              <div>
                <dt>Receipt</dt>
                <dd>{order.payment?.receiptFile || 'Not uploaded'}</dd>
              </div>
            </dl>

            {showReviewAction && (
              <section className="manager-completion" aria-label={`${order.id} completion review`}>
                <div>
                  <p className="section-label">Completion</p>
                  <p>{order.completion?.workDone ?? 'Completion details recorded.'}</p>
                  {order.completion?.remarks && <p>Remarks: {order.completion.remarks}</p>}
                  <p>Completed at {order.completedAt ?? 'Not recorded'}.</p>
                </div>
                <div>
                  <p className="section-label">Attachment details</p>
                  {order.completion?.attachments?.length > 0 ? (
                    <ul>
                      {order.completion.attachments.map((attachment) => (
                        <li key={attachment}>{attachment}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No supporting files uploaded.</p>
                  )}
                </div>
              </section>
            )}

            <div className="history">
              <p className="section-label">Action history</p>
              {showReviewAction ? (
                order.history.map((entry) => (
                  <p key={`${entry.actor}-${entry.action}-${entry.at}`}>
                    <span><strong>{entry.actor}</strong> {entry.action} at {entry.at}</span>
                  </p>
                ))
              ) : (
                <p>
                  <span><strong>{latestAction.actor}</strong> {latestAction.action} at {latestAction.at}</span>
                </p>
              )}
            </div>

            {showReviewAction && (
              <div className="order-actions">
                {canReviewOrderForProfile(activeProfile, order) && (
                  <button
                    className="secondary-action"
                    onClick={() => handleReview(order.id)}
                    type="button"
                  >
                    Mark Reviewed
                  </button>
                )}
                {canCloseOrderForProfile(activeProfile, order) && (
                  <button
                    className="secondary-action"
                    onClick={() => handleClose(order.id)}
                    type="button"
                  >
                    Mark Closed
                  </button>
                )}
              </div>
            )}
            {showReviewAction && actionError && (
              <p className="action-error">{actionError}</p>
            )}
          </article>
        )
      })}
    </div>
  )
}

export default App
