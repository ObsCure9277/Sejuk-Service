import { useMemo, useState } from 'react'
import './App.css'

const orderStatuses = [
  'New',
  'Assigned',
  'In Progress',
  'Job Done',
  'Reviewed',
  'Closed',
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
    assignedTechnicianId: 'ali',
    status: 'Assigned',
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
    assignedTechnicianId: 'john',
    status: 'In Progress',
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
    assignedTechnicianId: 'bala',
    status: 'Job Done',
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
    assignedTechnicianId: 'ali',
    status: 'Reviewed',
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
  if (status === 'Job Done') return 'done'
  if (status === 'Reviewed' || status === 'Closed') return 'reviewed'
  if (status === 'In Progress') return 'active'
  return 'queued'
}

function recordAction(order, actor, action) {
  return {
    ...order,
    history: [
      ...order.history,
      {
        actor,
        action,
        at: new Intl.DateTimeFormat('en-MY', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }).format(new Date()),
      },
    ],
  }
}

function App() {
  const [activeRole, setActiveRole] = useState('Admin')
  const [orders, setOrders] = useState(initialOrders)
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('ali')

  const activeView = roleViews[activeRole]
  const assignedJobs = orders.filter(
    (order) => order.assignedTechnicianId === selectedTechnicianId,
  )
  const completedJobs = orders.filter((order) =>
    ['Job Done', 'Reviewed', 'Closed'].includes(order.status),
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
      { label: 'With evidence', value: `${evidenceCount}/${completedOrderCount}` },
    ]
  }, [completedJobs, orders.length])

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
          {activeRole === 'Admin' && <AdminOverview orders={orders} />}
          {activeRole === 'Technician' && (
            <TechnicianOverview
              jobs={assignedJobs}
              selectedTechnicianId={selectedTechnicianId}
              setSelectedTechnicianId={setSelectedTechnicianId}
            />
          )}
          {activeRole === 'Manager' && (
            <ManagerOverview completedJobs={completedJobs} />
          )}
        </section>
      </section>
    </main>
  )
}

function AdminOverview({ orders }) {
  return (
    <>
      <PanelHeader
        eyebrow="Dispatch queue"
        title="Current orders"
        description="Seeded orders give the next tickets a live workflow to extend."
      />
      <OrderList orders={orders} />
    </>
  )
}

function TechnicianOverview({
  jobs,
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
      <OrderList emptyMessage="No jobs assigned." orders={jobs} />
    </>
  )
}

function ManagerOverview({ completedJobs }) {
  return (
    <>
      <PanelHeader
        eyebrow="Review queue"
        title="Completed work"
        description="Job Done, Reviewed, and Closed orders are ready for manager visibility."
      />
      <OrderList emptyMessage="No completed jobs yet." orders={completedJobs} />
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

function OrderList({ emptyMessage = 'No orders available.', orders }) {
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
          </article>
        )
      })}
    </div>
  )
}

export default App