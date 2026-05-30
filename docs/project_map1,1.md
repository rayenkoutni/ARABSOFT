# ArabSoft Current Technical Project Map

## 1. Project Purpose And Functional Scope

ArabSoft is a role-based internal HR/workflow portal built on Next.js App Router with a custom Node server. The current implementation combines four main domains:

1. HR request submission and approval workflows.
2. Employee/user administration for HR.
3. Project and task tracking for managers and collaborators.
4. Internal chat with real-time delivery via Socket.IO and Kafka.

The codebase is already usable for core request handling, user management, project/task management, and chat, but it is not uniformly mature. Several areas are production-shaped at the UI level while still containing partial wiring, duplicated abstractions, or security/consistency issues.

The real product scope implemented today is narrower than the Prisma schema suggests. The schema also models skills, positions, and evaluations, but those domains do not currently have usable API/UI flows.

## 2. Architecture Overview

### 2.1 Frontend

- Framework: Next.js 16 App Router.
- Runtime style: mostly client-rendered pages under `app/dashboard/**`.
- UI stack: Tailwind CSS v4, Radix primitives, shadcn-style UI components under `components/ui/**`.
- Auth state: client context in `lib/contexts/auth.context.tsx`.
- Notifications refresh state: client context in `lib/contexts/notification.context.tsx`.
- Dashboard shell: `app/dashboard/layout.tsx`, `components/navigation.tsx`, `components/sidebar.tsx`.

Important frontend characteristics:

- Most business pages are `"use client"` pages using `fetch` directly.
- There are no server actions.
- The frontend relies on `/api/auth/me` plus a JWT cookie for session restoration.
- OTP enforcement is client-side stateful, not server-enforced.

### 2.2 Backend

- API style: Next.js route handlers in `app/api/**`.
- Auth helper: `lib/getCurrentUser.ts` reads the `token` cookie and looks up the employee.
- Custom HTTP server: `server.ts`.
- Real-time transport: Socket.IO initialized in `server.ts`.
- Async chat pipeline: Kafka producer/consumer in `server.ts`.
- Audit logging: `lib/audit.ts`.
- Scheduled job: `lib/cron.ts`.

Important backend characteristics:

- The app does not use the built-in Next.js server only. It requires `server.ts` for Socket.IO and Kafka.
- `server.ts` initializes Kafka producer and consumer on startup unconditionally.
- If Kafka is unavailable, startup is likely to fail rather than degrade gracefully.
- There is a second service-oriented backend layer under `lib/services/server/**`, but the current routes and server largely do not use it.

### 2.3 Database

- ORM: Prisma.
- Database: PostgreSQL.
- Main schema: `prisma/schema.prisma`.
- Seed script: `prisma/seed.ts`.

Core persisted domains:

- `Employee`
- `Request` and `RequestHistory`
- `Project`, `Task`, `ProjectChangeHistory`
- `Notification`
- `AuditLog`
- `Conversation`, `Message`, `MessageRead`
- `SlaConfig`

Modeled but not operationally implemented end-to-end:

- `Skill`, `EmployeeSkill`
- `Position`, `PositionSkill`
- `Evaluation`, `EvaluationObjective`

### 2.4 Authentication

- Login route: `app/api/auth/login/route.ts`
- Password hashing: `lib/auth.ts`
- Session token: JWT in `token` httpOnly cookie
- Current user retrieval: `lib/getCurrentUser.ts`
- OTP routes:
  - `app/api/auth/send-otp/route.ts`
  - `app/api/auth/verify-otp/route.ts`

Important auth behavior:

- Login sets the JWT cookie before OTP verification completes.
- The frontend blocks dashboard navigation until OTP is verified locally.
- The backend does not verify OTP state in API middleware or socket auth.
- RH users can bypass OTP if no OTP code is currently stored.

This means OTP is implemented as a UI gate, not a true backend-enforced second factor.

### 2.5 Infrastructure

- Local orchestration: `docker-compose.yml`
- App container: custom `Dockerfile`
- Services in compose:
  - `app`
  - `db` (PostgreSQL 15)
  - `zookeeper`
  - `kafka`

Important infrastructure notes:

- `docker-compose.yml` assumes Kafka + Zookeeper.
- The app startup path depends on Kafka being available.
- Prisma migrations are configured in `prisma.config.ts`, but no `prisma/migrations/` folder exists in the repository.

