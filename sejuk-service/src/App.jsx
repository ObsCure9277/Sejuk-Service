import { useEffect, useMemo, useState } from 'react'
import { isCompletedStatus, orderStatuses, STATUS } from './orderStatus.js'
import { buildManagerKpiDashboard } from './managerKpiDashboard.js'
import { answerOperationsQuery } from './operationsQueryAssistant.js'
import {
  buildJobDoneOrderNotification,
  canCloseOrder,
  canReviewOrder,
  closeOrder,
  completeOrder,
  previewFinalAmount,
  previewNextOrderId,
  createOrder as buildOrderFromForm,
  reviewOrder,
} from './orderWorkflow.js'
import { getWorkflowAlerts } from './workflowSupervisor.js'
import { createOrderRepository } from './orderRepository.js'
import { createSessionRepository } from './sessionRepository.js'
import { createSupabaseClient } from './supabaseClient.js'
import {
  ROLE,
  canReadOrderForProfile,
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
    whatsAppNotification: null,
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
    whatsAppNotification: null,
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
    whatsAppNotification: buildJobDoneOrderNotification({
      order: {
        completedAt: '13 Aug 2026, 11:45 AM',
        customerName: 'Lim Trading',
        id: 'ORDER1241',
        phone: '+603 7788 1200',
      },
      technicianName: 'Bala',
    }),
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
    whatsAppNotification: null,
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
  {
    id: 'ORDER1249',
    customerName: 'Taman Sejuk Cafe',
    phone: '+603 5510 8822',
    address: 'G-08, Jalan Anggerik, Shah Alam',
    serviceType: 'Repair',
    problem: 'Dining area unit trips breaker after 20 minutes',
    quotedPrice: 450,
    finalAmount: 640,
    completion: {
      workDone: 'Replaced damaged capacitor and cleaned condenser coil.',
      extraCharges: 190,
      remarks: 'Extra part approved by cafe supervisor before replacement.',
      attachments: ['breaker-panel.jpg', 'new-capacitor.jpg'],
    },
    payment: {
      received: true,
      amount: 640,
      method: 'E-wallet',
      receiptFile: 'ewallet-order1249.jpg',
    },
    whatsAppNotification: buildJobDoneOrderNotification({
      order: {
        completedAt: '13 Aug 2026, 4:20 PM',
        customerName: 'Taman Sejuk Cafe',
        id: 'ORDER1249',
        phone: '+603 5510 8822',
      },
      technicianName: 'John',
    }),
    assignedTechnicianId: 'john',
    adminNotes: 'Avoid lunch peak if possible.',
    status: STATUS.JOB_DONE,
    attachments: 2,
    completedAt: '13 Aug 2026, 4:20 PM',
    history: [
      {
        actor: 'Admin',
        action: 'Assigned John',
        at: '12 Aug 2026, 11:00 AM',
      },
      {
        actor: 'John',
        action: 'Marked job done with 2 attachments',
        at: '13 Aug 2026, 4:20 PM',
      },
    ],
  },
  {
    id: 'ORDER1252',
    customerName: 'Ravi',
    phone: '+6016 778 4412',
    address: '33, Jalan USJ 4, Subang',
    serviceType: 'Inspection',
    problem: 'Tenant reported intermittent rattling noise',
    quotedPrice: 120,
    finalAmount: 120,
    completion: {
      workDone: 'Inspected indoor blower, tightened casing, and tested fan speed.',
      extraCharges: 0,
      remarks: 'No replacement parts required.',
      attachments: ['inspection-checklist.jpg'],
    },
    payment: {
      received: true,
      amount: 120,
      method: 'Cash',
      receiptFile: 'cash-receipt-order1252.jpg',
    },
    whatsAppNotification: null,
    assignedTechnicianId: 'yusoff',
    adminNotes: 'Tenant only available after 4 PM.',
    status: STATUS.REVIEWED,
    attachments: 1,
    completedAt: '12 Aug 2026, 5:05 PM',
    history: [
      {
        actor: 'Admin',
        action: 'Assigned Yusoff',
        at: '11 Aug 2026, 10:40 AM',
      },
      {
        actor: 'Yusoff',
        action: 'Marked job done with 1 attachment',
        at: '12 Aug 2026, 5:05 PM',
      },
      {
        actor: 'Manager',
        action: 'Reviewed completion record',
        at: '13 Aug 2026, 8:45 AM',
      },
    ],
  },
  {
    id: 'ORDER1255',
    customerName: 'Merdeka Pharmacy',
    phone: '+603 3344 6700',
    address: '19, Jalan Meru, Klang',
    serviceType: 'Aircond cleaning',
    problem: 'Front counter unit smells musty',
    quotedPrice: 360,
    finalAmount: 360,
    completion: {
      workDone: 'Cleaned two indoor units and flushed both drain lines.',
      extraCharges: 0,
      remarks: 'Pharmacy requested evidence upload after closing.',
      attachments: [],
    },
    payment: {
      received: false,
      amount: 0,
      method: '',
      receiptFile: '',
    },
    whatsAppNotification: null,
    assignedTechnicianId: 'bala',
    adminNotes: 'Service after pharmacy lunch break.',
    status: STATUS.CLOSED,
    attachments: 0,
    completedAt: '11 Aug 2026, 3:40 PM',
    history: [
      {
        actor: 'Admin',
        action: 'Assigned Bala',
        at: '10 Aug 2026, 2:20 PM',
      },
      {
        actor: 'Bala',
        action: 'Marked job done with 0 attachments',
        at: '11 Aug 2026, 3:40 PM',
      },
      {
        actor: 'Manager',
        action: 'Closed order pending evidence follow-up',
        at: '12 Aug 2026, 9:15 AM',
      },
    ],
  },
  {
    id: 'ORDER1258',
    customerName: 'Koh Family',
    phone: '+6012 909 8877',
    address: '5, Jalan SS2/24, Petaling Jaya',
    serviceType: 'Gas refill',
    problem: 'Master bedroom unit not cold enough at night',
    quotedPrice: 260,
    finalAmount: 300,
    completion: {
      workDone: 'Topped up refrigerant and checked flare nut connection.',
      extraCharges: 40,
      remarks: 'Advised customer to monitor cooling for one week.',
      attachments: ['gas-gauge.jpg', 'service-area.jpg'],
    },
    payment: {
      received: true,
      amount: 300,
      method: 'Bank transfer',
      receiptFile: 'transfer-order1258.pdf',
    },
    whatsAppNotification: buildJobDoneOrderNotification({
      order: {
        completedAt: '10 Aug 2026, 6:10 PM',
        customerName: 'Koh Family',
        id: 'ORDER1258',
        phone: '+6012 909 8877',
      },
      technicianName: 'Ali',
    }),
    assignedTechnicianId: 'ali',
    adminNotes: 'Guardhouse requires IC registration.',
    status: STATUS.JOB_DONE,
    attachments: 2,
    completedAt: '10 Aug 2026, 6:10 PM',
    history: [
      {
        actor: 'Admin',
        action: 'Assigned Ali',
        at: '9 Aug 2026, 4:50 PM',
      },
      {
        actor: 'Ali',
        action: 'Marked job done with 2 attachments',
        at: '10 Aug 2026, 6:10 PM',
      },
    ],
  },
  {
    id: 'ORDER1260',
    customerName: 'Damansara Tuition Centre',
    phone: '+603 7722 1808',
    address: '2-1, Jalan PJU 5/12, Kota Damansara',
    serviceType: 'Installation',
    problem: 'Install new unit for classroom three',
    quotedPrice: 920,
    finalAmount: 920,
    completion: {
      workDone: 'Installed wall-mounted unit, vacuumed line, and tested drainage.',
      extraCharges: 0,
      remarks: 'Classroom ready before evening session.',
      attachments: ['classroom-unit.jpg', 'drainage-test.jpg'],
    },
    payment: {
      received: true,
      amount: 920,
      method: 'Card',
      receiptFile: 'card-slip-order1260.jpg',
    },
    whatsAppNotification: null,
    assignedTechnicianId: 'john',
    adminNotes: 'Coordinate access with centre admin.',
    status: STATUS.REVIEWED,
    attachments: 2,
    completedAt: '7 Aug 2026, 4:30 PM',
    history: [
      {
        actor: 'Admin',
        action: 'Assigned John',
        at: '6 Aug 2026, 1:25 PM',
      },
      {
        actor: 'John',
        action: 'Marked job done with 2 attachments',
        at: '7 Aug 2026, 4:30 PM',
      },
      {
        actor: 'Manager',
        action: 'Reviewed completion record',
        at: '8 Aug 2026, 9:50 AM',
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

const demoProfiles = {
  [ROLE.ADMIN]: {
    displayName: 'Demo Admin',
    role: ROLE.ADMIN,
    technicianId: null,
    userId: 'demo-admin',
  },
  [ROLE.TECHNICIAN]: {
    displayName: 'Demo Technician',
    role: ROLE.TECHNICIAN,
    technicianId: 'ali',
    userId: 'demo-technician',
  },
  [ROLE.MANAGER]: {
    displayName: 'Demo Manager',
    role: ROLE.MANAGER,
    technicianId: null,
    userId: 'demo-manager',
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
  const [activeProfile, setActiveProfile] = useState(
    supabase ? null : demoProfiles[ROLE.ADMIN],
  )
  const [sessionLabel, setSessionLabel] = useState(
    supabase ? 'Checking Supabase profile' : 'Demo profile',
  )
  const [authForm, setAuthForm] = useState({ email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [dataError, setDataError] = useState('')
  const [orders, setOrders] = useState(supabase ? [] : initialOrders)
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('ali')
  const [submittedOrder, setSubmittedOrder] = useState(null)
  const orderRepository = useMemo(
    () => (supabase ? createOrderRepository(supabase) : null),
    [],
  )
  const sessionRepository = useMemo(
    () => (supabase ? createSessionRepository(supabase) : null),
    [],
  )
  const activeRole = activeProfile?.role ?? null
  const activeView = activeRole
    ? roleViews[activeRole]
    : {
        description: 'Sign in with a Supabase profile to access this workspace.',
        title: 'Profile required',
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
    [orders],
  )
  useEffect(() => {
    if (!supabase) return undefined

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
        if (!ignore) setSessionLabel('Supabase profile unavailable')
      })

    return () => {
      ignore = true
    }
  }, [sessionRepository])

  useEffect(() => {
    if (!orderRepository || !activeProfile) return undefined

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

  async function refreshOrders() {
    if (!orderRepository) return orders

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

  function replaceOrder(orderId, getUpdatedOrder) {
    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.id === orderId ? getUpdatedOrder(order) : order,
      ),
    )
  }

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
    if (orderRepository) {
      try {
        const createdOrder = await orderRepository.createOrder({
          assignedTechnicianName: getTechnicianName(form.assignedTechnicianId),
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

    const newOrder = buildOrderFromForm({ form, orders, technicians })

    setOrders((currentOrders) => [newOrder, ...currentOrders])
    setSubmittedOrder(newOrder)
    return true
  }

  async function completeJob(orderId, form) {
    const order = orders.find((currentOrder) => currentOrder.id === orderId)
    if (!order) return ''

    const technicianName = getTechnicianName(order.assignedTechnicianId)

    if (orderRepository) {
      try {
        await orderRepository.completeOrder({ form, order, technicianName })
        await refreshOrders()
        return completeOrder({ form, order, technicianName }).whatsAppNotification
      } catch (error) {
        setDataError(error.message ?? 'Unable to complete order.')
        return null
      }
    }

    const completedJob = completeOrder({
      form,
      order,
      technicianName,
    })

    setOrders((currentOrders) =>
      currentOrders.map((currentOrder) =>
        currentOrder.id === orderId ? completedJob.order : currentOrder,
      ),
    )

    return completedJob.whatsAppNotification
  }

  async function reviewJob(orderId) {
    const order = orders.find((currentOrder) => currentOrder.id === orderId)
    if (!order) return

    if (orderRepository) {
      try {
        await orderRepository.reviewOrder({ order })
        await refreshOrders()
      } catch (error) {
        setDataError(error.message ?? 'Unable to review order.')
      }
      return
    }

    replaceOrder(orderId, (currentOrder) => reviewOrder({ order: currentOrder }))
  }

  async function closeJob(orderId) {
    const order = orders.find((currentOrder) => currentOrder.id === orderId)
    if (!order) return

    if (orderRepository) {
      try {
        await orderRepository.closeOrder({ order })
        await refreshOrders()
      } catch (error) {
        setDataError(error.message ?? 'Unable to close order.')
      }
      return
    }

    replaceOrder(orderId, (currentOrder) => closeOrder({ order: currentOrder }))
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

        {!supabase && (
          <nav className="role-switcher" aria-label="Demo role switcher">
            {Object.values(demoProfiles).map((profile) => (
              <button
                className={profile.role === activeRole ? 'active' : ''}
                key={profile.role}
                onClick={() => {
                  setActiveProfile(profile)
                  if (profile.technicianId) {
                    setSelectedTechnicianId(profile.technicianId)
                  }
                }}
                type="button"
              >
                {profile.role}
              </button>
            ))}
          </nav>
        )}

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
            {supabase && activeProfile && (
              <button className="secondary-action" onClick={signOut} type="button">
                Sign out
              </button>
            )}
            <h2>{activeView.title}</h2>
            <p>{activeView.description}</p>
          </div>
        </header>

        {dataError && <p className="form-error">{dataError}</p>}

        <section className="metrics-grid" aria-label="Operations summary">
          {metrics.map((metric) => (
            <article className="metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </section>

        <section className="role-panel">
          {supabase && !activeProfile && (
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
            />
          )}
          {activeProfile && activeRole === ROLE.TECHNICIAN && (
            <TechnicianOverview
              jobs={assignedJobs}
              onCompleteJob={completeJob}
              selectedTechnicianId={activeTechnicianId}
              setSelectedTechnicianId={setSelectedTechnicianId}
            />
          )}
          {activeProfile && activeRole === ROLE.MANAGER && (
            <ManagerOverview
              completedJobs={completedJobs}
              managerKpis={managerKpis}
              onCloseJob={closeJob}
              onReviewJob={reviewJob}
            />
          )}
        </section>
      </section>
    </main>
  )
}

function SupabaseLoginPanel({ authError, form, onChange, onSignIn }) {
  function updateField(field, value) {
    onChange({ ...form, [field]: value })
  }

  return (
    <section className="panel" aria-label="Supabase sign in">
      <PanelHeader
        eyebrow="Supabase Auth"
        title="Sign in required"
        description="Use an invited account with an Admin, Technician, or Manager profile."
      />
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
    </section>
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
  const nextOrderId = previewNextOrderId({ orders })

  function updateField(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateOrderForm(form)

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    const wasCreated = await onCreateOrder(form)
    if (!wasCreated) return

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
  const [whatsAppNotification, setWhatsAppNotification] = useState(job.whatsAppNotification)
  const isDone = isCompletedStatus(job.status)
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

    const generatedWhatsAppNotification = await onCompleteJob(job.id, form)
    if (generatedWhatsAppNotification === null) return

    setWhatsAppNotification(generatedWhatsAppNotification)
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
        <CompletedJobSummary job={job} whatsAppNotification={whatsAppNotification} />
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

function ManagerOverview({ completedJobs, managerKpis, onCloseJob, onReviewJob }) {
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
        emptyMessage="No completed jobs yet."
        onCloseJob={onCloseJob}
        onReviewJob={onReviewJob}
        orders={completedJobs}
        showReviewAction
      />
    </>
  )
}

const exampleOperationsQuestions = [
  'What jobs did technician Ali complete last week?',
  'Which technician completed the most jobs this week?',
  'How many jobs were completed today?',
]

function OperationsQueryWindow({ orders, technicians }) {
  const [question, setQuestion] = useState(exampleOperationsQuestions[0])
  const [answer, setAnswer] = useState(() =>
    answerOperationsQuery({
      orders,
      question: exampleOperationsQuestions[0],
      technicians,
    }),
  )

  function submitQuery(event) {
    event.preventDefault()
    setAnswer(
      answerOperationsQuery({
        orders,
        question,
        technicians,
      }),
    )
  }

  function askExample(exampleQuestion) {
    setQuestion(exampleQuestion)
    setAnswer(
      answerOperationsQuery({
        orders,
        question: exampleQuestion,
        technicians,
      }),
    )
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
          <button className="primary-action" type="submit">
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
  emptyMessage = 'No orders available.',
  onCloseJob,
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
                {canReviewOrder(order) && (
                  <button
                    className="secondary-action"
                    onClick={() => onReviewJob(order.id)}
                    type="button"
                  >
                    Mark Reviewed
                  </button>
                )}
                {canCloseOrder(order) && (
                  <button
                    className="secondary-action"
                    onClick={() => onCloseJob(order.id)}
                    type="button"
                  >
                    Mark Closed
                  </button>
                )}
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

export default App
