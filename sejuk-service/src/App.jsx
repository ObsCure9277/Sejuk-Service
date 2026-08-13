import { useMemo, useState } from 'react'
import './App.css'

const STATUS = Object.freeze({
  NEW: 'New',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  JOB_DONE: 'Job Done',
  REVIEWED: 'Reviewed',
  CLOSED: 'Closed',
})

const orderStatuses = Object.values(STATUS)

const serviceTypes = [
  'Aircond cleaning',
  'Repair',
  'Gas refill',
  'Installation',
  'Inspection',
]

const technicians = [
  { id: 'ali', name: 'Ali', branch: 'Shah Alam', activeJobs: 2 },
  { id: 'john', name: 'John', branch: 'Petaling Jaya', activeJobs: 1 },
  { id: 'bala', name: 'Bala', branch: 'Klang', activeJobs: 3 },
  { id: 'yusoff', name: 'Yusoff', branch: 'Subang', activeJobs: 0 },
]

const initialOrders = [
  {
    id: 'ORDER1234',
    customerName: 'Ahmad',
    phone: '+6012 345 6789',
    address: 'No. 12, Jalan Sejuk, Shah Alam',
    serviceType: 'Aircond cleaning',
    problem: 'Weak airflow from living room unit',
    quotedPrice: 180,
    finalAmount: null,
    completion: null,
    payment: null,
    whatsappUrl: null,
    assignedTechnicianId: 'ali',
    adminNotes: 'Customer prefers morning visit.',
    status: STATUS.ASSIGNED,
    attachments: 0,
    completedAt: null,
    history: [
      {
        actor: 'Admin',
        action: 'Created order and assigned Ali',
        at: '13 Aug 2026, 9:00 AM',
      },
    ],
  },
  {
    id: 'ORDER1237',
    customerName: 'Siti',
    phone: '+6017 456 2211',
    address: '14, Jalan Damai, Petaling Jaya',
    serviceType: 'Repair',
    problem: 'Water leaking from cassette unit',
    quotedPrice: 260,
    finalAmount: null,
    completion: null,
    payment: null,
    whatsappUrl: null,
    assignedTechnicianId: 'john',
    adminNotes: 'Bring ladder for ceiling cassette unit.',
    status: STATUS.IN_PROGRESS,
    attachments: 0,
    completedAt: null,
    history: [
      {
        actor: 'Admin',
        action: 'Assigned John',
        at: '12 Aug 2026, 3:10 PM',
      },
      {
        actor: 'John',
        action: 'Started service',
        at: '13 Aug 2026, 10:20 AM',
      },
    ],
  },
  {
    id: 'ORDER1241',
    customerName: 'Lim Trading',
    phone: '+603 7788 1200',
    address: 'Lot 8, Jalan Industri, Klang',
    serviceType: 'Gas refill',
    problem: 'Office unit not cooling during afternoon peak',
    quotedPrice: 320,
    finalAmount: 390,
    completion: {
      workDone: 'Refilled refrigerant gas and checked pressure stability.',
      extraCharges: 70,
      remarks: 'Cooling improved after pressure test.',
      attachments: ['pressure-reading.jpg', 'outdoor-unit.jpg'],
    },
    payment: {
      received: true,
      amount: 390,
      method: 'Bank transfer',
      receiptFile: 'receipt-order1241.pdf',
    },
    whatsappUrl: null,
    assignedTechnicianId: 'bala',
    adminNotes: 'Office closes at 6 PM.',
    status: STATUS.JOB_DONE,
    attachments: 4,
    completedAt: '13 Aug 2026, 11:45 AM',
    history: [
      {
        actor: 'Admin',
        action: 'Assigned Bala',
        at: '11 Aug 2026, 4:30 PM',
      },
      {
        actor: 'Bala',
        action: 'Marked job done with 4 attachments',
        at: '13 Aug 2026, 11:45 AM',
      },
    ],
  },
  {
    id: 'ORDER1246',
    customerName: 'Nurul',
    phone: '+6019 330 1199',
    address: '7, Jalan Cempaka, Subang',
    serviceType: 'Installation',
    problem: 'New bedroom inverter unit installation',
    quotedPrice: 780,
    finalAmount: 780,
    completion: {
      workDone: 'Installed new inverter unit and tested drainage.',
      extraCharges: 0,
      remarks: 'Condo management paperwork completed.',
      attachments: ['installed-unit.jpg', 'pipework.jpg', 'receipt.jpg'],
    },
    payment: {
      received: true,
      amount: 780,
      method: 'Card',
      receiptFile: 'card-slip.jpg',
    },
    whatsappUrl: null,
    assignedTechnicianId: 'ali',
    adminNotes: 'Condo management requires visitor registration.',
    status: STATUS.REVIEWED,
    attachments: 6,
    completedAt: '9 Aug 2026, 2:15 PM',
    history: [
      {
        actor: 'Admin',
        action: 'Assigned Ali',
        at: '8 Aug 2026, 1:00 PM',
      },
      {
        actor: 'Ali',
        action: 'Marked job done with 6 attachments',
        at: '9 Aug 2026, 2:15 PM',
      },
      {
        actor: 'Manager',
        action: 'Reviewed completion record',
        at: '10 Aug 2026, 9:30 AM',
      },
    ],
  },
]