### 2.6 Important Dependencies

- `next`, `react`, `react-dom`
- `@prisma/client`, `prisma`
- `jsonwebtoken`, `bcryptjs`
- `socket.io`, `socket.io-client`
- `kafkajs`
- `nodemailer`
- `groq-sdk`
- `node-cron`
- `zod`, `react-hook-form`

Notable dependency implications:

- AI task generation depends on `GROQ_API_KEY`.
- Email workflows depend on SMTP, but the mailer has a dev fallback.
- The project uses `next.config.mjs` with `typescript.ignoreBuildErrors = true`, so type errors can be present without blocking build output.

## 3. Main Runtime Topology

### 3.1 App Entry Points

- UI root: `app/layout.tsx`
- Login page: `app/page.tsx`
- Authenticated shell: `app/dashboard/layout.tsx`
- Custom server: `server.ts`

### 3.2 State And Access Pattern

1. User logs in through `/api/auth/login`.
2. JWT cookie is created immediately.
3. Client auth context stores returned user in `localStorage`.
4. OTP modal is shown on the client if the device is not remembered.
5. Dashboard pages call role-specific APIs based on `user.role`.
6. Socket.IO connection is opened from the auth context after login.

### 3.3 Architectural Split To Keep In Mind

There are two parallel backend styles in the repository:

- The actively used direct route-handler style using `prisma` directly from `lib/prisma.ts`.
- A partially abstracted service layer in `lib/services/**` and `lib/services/server/**`.

The first style is the real runtime path for most features. The second style looks like a refactor-in-progress or abandoned consolidation effort.

## 4. Module-By-Module Implementation Analysis

### 4.1 Authentication And Session Module

**Purpose**

Handles login, logout, current user lookup, OTP, password changes, and client auth state.

**Key files**

- `app/api/auth/login/route.ts`
- `app/api/auth/me/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/send-otp/route.ts`
- `app/api/auth/verify-otp/route.ts`
- `app/api/auth/password/route.ts`
- `lib/contexts/auth.context.tsx`
- `app/page.tsx`

**What exists**

- Username/password login against `Employee.email` + hashed `password`.
- JWT cookie session.
- OTP generation and verification stored on the employee row (`otpCode`, `otpExpiresAt`).
- Remembered-device logic in localStorage.
- Password change API.

**How it works technically**

- Login verifies bcrypt hash and immediately sets a `token` cookie.
- `getCurrentUser()` decodes the JWT and fetches the employee.
- Auth context checks `/api/auth/me` on mount.
- OTP verification is performed by a modal in `app/page.tsx`.

**Connection status**

- Frontend: connected.
- Backend: connected.
- Database: connected.
- Security/business logic: partially connected and partially unsafe.

**Current status**

- Operational for basic sign-in.
- Partial / insecure for MFA enforcement.

**Important issues**

- OTP is not enforced server-side. Authenticated users can call protected APIs and connect sockets before OTP completion.
- `verify-otp` bypasses OTP for RH when no code is present.
- `switchRole` exists in auth context but only mutates local client state; it does not persist anything and should not be treated as real authorization.

### 4.2 Request Workflow Module

**Purpose**

Employees create requests; managers and/or RH review them depending on type; the UI exposes personal views, manager views, and RH views.

**Key files**

- `app/api/requests/route.ts`
- `app/api/requests/[id]/route.ts`
- `app/api/requests/[id]/action/route.ts`
- `lib/services/request.service.ts`
- `app/dashboard/my-requests/page.tsx`
- `app/dashboard/new-request/page.tsx`
- `app/dashboard/my-approvals/page.tsx`
- `app/dashboard/approvals/page.tsx`
- `app/dashboard/team-requests/page.tsx`
- `app/dashboard/requests/page.tsx`

**What exists**

- Request types: leave, authorization, document, loan.
- Approval types: direct RH or manager-then-RH.
- Draft status and approval statuses.
- History trail through `RequestHistory`.
- Role-based list filtering in the API.
- Request cards, timelines, search, and date filtering in the UI.

**How it works technically**

- `POST /api/requests` decides the approval flow from request type.
- Request content is stored mostly inside `comment` as a formatted string like `[title] - description`.
- History receives a `CREATED` record and subsequent `APPROVE`/`REJECT` records.
- `parseRequestContent()` reconstructs title/description from the stored string.

