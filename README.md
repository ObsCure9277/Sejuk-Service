# Sejuk Service Operations Portal

React + Vite operations portal for Sejuk Service. The app supports role-based job intake, technician completion, manager review, order closing, KPI visibility, workflow alerts, WhatsApp customer notification links, and Supabase-backed persistence.

## What You Built

- A Supabase-authenticated service operations app for Admin, Manager, and Technician users.
- Admin workflow for creating assigned service orders with customer details, job details, technician assignment, schedule information, and quoted amount.
- Technician workspace scoped to assigned jobs, with completion inputs for work performed, extra charges, supporting file names, payment method, amount collected, and receipt file name.
- Manager review queue for reviewing completed jobs and closing reviewed orders.
- Role-aware action controls so technicians complete only their own assigned jobs, while managers/admins handle review and closure.
- KPI dashboard, rule-based operations query panel, workflow supervisor alerts, and WhatsApp message-link generation after job completion.
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

- `src/App.jsx` is the UI orchestrator. It loads the active session, profile, technicians, and orders, derives the role-specific view, and routes user actions to repository modules.
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
- Evidence and receipts are captured as file-name metadata only. The implementation does not upload file contents to Supabase Storage.
- Payment fields record payment state for operations tracking. There is no payment gateway integration.
- WhatsApp integration generates a `wa.me` link. It does not send messages through the WhatsApp Business API.
- The implementation assumes a seeded assessment/demo dataset rather than production-scale migration, audit, and user-management tooling.

## How AI Was Integrated

No external LLM API is called by the app. The AI-like behavior is implemented with deterministic local logic in the frontend:

- `OperationsQueryWindow` in `src/App.jsx` calls `answerOperationsQuery` from `src/operationsQueryAssistant.js`.
- The query assistant normalizes the user's question, matches it against supported operational patterns, filters the loaded order data, and returns a title, summary, and result list.
- `WorkflowAlerts` uses `src/workflowSupervisor.js` to flag operational risks such as missing completion evidence and final amounts more than 30% above the original quote.

This keeps the demo predictable, avoids AI API keys and model latency, and makes the behavior easy to test. The tradeoff is that the assistant cannot understand arbitrary natural-language questions beyond the supported patterns.

## Supported AI Queries

The operations query assistant supports these query types:

- Completed jobs by a named technician for a supported period, for example: `What jobs did technician Ali complete last week?`
- Top technician by completed job count for a supported period, for example: `Which technician completed the most jobs this week?`
- Completed job count for a supported period, for example: `How many jobs were completed today?`

Supported time periods are `today`, `this week`, and `last week`. If no supported period is found, the assistant defaults to `this week`. Technician-name queries must include a technician name from the currently loaded technician list.

## AI Implementation Limitations

- The assistant is rule-based. It does not call OpenAI, Supabase AI, embeddings, vector search, or any other LLM service.
- It only works on order and technician data already loaded in the browser.
- It does not support broad free-text analytics, follow-up memory, fuzzy technician matching, typo correction, forecasting, recommendations, or explanations generated from unstructured notes.
- Date handling is limited to the supported relative periods. It does not parse custom ranges such as `between 1 August and 15 August`.
- Answers are deterministic summaries from current app state, so they may be stale if another user changes Supabase data before the local view is refreshed.

## Limitations

- No offline/local-storage demo fallback is currently active. Supabase configuration is required for the app to operate.
- Supabase schema and seed data must be applied manually outside the frontend.
- Missing or stale Supabase RPC functions will make workflow buttons fail even when the frontend is correct.
- There is no file upload, image preview, OCR, or storage bucket workflow for evidence and receipts.
- There is no real WhatsApp sending, route optimization, dispatch scheduling, inventory, invoicing, or payment collection integration.
- There is no self-service user creation screen; demo users must be created in Supabase Auth and linked to `profiles`.
- Browser end-to-end tests are not configured; current coverage is focused on unit and contract tests.

## Running Locally

From the app directory, install dependencies:

```bash
cd sejuk-service
npm install
```

Create `sejuk-service/.env` with your Supabase project values:

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