const initialOrderForm = {
  customerName: '',
  phone: '',
  address: '',
  problem: '',
  serviceType: serviceTypes[0],
  quotedPrice: '',
  assignedTechnicianId: technicians[0].id,
  adminNotes: '',
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

const roleViews = {
  Admin: {
    title: 'Order desk',
    description: 'Create orders, assign technician teams, and track live work.',
  },
  Technician: {
    title: 'Field jobs',
    description: 'Review assigned work and prepare service completion records.',
  },
  Manager: {
    title: 'Review board',
    description: 'Inspect completed work and monitor service performance.',
  },
}

function getTechnicianName(technicianId) {
  return (
    technicians.find((technician) => technician.id === technicianId)?.name ??
    'Unassigned'
  )
}

function getStatusTone(status) {
  if (status === STATUS.JOB_DONE) return 'done'
  if (status === STATUS.REVIEWED || status === STATUS.CLOSED) return 'reviewed'
  if (status === STATUS.IN_PROGRESS) return 'active'
  return 'queued'
}

function formatActionTime(date = new Date()) {
  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function calculateFinalAmount(quotedPrice, extraCharges) {
  const parsedExtraCharges = Number(extraCharges || 0)
  return quotedPrice + (Number.isNaN(parsedExtraCharges) ? 0 : parsedExtraCharges)
}

function buildWhatsAppLink(order, technicianName, completedAt) {
  const phoneNumber = order.phone.replace(/[^\d]/g, '')
  const message = [
    `Hi ${order.customerName},`,
    `Customer: ${order.customerName}.`,
    `Job ${order.id} has been completed by Technician ${technicianName} at ${completedAt}.`,
    'Please check and leave feedback.',
    'Thank you!',
  ].join('\n')

  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`
}

function recordAction(order, actor, action) {
  return {
    ...order,
    history: [
      ...order.history,
      {
        actor,
        action,
        at: formatActionTime(),
      },
    ],
  }
}

function generateOrderId(orders) {
  const highestNumber = orders.reduce((highest, order) => {
    const orderNumber = Number(order.id.replace('ORDER', ''))
    return Number.isNaN(orderNumber) ? highest : Math.max(highest, orderNumber)
  }, 1200)

  return `ORDER${highestNumber + 1}`
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
  const [activeRole, setActiveRole] = useState('Admin')
  const [orders, setOrders] = useState(initialOrders)
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('ali')
  const [submittedOrder, setSubmittedOrder] = useState(null)

  const activeView = roleViews[activeRole]
  const assignedJobs = orders.filter(
    (order) => order.assignedTechnicianId === selectedTechnicianId,
  )
  const completedJobs = orders.filter((order) =>
    [STATUS.JOB_DONE, STATUS.REVIEWED, STATUS.CLOSED].includes(order.status),
  )

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

  function createOrder(form) {
    const orderId = generateOrderId(orders)
    const technicianName = getTechnicianName(form.assignedTechnicianId)
    const newOrder = {
      id: orderId,
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      serviceType: form.serviceType,
      problem: form.problem.trim(),
      quotedPrice: Number(form.quotedPrice),
      finalAmount: null,
      completion: null,
      payment: null,
      whatsappUrl: null,
      assignedTechnicianId: form.assignedTechnicianId,
      adminNotes: form.adminNotes.trim(),
      status: STATUS.ASSIGNED,
      attachments: 0,
      completedAt: null,
      history: [
        {
          actor: 'Admin',
          action: `Created order and assigned ${technicianName}`,
          at: formatActionTime(),
        },
      ],
    }

    setOrders((currentOrders) => [newOrder, ...currentOrders])
    setSubmittedOrder(newOrder)
  }

  function moveOrderForward(orderId) {
    setOrders((currentOrders) =>
      currentOrders.map((order) => {
        if (order.id !== orderId) return order
        const currentStatusIndex = orderStatuses.indexOf(order.status)
        const nextStatus = orderStatuses[currentStatusIndex + 1] ?? order.status

        return recordAction(
          {
            ...order,
            status: nextStatus,
          },
          activeRole,
          `Moved order to ${nextStatus}`,
        )
      }),
    )
  }

  function completeJob(orderId, form) {
    const targetOrder = orders.find((order) => order.id === orderId)
    if (!targetOrder) return ''

    const technicianName = getTechnicianName(targetOrder.assignedTechnicianId)
    const completedAt = formatActionTime()
    const finalAmount = calculateFinalAmount(
      targetOrder.quotedPrice,
      form.extraCharges,
    )
    const generatedWhatsAppUrl = buildWhatsAppLink(
      targetOrder,
      technicianName,
      completedAt,
    )

    setOrders((currentOrders) =>
      currentOrders.map((order) => {
        if (order.id !== orderId) return order

        return recordAction(
          {
            ...order,
            status: STATUS.JOB_DONE,
            finalAmount,
            attachments: form.attachments.length,
            completedAt,
            completion: {
              workDone: form.workDone.trim(),
              extraCharges: Number(form.extraCharges || 0),
              remarks: form.remarks.trim(),
              attachments: form.attachments.map((file) => file.name),
            },
            payment: form.paymentReceived
              ? {
                  received: true,
                  amount: Number(form.paymentAmount),
                  method: form.paymentMethod,
                  receiptFile: form.receiptFile?.name ?? '',
                }
              : { received: false, amount: 0, method: '', receiptFile: '' },
            whatsappUrl: generatedWhatsAppUrl,
          },
          technicianName,
          `Marked job done with ${form.attachments.length} attachments`,
        )
      }),
    )

    return generatedWhatsAppUrl
  }

  function reviewJob(orderId) {
    setOrders((currentOrders) =>
      currentOrders.map((order) => {
        if (order.id !== orderId || order.status !== STATUS.JOB_DONE) {
          return order
        }

        return recordAction(
          {
            ...order,
            status: STATUS.REVIEWED,
          },
          'Manager',
          'Reviewed completion record',
        )
      }),
    )
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

        <nav className="role-switcher" aria-label="Role switcher">
          {Object.keys(roleViews).map((role) => (
            <button
              className={role === activeRole ? 'active' : ''}
              key={role}
              onClick={() => setActiveRole(role)}
              type="button"
            >
              {role}
            </button>
          ))}
        </nav>

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
            <p className="eyebrow">{activeRole} portal</p>
            <h2>{activeView.title}</h2>
            <p>{activeView.description}</p>
          </div>
          <button
            className="primary-action"
            onClick={() => moveOrderForward('ORDER1234')}
            type="button"
          >
            Advance ORDER1234
          </button>
        </header>

        <section className="metrics-grid" aria-label="Operations summary">
          {metrics.map((metric) => (
            <article className="metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </section>

        <section className="role-panel">
          {activeRole === 'Admin' && (
            <AdminOverview
              onCreateOrder={createOrder}
              orders={orders}
              submittedOrder={submittedOrder}
            />
          )}
          {activeRole === 'Technician' && (
            <TechnicianOverview
              jobs={assignedJobs}
              onCompleteJob={completeJob}
              selectedTechnicianId={selectedTechnicianId}
              setSelectedTechnicianId={setSelectedTechnicianId}
            />
          )}
          {activeRole === 'Manager' && (
            <ManagerOverview
              completedJobs={completedJobs}
              onReviewJob={reviewJob}
            />
          )}
        </section>
      </section>
    </main>
  )
}

function AdminOverview({ onCreateOrder, orders, submittedOrder }) {
  return (
    <>
      <AdminOrderForm onCreateOrder={onCreateOrder} orders={orders} />
      {submittedOrder && <OrderSummary order={submittedOrder} />}
      <PanelHeader
        eyebrow="Dispatch queue"
        title="Current orders"
        description="Submitted orders appear here immediately with the assigned technician."
      />
      <OrderList orders={orders} />
    </>
  )
}

function AdminOrderForm({ onCreateOrder, orders }) {
  const [form, setForm] = useState(initialOrderForm)
  const [errors, setErrors] = useState({})
  const nextOrderId = generateOrderId(orders)

  function updateField(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateOrderForm(form)

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    onCreateOrder(form)
    setForm(initialOrderForm)
    setErrors({})
  }

  return (
    <form className="order-form" noValidate onSubmit={handleSubmit}>
      <div className="form-header">
        <div>
          <p className="eyebrow">New service order</p>
          <h3>Submit and assign</h3>
          <p>Order number will be generated as {nextOrderId}.</p>
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
            value={form.assignedTechnicianId}
          >
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
        <button className="primary-action" type="submit">
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

function OrderSummary({ order }) {
  return (
    <section className="submission-summary" aria-label="Submitted order summary">
      <div>
        <p className="eyebrow">Order submitted</p>
        <h3>{order.id}</h3>
        <p>
          {order.customerName} assigned to{' '}
          {getTechnicianName(order.assignedTechnicianId)}.
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
  jobs,
  onCompleteJob,
  selectedTechnicianId,
  setSelectedTechnicianId,
}) {
  return (
    <>
      <div className="panel-header split">
        <div>
          <p className="eyebrow">Assigned technician</p>
          <h3>{getTechnicianName(selectedTechnicianId)}</h3>
          <p>Switch technicians to verify field-job filtering.</p>
        </div>
        <select
          aria-label="Select technician"
          onChange={(event) => setSelectedTechnicianId(event.target.value)}
          value={selectedTechnicianId}
        >
          {technicians.map((technician) => (
            <option key={technician.id} value={technician.id}>
              {technician.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field-job-list">
        {jobs.length === 0 ? (
          <p className="empty-state">No jobs assigned.</p>
        ) : (
          jobs.map((job) => (
            <TechnicianJobCard
              job={job}
              key={job.id}
              onCompleteJob={onCompleteJob}
            />
          ))
        )}
      </div>
    </>
  )
}

function TechnicianJobCard({ job, onCompleteJob }) {
  const [form, setForm] = useState(initialCompletionForm)
  const [errors, setErrors] = useState({})
  const [whatsappUrl, setWhatsappUrl] = useState(job.whatsappUrl)
  const isDone = [STATUS.JOB_DONE, STATUS.REVIEWED, STATUS.CLOSED].includes(job.status)
  const finalAmount = calculateFinalAmount(job.quotedPrice, form.extraCharges)

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

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateCompletionForm(form)

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    const generatedWhatsAppUrl = onCompleteJob(job.id, form)
    setWhatsappUrl(generatedWhatsAppUrl)
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
          <dd>{getTechnicianName(job.assignedTechnicianId)}</dd>
        </div>
      </dl>

      <section className="job-brief" aria-label={`${job.id} service brief`}>
        <p className="section-label">Reported problem</p>
        <p>{job.problem}</p>
        {job.adminNotes && <p>Admin notes: {job.adminNotes}</p>}
      </section>

      {isDone ? (
        <CompletedJobSummary job={job} whatsappUrl={whatsappUrl} />
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
              <strong>RM {finalAmount.toLocaleString()}</strong>
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

          <button className="primary-action large-action" type="submit">
            Mark Job Done
          </button>
        </form>
      )}
    </article>
  )
}

function CompletedJobSummary({ job, whatsappUrl }) {
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

      {whatsappUrl && (
        <a
          className="whatsapp-link"
          href={whatsappUrl}
          rel="noreferrer"
          target="_blank"
        >
          Open WhatsApp message
        </a>
      )}
    </section>
  )
}

function ManagerOverview({ completedJobs, onReviewJob }) {
  return (
    <>
      <PanelHeader
        eyebrow="Review queue"
        title="Completed work"
        description="Job Done, Reviewed, and Closed orders are ready for manager visibility."
      />
      <OrderList
        emptyMessage="No completed jobs yet."
        onReviewJob={onReviewJob}
        orders={completedJobs}
        showReviewAction
      />
    </>
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
  emptyMessage = 'No orders available.',
  onReviewJob,
  orders,
  showReviewAction = false,
}) {
  if (orders.length === 0) {
    return <p className="empty-state">{emptyMessage}</p>
  }

  return (
    <div className="order-list">
      {orders.map((order) => {
        const latestAction = order.history.at(-1)

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
                <dd>{getTechnicianName(order.assignedTechnicianId)}</dd>
              </div>
              <div>
                <dt>Quoted</dt>
                <dd>RM {order.quotedPrice}</dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>{order.attachments} files</dd>
              </div>
            </dl>

            <div className="history">
              <p className="section-label">Latest action</p>
              <p>
                <strong>{latestAction.actor}</strong> {latestAction.action}
              </p>
              <span>{latestAction.at}</span>
            </div>

            {showReviewAction && order.status === STATUS.JOB_DONE && (
              <button
                className="secondary-action"
                onClick={() => onReviewJob(order.id)}
                type="button"
              >
                Mark Reviewed
              </button>
            )}
          </article>
        )
      })}
    </div>
  )
}

export default App