**Connection status**

- Frontend: connected.
- Backend: connected.
- Database: connected.
- Business logic: mostly connected, but draft submission/editing is inconsistent.

**Current status**

- Core creation + approval flow is operational.
- Draft flow is only partially operational.

**Important issues**

- `lib/services/request.service.ts` defines `submitRequest()` as a no-op.
- `app/dashboard/new-request/page.tsx` calls `submitRequest()` after editing a draft. Because it is a no-op, updating a draft and then "submitting" it does not actually transition status out of `BROUILLON`.
- Request title/description are not first-class columns; they are encoded inside `comment`, which is brittle.
- `PUT /api/requests/[id]` only updates `type` and `comment`, not other schema fields like date ranges, amount, or document type.
- The schema contains richer request fields (`reason`, `startDate`, `endDate`, `amount`, `documentType`) that are not really used by the current UI flow.

### 4.3 SLA Module

**Purpose**

Track SLA deadlines for requests and expose RH metrics and configuration.

**Key files**

- `lib/sla.ts`
- `lib/cron.ts`
- `app/api/sla/stats/route.ts`
- `app/api/sla-config/route.ts`
- `app/api/sla-config/[id]/route.ts`
- `app/dashboard/settings/page.tsx`

**What exists**

- `SlaConfig` table with per-request-type `maxHours`.
- Request creation calculates `slaDeadline`.
- RH settings tab can view and edit SLA hours.
- RH dashboard can fetch monthly breach stats.

**Connection status**

- Frontend: connected for RH.
- Backend: connected.
- Database: connected.
- Cron/business logic: broken or unreliable.

**Current status**

- Config and stats UI exist.
- Automatic breach marking is currently flawed.

**Important issues**

- `lib/cron.ts` filters with `status: { notIn: ['EN_ATTENTE_CHEF', 'EN_ATTENTE_RH'] }`, which is the opposite of the expected pending-request filter. This likely prevents normal pending requests from being marked as SLA-breached.
- `server.ts` already calls `initCron()`, and `app/api/init/route.ts` can call it again. Multiple schedules can be registered.
- The settings tab writes SLA values on every numeric input change rather than via an explicit save action.

### 4.4 Employee / User Administration Module

**Purpose**

Allow RH to manage accounts and allow all users to view/update profile information.

**Key files**

- `app/api/employees/route.ts`
- `app/api/employees/[id]/route.ts`
- `app/api/employees/profile/route.ts`
- `app/api/users/team/route.ts`
- `app/dashboard/users/page.tsx`
- `app/dashboard/settings/page.tsx`

**What exists**

- RH can list all employees, create employees, edit employees, reset passwords, and delete employees.
- CHEF can fetch their team.
- Profile route supports avatar, name, and phone updates.
- Welcome/reset emails are sent through SMTP or dev fallback.

**Connection status**

- RH admin UI/API/DB: connected.
- Profile avatar update: connected.
- Personal info settings UI: only partially connected.

**Current status**

- RH administration is mostly operational.
- End-user profile editing is partially wired.

**Important issues**

- `app/dashboard/settings/page.tsx` saves personal info (`name`, `email`, `phone`) only to localStorage via `user_profile`; it does not call the profile API. This is a UI-only fake save for those fields.
- The settings page does use the backend for avatar and password, but not for the rest of the profile.
- `GET /api/employees` computes `onLeave` as "has any approved leave request ever", not "currently on leave". This makes leave status semantically incorrect.
- Employee deletion only removes some dependent records. The schema also contains tasks, projects, conversations, messages, message reads, skills, and evaluations linked to employees, so deletion can become fragile as data grows.
- Account creation/reset emails use `.../login` as the login URL, but the actual login page is `/`.

### 4.5 Projects Module

**Purpose**

Managers create projects, assign team members, track project progress, and collaborate on tasks. RH can view projects and has special approval authority over manager changes to RH-created projects.

**Key files**

- `app/api/projects/route.ts`
- `app/api/projects/[id]/route.ts`
- `app/api/projects/[id]/approve/route.ts`
- `app/dashboard/projects/page.tsx`
- `app/dashboard/projects/[id]/page.tsx`

**What exists**

- Project listing with role-based visibility.
- Project creation by CHEF.
- Team assignment.
- Project update and delete routes.
- Project change-history model.
- Special approval mechanism when a CHEF edits an RH-created project.

