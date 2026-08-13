# Sejuk Service Operations Portal

A React + Vite operations portal for the Sejuk Sejuk Service assessment. It models the daily flow for an air-conditioning service team: admins create and assign jobs, technicians complete assigned work, WhatsApp completion messages are generated, and managers review completed jobs with KPI visibility.

## What I Built

- Admin order submission screen with required-field validation, generated order IDs, customer/service details, technician assignment, and submitted-order feedback.
- Technician job workspace that filters work by selected technician and supports completion notes, extra charges, supporting evidence, optional payment details, and receipt attachment metadata.
- WhatsApp completion notification generator that creates a `wa.me` deep link and message preview when a technician marks a job as `Job Done`.
- Manager review queue for `Job Done`, `Reviewed`, and `Closed` jobs, including review and close actions.
- Manager KPI dashboard with weekly technician metrics, completed-job counts, revenue totals, collection totals, variance from quote, evidence coverage, review status, and recent completed-job data.
- Operations Query Window that lets managers ask simple service-data questions about completed jobs.
- Local workflow supervisor alerts that flag completed jobs with missing evidence or unusually high final amounts.

## Tech Stack Used

- React 19 for the browser UI.
- Vite 8 for local development and production builds.
- Plain CSS for responsive layout and component styling.
- Node's built-in test runner for domain/helper tests.
- ESLint for static checks.
- Browser state only; there is no backend, database, or external API dependency.

## Architecture Decisions

The app is intentionally split between UI state and workflow/domain logic.

- `src/App.jsx` owns screen state, form state, role switching, technician selection, and rendering.
- `src/orderWorkflow.js` owns order creation, status advancement, technician completion, manager review/close actions, history entries, final amount calculation, and WhatsApp trigger creation.
- `src/orderStatus.js` keeps the shared status vocabulary in one place.
- `src/whatsappNotification.js` handles WhatsApp phone normalization and deep-link/message construction.
- `src/managerKpiDashboard.js` builds manager metrics from completed workflow data.
- `src/workflowSupervisor.js` contains the local alert rules used by the manager view.

This shape keeps business rules testable without rendering React. The UI asks the workflow module to perform an action and renders the returned order state, instead of spreading status and history rules across event handlers.

## Challenges and Assumptions

- The assessment asks for an operations workflow, so I prioritized a complete browser demo over backend infrastructure.
- Created orders move directly to `Assigned` because the admin form includes technician assignment.
- Uploads are represented by browser `File` metadata and attachment counts; actual file storage is outside this implementation.
- Payment capture is represented as structured in-memory data, not a real payment or accounting integration.
- WhatsApp sending is represented by a generated deep link. The user still decides whether to open and send it.
- Authentication is simulated through role and technician switchers so the workflow can be assessed quickly.
- Seed data is deliberately broad enough to demonstrate manager KPIs, review states, missing-evidence alerts, high-final-amount alerts, and completed-job history.

## How AI Was Integrated

There is no external LLM call in this implementation. The AI-facing feature is a local workflow supervisor that behaves like a lightweight assistant for managers by scanning completed job data and surfacing operational exceptions.

Current AI-style assistance is deterministic and transparent:

- It checks whether a completed job has no supporting evidence.
- It checks whether the final amount is significantly above the quoted price.
- It attaches severity, affected order ID, technician name, and alert details for manager review.

This was chosen so the assessment can run offline and produce repeatable results without API keys, model latency, or unpredictable model output.

## Types of AI Queries Supported

The Operations Query Window supports simple natural-language operations questions through local deterministic rules:

- Technician job lookup: "What jobs did technician Ali complete last week?"
- Weekly leader lookup: "Which technician completed the most jobs this week?"
- Completed-job count: "How many jobs were completed today?"

Evidence audits, quote variance checks, and manager exception review remain exposed through dashboard cards and workflow alert panels.

## Limitations of the AI Implementation

- No LLM or semantic understanding is connected.
- Natural-language prompt handling is limited to predefined service operations patterns.
- No retrieval over documents, invoices, photos, chat history, or technician notes.
- No OCR or image analysis for uploaded evidence.
- No predictive scheduling, route optimization, anomaly learning, or recommendation model.
- Alert thresholds are fixed in code, so they do not adapt from historical data.
- The supervisor can flag obvious workflow exceptions, but it cannot explain root cause beyond the structured data available in the browser.

## General Implementation Limitations

- Data resets on page refresh because all state is in memory.
- There is no real authentication, authorization, backend validation, or audit-log persistence.
- Files are not uploaded, previewed, scanned, or stored.
- WhatsApp integration is a `wa.me` link, not the WhatsApp Business API.
- KPI dates are based on seeded and in-session workflow data only.
- Automated tests cover workflow, notification, KPI, and supervisor helper logic; full browser UI tests are not configured.

## Running Locally

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npm run lint
npm run build
```
