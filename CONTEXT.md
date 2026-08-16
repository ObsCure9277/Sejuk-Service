# Sejuk Service

Sejuk Service manages air-conditioning service work from customer order intake through technician completion, manager review, and operational reporting.

## Language

**Order**:
A customer service request tracked through the operational workflow.
_Avoid_: Job, ticket, transaction

**Order Number**:
The human-facing identifier shown to staff and customers, such as `ORDER1234`.
_Avoid_: ID, database ID

**Customer**:
A person or organization receiving service for an order.
_Avoid_: Client, buyer, account

**Technician**:
A service staff member assigned to complete orders in the field.
_Avoid_: Worker, contractor, engineer

**Role**:
The operational permission category for a logged-in user, currently Admin, Technician, or Manager.
_Avoid_: UI mode, persona

**Job Completion**:
The technician-submitted record that an assigned order's field work is done, including evidence, payment details, final amount, and remarks.
_Avoid_: Done form, closeout

**Order History**:
The chronological record of workflow actions taken on an order.
_Avoid_: Log, activity feed

**Workflow Status**:
The current operational state of an order, such as Assigned, In Progress, Job Done, Reviewed, or Closed.
_Avoid_: Stage, step

**Evidence**:
Technician-provided proof that field work was completed, initially tracked as attachment metadata.
_Avoid_: Upload, photo

**Payment Record**:
The payment details captured when a technician marks an order as complete.
_Avoid_: Receipt, collection
**Profile**:
The application record that connects a logged-in Supabase user to a Sejuk Service role and, when relevant, a technician.
_Avoid_: Account, auth user

**Repository**:
A frontend data-access module that hides Supabase table and query details from React components.
_Avoid_: Service, helper
**Order Intake Details**:
The customer, service, problem, quote, address, notes, and assignment information captured before field work begins.
_Avoid_: Order details, admin fields

**Actor Label**:
The readable name stored on an order history entry to identify who or what performed the action.
_Avoid_: Username, display name

**Evidence Metadata**:
The database representation of completion evidence before real file storage is added.
_Avoid_: Attachment, file upload
**Seed Data**:
Initial database records required for the app to operate before live orders exist, currently technicians only.
_Avoid_: Demo data, sample data

**Demo Data**:
Local fallback records used only when Supabase configuration is missing.
_Avoid_: Seed data, production data