**How it works technically**

- `GET /api/projects` lists projects by role.
- `GET /api/projects?projectId=...` is the actual project detail read path.
- `PATCH /api/projects/[id]` updates directly for RH or own-manager projects.
- If a manager edits an RH-created project, the route stores a `ProjectChangeHistory` entry instead of mutating the project immediately.
- `POST /api/projects/[id]/approve` lets RH approve or reject a pending change request.

**Connection status**

- Core list/detail/create flows: connected.
- RH approval flow for pending project changes: backend-only / partial.

**Current status**

- Manager project creation and basic editing are operational.
- RH approval flow exists in backend but is not surfaced in a finished frontend workflow.

**Important issues**

- There is no `GET /api/projects/[id]`; the detail page uses the unusual query-based endpoint `/api/projects?projectId=...`.
- `lib/services/api.ts` expects `GET /api/projects/[id]` and `PUT /api/projects/[id]`, but the real route implements `PATCH` and no `GET`. That service is stale.
- I did not find a frontend screen that fetches or manages `/api/projects/[id]/approve`, so pending manager changes to RH-created projects can accumulate without a visible RH review UI.
- RH-created project creation flow does not appear in current UI, even though the backend logic anticipates RH-created projects.

### 4.6 Tasks / Kanban Module

**Purpose**

Allow teams to create tasks inside projects, move them across statuses, review submitted work, and derive project progress from completed tasks.

**Key files**

- `app/api/projects/[id]/tasks/route.ts`
- `app/api/projects/[id]/tasks/review/route.ts`
- `app/api/tasks/route.ts`
- `app/dashboard/projects/[id]/page.tsx`

**What exists**

- Project-detail Kanban board with `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`.
- Role-specific task creation and movement rules.
- Review submission through `submittedForReview`.
- Manager review flow accepting tasks or requesting revision.
- Notification side effects for assignment, review, and deadlines.

**How it works technically**

- `PATCH /api/projects/[id]/tasks` is overloaded:
  - with `taskId` => update task status
  - without `taskId` => create new task
- `PATCH /api/projects/[id]/tasks/review` handles manager review.
- Project progress is recalculated from done-task count after task mutations.

**Connection status**

- Frontend: connected through project detail page.
- Backend: connected.
- Database: connected.
- Shared service abstraction: not connected / stale.

**Current status**

- Core Kanban/task flow is operational for project detail page.
- Legacy generic task API is only partially relevant.

**Important issues**

- The route uses `PATCH` for both create and update, while `lib/services/api.ts` expects `POST` and `PUT`. That service layer is outdated.
- There is no dedicated `GET /api/projects/[id]/tasks`; project detail relies on project detail data including tasks.
- In `app/dashboard/projects/[id]/page.tsx`, the frontend drag permission for CHEF checks whether the manager is in `project.team`, which is usually false. This can block dragging in the UI even though the backend would allow it.
- Task creation is allowed for collaborators, but only for self-assignment. This is functional, but it should be considered a product choice because it lets collaborators add project tasks directly.
- `app/api/tasks/route.ts` is a generic legacy endpoint not clearly used by the main project UI.

### 4.7 AI Task Generation Module

**Purpose**

Generate project tasks from project description and team composition.

**Key files**

- `app/api/projects/[id]/generate-tasks/route.ts`
- `app/dashboard/projects/[id]/page.tsx`

**What exists**

- Manager-only generation request to Groq.
- Preview/edit UI before saving generated tasks.
- Persistence of accepted generated tasks into `Task`.

**Connection status**

- Frontend: connected.
- Backend: connected.
- Database: connected.
- External AI dependency: required.

**Current status**

- Operational when `GROQ_API_KEY` is present and the Groq response format is valid.
- Partial because reliability depends on unstructured model output.

**Important issues**

- Response parsing is fragile and assumes the model returns valid raw JSON.
- Due date validation is shallow; the prompt requests a date range but the backend does not strongly enforce it.
- The feature cannot function offline or without Groq quota.

### 4.8 Chat / Messaging Module

**Purpose**

Provide internal direct/group chat with unread counts and real-time delivery.

**Key files**

