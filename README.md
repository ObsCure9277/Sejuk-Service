# Sejuk Service Operations Portal

React + Vite operations portal for Sejuk Service. The app supports role-based job intake, technician completion, manager review, order closing, KPI visibility, workflow alerts, and Supabase-backed persistence.

## What You Built

- A Supabase-authenticated service operations app for Admin, Manager, and Technician users.
- Admin workflow for creating assigned service orders with customer details, job details, technician assignment, schedule information, and quoted amount.
- Technician workspace scoped to assigned jobs, with completion inputs for work performed, extra charges, evidence notes, payment method, amount collected, and receipt metadata.
- Manager review queue for reviewing completed jobs and closing reviewed orders.
- Role-aware action controls so technicians complete only their own assigned jobs, while managers/admins handle review and closure.
- KPI dashboard, operations query panel, workflow supervisor alerts, and WhatsApp message-link generation.
- Login page with copyable demo credentials for the seeded users.
- Automated tests under `testing/` covering workflow helpers, role access, Supabase contracts, persistence mapping, repositories, KPI logic, and query logic.

## Tech Stack Used

- React 19 for the frontend UI.
- Vite 8 for local development and production builds.
- Plain CSS in `src/App.css` for the responsive operations layout.
- Supabase Auth for email/password login.
- Supabase Postgres, RLS, and RPC functions for persistent order workflow writes.
- `@supabase/supabase-js` for browser-side Supabase access.
- Node's built-in test runner through `node --test`.
- ESLint for static checks.

## Architecture Decisions

- `src/App.jsx` is the UI orchestrator. It loads the active session, profile, technicians, and orders, then routes user actions to repository modules.
- `src/supabaseClient.js` centralizes Supabase environment validation and client creation. If `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY` is missing, the app shows the setup panel instead of running an offline demo mode.
- `src/sessionRepository.js`, `src/technicianRepository.js`, and `src/orderRepository.js` isolate Supabase reads and writes from the React components.
- Order mutations use database RPC functions (`create_order_with_history`, `complete_order_with_history`, `review_order_with_history`, and `close_order_with_history`) so status changes and history rows are written atomically.
- `src/orderPersistence.js` maps between database rows and the app's order shape, keeping database naming and UI naming separate.
- `src/roleAccess.js` keeps frontend role checks readable. These checks improve UX, while Supabase RLS remains the source of truth for authorization.
- `src/orderStatus.js` defines shared status values so UI, workflow logic, and tests use the same vocabulary.
- `src/orderWorkflow.js` contains pure workflow helpers for amount calculation, validation, completion payloads, and WhatsApp preview data.
- `src/managerKpiDashboard.js`, `src/operationsQueryAssistant.js`, and `src/workflowSupervisor.js` are deterministic domain helpers rather than external services.
- Tests live in `testing/` and import production modules from `src/`.

## Challenges / Assumptions

- Supabase schema setup is a hard dependency. The frontend expects the required tables, policies, and RPC functions to exist in the connected Supabase project.
- If Supabase reports a missing function such as `public.review_order_with_history(...)`, run the SQL schema in Supabase and reload PostgREST's schema cache with `NOTIFY pgrst, 'reload schema';`.
- Demo login assumes matching Supabase Auth users already exist and that their `profiles.user_id` values match the auth user IDs.
- The frontend uses role checks for interaction state, but final permission enforcement belongs in database RLS policies and RPC definitions.
- Evidence and receipts are captured as structured metadata only. The implementation does not upload files to Supabase Storage.
- Payment fields record payment state for operations tracking. There is no payment gateway integration.
- WhatsApp integration generates a `wa.me` link. It does not send messages through the WhatsApp Business API.
- The implementation assumes a seeded assessment/demo dataset rather than production-scale migration, audit, and user-management tooling.

## How AI Was Integrated

No external LLM API is called by the app. The AI-like behavior is implemented with deterministic local logic:

- `OperationsQueryWindow` uses `operationsQueryAssistant.js` to answer predefined operational questions, such as technician workload, top technician, completed order count, and review queue status.
- `WorkflowAlerts` uses `workflowSupervisor.js` to flag operational risks such as missing evidence and unusually high final amounts.

This keeps the demo predictable, avoids API keys and model latency, and makes the behavior easy to test. The tradeoff is that the assistant cannot understand arbitrary natural-language questions beyond the supported patterns.

## Limitations

- No offline/local-storage demo fallback is currently active. Supabase configuration is required for the app to operate.
- Supabase schema and seed data must be applied manually outside the frontend.
- Missing or stale Supabase RPC functions will make workflow buttons fail even when the frontend is correct.
- There is no file upload, image preview, OCR, or storage bucket workflow for evidence and receipts.
- There is no real WhatsApp sending, route optimization, dispatch scheduling, inventory, invoicing, or payment collection integration.
- There is no self-service user creation screen; demo users must be created in Supabase Auth and linked to `profiles`.
- The operations query assistant is rule-based, not a general-purpose AI assistant.
- Browser end-to-end tests are not configured; current coverage is focused on unit and contract tests.

## Running Locally

Install dependencies:

```bash
npm install
```

Create a local `.env` file with your Supabase project values:

```bash
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run checks:

```bash
npm run lint
npm test
```

## Database Setup

Apply the Supabase schema and seed/import data in your Supabase SQL editor or migration flow. After changing RPC functions, reload the PostgREST schema cache:

```sql
NOTIFY pgrst, 'reload schema';
```

The app expects the connected Supabase project to include the workflow RPC functions used by `src/orderRepository.js`.
