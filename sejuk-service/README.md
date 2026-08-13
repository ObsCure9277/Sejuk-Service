# Sejuk Service Operations Portal

A React + Vite mock operations portal for the Sejuk Sejuk Service assessment. The app runs entirely in browser state and demonstrates the simplified workflow from order assignment through technician completion and manager visibility.

## Implemented Modules

- Admin order desk: creates service orders, auto-generates order numbers, assigns one of the seeded technicians, validates required fields, and shows a submitted-order summary.
- Technician service job workflow: filters jobs by selected technician, shows mobile-friendly job details, records work done, extra charges, remarks, up to six supporting uploads, optional payment details, and receipt evidence.
- WhatsApp completion trigger: when a technician marks a job as `Job Done`, the app creates a WhatsApp notification record with trigger status, recipient phone, message preview, and a `wa.me` deep link containing the customer name, order ID, technician name, and completion timestamp.
- Manager review queue and KPI dashboard: completed jobs can be marked reviewed or closed, reviewed jobs stay visible for traceability, and weekly technician metrics update from Job Done, Reviewed, and Closed workflow data.
- Local workflow supervisor: manager view flags completed jobs with unusually high final amounts or missing completion evidence.

## Workflow Rules Modeled

Orders use the states `New -> Assigned -> In Progress -> Job Done -> Reviewed -> Closed`. In this client-side version, created orders move directly to `Assigned` because the admin form includes technician assignment. Technician completion moves the selected order to `Job Done`, records the completion timestamp, stores completion/payment data in memory, and appends action history.

Seeded technicians are Ali, John, Bala, and Yusoff. Seeded orders provide assigned, in-progress, job-done, reviewed, and closed examples, with enough completed jobs to exercise manager KPIs, review actions, evidence coverage, and workflow alerts.

## Architecture Notes

Order workflow behavior lives in `src/orderWorkflow.js`: creation, status advancement, technician completion, manager review/close actions, final amount calculation, WhatsApp trigger creation, and history entries are tested through that module interface. React remains the browser-state adapter that gathers form intent and renders the returned order state.

## Tech Stack

- React 19
- Vite 8
- Plain CSS
- Browser state only, no backend or persistence

## Running Locally

```bash
npm install
npm run dev
```

Verification used for this implementation:

```bash
npm test
npm run lint
npm run build
```

## Assumptions and Limitations

- File uploads are represented by browser `File` objects and attachment counts only; files are not uploaded or persisted.
- WhatsApp notification is generated as a deep-link trigger and message preview; users still open/send it manually because this is not the paid WhatsApp Business API.
- Authentication and authorization are simulated with role and technician switchers.
- There is no database, audit log service, offline mode, OCR engine, or accounts reconciliation backend.
- Automated coverage is focused on Order workflow, WhatsApp notification, workflow-supervisor, and manager-KPI domain helpers; broader UI workflow tests are still not configured.

## AI Usage

The workflow supervisor is implemented as deterministic local checks over workflow data instead of an external AI API. This keeps the demo self-contained while still showing the kind of operational issues an AI-assisted supervisor could surface. AI assistance was used during development to translate the assessment brief into the React workflow and README notes.