- `server.ts`
- `app/api/conversations/route.ts`
- `app/api/conversations/[id]/messages/route.ts`
- `app/api/conversations/[id]/read/route.ts`
- `app/api/employees/chat/route.ts`
- `app/dashboard/chat/page.tsx`
- `components/global-message-handler.tsx`
- `components/message-notification-popup.tsx`

**What exists**

- Conversation listing with unread counts.
- Private and group conversation creation.
- Paginated message loading.
- Read tracking via `MessageRead`.
- Real-time send/receive via Socket.IO + Kafka.
- Unread badge in sidebar and popup notifications.

**How it works technically**

- The client emits `send_message` over Socket.IO.
- `server.ts` validates conversation membership, then publishes to Kafka.
- Kafka consumer persists the message to PostgreSQL and emits to recipient/sender sockets.
- The messaging UI separately fetches conversations and message history over REST.

**Connection status**

- Frontend: connected.
- Backend: connected.
- Database: connected.
- Infrastructure: connected, but tightly coupled to Kafka availability.

**Current status**

- Core chat is operational.
- Notification/read-sync behavior is mixed but mostly working.

**Important issues**

- Startup depends on Kafka; there is no graceful non-Kafka fallback.
- `server.ts` duplicates logic that also exists in `lib/services/server/chat.service.ts`, but the service class is not the actual runtime path.
- Message notifications use title `"Nouveau message"` and are intentionally filtered out of `/api/notifications`; unread message status is instead derived from conversations. This split is coherent but easy to misunderstand.
- Some read-marking logic exists in both message fetch and explicit read route, increasing complexity.

### 4.9 Notifications Module

**Purpose**

Store and expose non-chat notifications and support real-time refresh behavior.

**Key files**

- `app/api/notifications/route.ts`
- `app/api/notifications/[id]/read/route.ts`
- `components/navigation.tsx`
- `lib/notification-context.tsx`
- `lib/contexts/notification.context.tsx`

**What exists**

- List notifications for current user.
- Mark as read.
- Clear all.
- Bell dropdown and optimistic UI updates.

**Connection status**

- Frontend: connected.
- Backend: connected.
- Database: connected.

**Current status**

- Operational.

**Important issues**

- There are duplicate notification context implementations:
  - `lib/notification-context.tsx`
  - `lib/contexts/notification.context.tsx`
- Both files currently contain the same logic, which is maintenance debt.

### 4.10 Audit Module

**Purpose**

Track important mutations for HR visibility.

**Key files**

- `lib/audit.ts`
- `app/api/audit-logs/route.ts`
- `app/dashboard/audit/page.tsx`

**What exists**

- Audit entries are written during request, project, employee, and task mutations.
- RH can view paginated logs and filter by entity and actor name.

**Connection status**

- Frontend: connected.
- Backend: connected.
- Database: connected.

**Current status**

- Operational.

**Important issues**

- Logging coverage is selective rather than complete.
- Failure to log is swallowed in `lib/audit.ts`, which prevents user-facing failures but may hide missing audit records.

### 4.11 Settings / Preferences Module

**Purpose**

Provide account settings, profile avatar, password, notifications preferences, theme, and RH SLA settings.

**Key files**

- `app/dashboard/settings/page.tsx`
- `app/api/employees/profile/route.ts`
- `app/api/auth/password/route.ts`
- `app/api/sla-config/**`

**What exists**

- Avatar upload/delete using base64 persistence into `Employee.avatar`.
- Password change API.
- Theme and notification preferences in localStorage.
- RH-only SLA settings tab.

**Connection status**

- Avatar: fully connected.
- Password: backend exists, UI partially checks it.
- Notification preferences/theme: local-only.
- Personal info editing: local-only.

**Current status**

- Mixed: some settings are real backend features; others are frontend-only preferences.

**Important issues**

- The password form always shows success toast after `fetch`, because it does not check `res.ok`.
- Personal info edit/save does not persist to the database.

### 4.12 Modeled But Not Implemented Domains

The Prisma schema includes the following domains without corresponding current UI/API coverage:

- Skills and employee skill mapping.
- Positions and required skill mapping.
- Evaluations and evaluation objectives.

These are database-level scaffolds today, not active product modules.

## 5. Completed Features

The following are substantially operational in the current codebase:

- JWT login/logout and current-user restoration.
- Client OTP flow and device remembrance.
- Employee request creation for collaborators.
- Manager and RH request approval/rejection flow.
- Request history/timeline rendering.
- RH user management: create, edit, delete, reset password.
- Avatar upload/delete.
- Project creation and listing with role-based access.
- Project detail with task Kanban board.
- Task creation, status progression, and manager review.
- AI task generation preview/save flow.
- Real-time chat with conversation list, unread counts, and message persistence.
- Notification dropdown for non-chat notifications.
- RH audit log view.
- RH SLA configuration and monthly breach statistics UI.

## 6. Partially Completed Features

- OTP / MFA:
  - UX exists.
  - Backend enforcement does not.

- Draft request workflow:
  - Draft creation and listing exist.
  - Draft-to-submitted transition after later editing is broken because `submitRequest()` is a no-op.

- Project approval flow for RH-owned projects:
  - Backend routes and data model exist.
  - No clear frontend review workflow is wired.

- Settings:
  - Avatar and password are real.
  - Personal info edit screen is mostly local-only.

- Task service abstraction:
  - Some helper/service files exist.
  - Real UI uses direct `fetch` against a different contract.

- Leave status in employee listing:
  - Display exists.
  - Semantics are inaccurate because it does not check actual leave dates.

## 7. Features Not Yet Implemented

- End-to-end evaluations workflow.
- End-to-end skills management workflow.
- End-to-end positions/required skills workflow.
- Real backend-enforced MFA state.
- Full RH UI for approving/rejecting project change requests.
- Proper persisted personal profile editing beyond avatar.
- Formal automated test coverage.
- Schema-backed structured request forms for leave dates, loan amount, document subtype, etc.

## 8. Known Bugs, Fragile Flows, And Incomplete Behaviors

### 8.1 Security / Access Bugs

- OTP is not enforced at API or socket layer after login.
- RH OTP bypass path reduces second-factor guarantees.

### 8.2 Request Workflow Bugs

- Editing a draft and then submitting it from `app/dashboard/new-request/page.tsx` does not truly submit it.
- Request title/description storage inside `comment` is fragile and non-normalized.

### 8.3 SLA Bugs

- Cron logic filters the wrong statuses and likely misses the exact requests that should be checked.
- `initCron()` can be called from multiple places.

### 8.4 Project / Task Bugs

- Stale service methods use the wrong HTTP methods for project and task routes.
- CHEF drag permission in the project detail UI is stricter than backend authorization and can block legitimate manager actions.

### 8.5 User/Profile Bugs

- Settings page personal info save is not persistent.
- Password change UI does not validate backend success before showing success toast.
- Employee `onLeave` flag is historically cumulative rather than date-aware.
- Employee deletion may break once more relational data is present.

### 8.6 General Technical Fragility

- `next.config.mjs` ignores TypeScript build errors.
- There are duplicate helper/context files for the same concerns.
- Multiple mojibake/encoding issues are visible in hardcoded French strings and email templates.
- The custom server and service layer duplicate some messaging logic.

## 9. Schema / Migration / Database Consistency Notes

### 9.1 Schema vs Runtime Usage

- `Request` has fields like `reason`, `startDate`, `endDate`, `amount`, and `documentType`, but the main UI and APIs mostly do not use them.
- `Employee` includes OTP fields that are used.
- `Task.submittedForReview`, `reviewComment`, `reviewedById`, and `reviewedAt` are used.
- `ProjectChangeHistory` is used.
- `Skill`, `Position`, and `Evaluation` families are currently unused in runtime flows.

### 9.2 Migration State

- `prisma.config.ts` points to `prisma/migrations`.
- The repository currently has no `prisma/migrations/` folder.
- This means the schema may be authoritative, but database evolution history is not tracked in-repo at the moment.

### 9.3 Seed Consistency

- `prisma/seed.ts` creates demo RH, two managers, collaborators, and SLA defaults.
- Seed data matches currently active roles and request types.

### 9.4 Data Modeling Notes

- Request content should likely be normalized into explicit fields instead of parsed string blobs.
- `Project.priority` is a `String`, while task priority is an enum. This is workable but inconsistent.
- Delete flows do not yet fully reflect all relational dependencies implied by the schema.

## 10. Role And Permission Behavior By User Type

### 10.1 `COLLABORATEUR`

- Can log in and chat with RH and their manager.
- Can create requests and save drafts.
- Can view only their own requests.
- Can view projects where they are on the team.
- Can create tasks on projects they can access, but only assign to themselves.
- Can move only their own tasks, and only `TODO -> IN_PROGRESS -> IN_REVIEW`.
- Cannot mark tasks directly as `DONE`.
- Cannot access RH admin pages or approval pages.

### 10.2 `CHEF`

- Can access their team via `/api/users/team`.
- Can review team requests and approve/reject manager-stage items.
- Can create projects and assign only their own team members.
- Can access own projects and some projects involving their team.
- Can create/delete tasks for their team and review submitted tasks.
- Can edit projects directly unless the project is RH-created, in which case a change request is generated instead.
- Cannot use RH-only routes such as employee admin, audit logs, or SLA config.

### 10.3 `RH`

- Can view all requests and finalize RH-stage approvals.
- Can create, edit, reset password, and delete employees.
- Can view all projects.
- Can update any project directly.
- Can access audit logs and SLA configuration/stats.
- Is treated as read-only observer in some project UI flows, but the backend still allows project mutation.
- Has special authority over pending project change approvals in backend routes.

## 11. Technical Debt / Cleanup / Refactor Priorities

### High Priority

- Enforce OTP verification server-side for APIs and sockets.
- Fix request draft submission after edit.
- Fix SLA cron filter logic.
- Add real Prisma migrations or document database bootstrap expectations.
- Stop ignoring TypeScript build errors.

### Medium Priority

- Unify around one backend architecture instead of keeping both direct-route and service-layer versions.
- Normalize request content into explicit columns.
- Replace overloaded task route semantics with cleaner REST contracts.
- Build RH UI for pending project change approvals.
- Make settings profile edits actually persist.

### Low / Structural Priority

- Remove duplicate files:
  - `lib/notification-context.tsx` vs `lib/contexts/notification.context.tsx`
  - duplicated auth/prisma/task/format helper variants across `lib/` and `lib/services/` / `lib/utils/`
- Clean up encoding issues in hardcoded UI/email strings.
- Add test coverage for approval flow, task transitions, and chat authorization.

## 12. Suggested Reading Order For Future Developers Or Agents

### 12.1 First Pass: Understand The Real Product

1. `prisma/schema.prisma`
2. `server.ts`
3. `lib/getCurrentUser.ts`
4. `app/dashboard/layout.tsx`
5. `components/sidebar.tsx`

### 12.2 Request Workflow

1. `app/api/requests/route.ts`
2. `app/api/requests/[id]/action/route.ts`
3. `lib/services/request.service.ts`
4. `app/dashboard/new-request/page.tsx`
5. `app/dashboard/my-requests/page.tsx`
6. `app/dashboard/my-approvals/page.tsx`
7. `app/dashboard/approvals/page.tsx`
8. `components/request-card.tsx`

### 12.3 Projects And Tasks

1. `app/api/projects/route.ts`
2. `app/api/projects/[id]/route.ts`
3. `app/api/projects/[id]/tasks/route.ts`
4. `app/api/projects/[id]/tasks/review/route.ts`
5. `app/api/projects/[id]/generate-tasks/route.ts`
6. `app/dashboard/projects/page.tsx`
7. `app/dashboard/projects/[id]/page.tsx`

### 12.4 Chat And Notifications

1. `server.ts`
2. `app/api/conversations/route.ts`
3. `app/api/conversations/[id]/messages/route.ts`
4. `app/dashboard/chat/page.tsx`
5. `components/navigation.tsx`
6. `components/global-message-handler.tsx`

### 12.5 RH Administration And Settings

1. `app/api/employees/route.ts`
2. `app/api/employees/[id]/route.ts`
3. `app/dashboard/users/page.tsx`
4. `app/dashboard/settings/page.tsx`
5. `app/api/audit-logs/route.ts`

## 13. Bottom-Line Assessment

This repository is a functional but uneven full-stack business application. The true implemented product today is:

- a working request/approval portal,
- a working HR user-management console,
- a working project/task board,
- and a working chat system with real-time messaging.

The biggest caution areas are:

- auth/MFA security gaps,
- partially completed draft and project-approval workflows,
- stale duplicate abstractions,
- and schema/features that are modeled but not actually shipped.

Any future work should treat the direct App Router routes plus `server.ts` as the primary source of behavior, and should verify the UI against the real route contracts before building on top of the older service abstractions.
