# ARABSOFT Current Technical Review

Date: 2026-06-02  
Repository reviewed: `c:\Users\baalo\OneDrive\Documents\GitHub\ARABSOFT`  
Previous review compared against: `C:\Users\baalo\Downloads\ARABSOFT_TECHNICAL_INVENTORY.md`

This review was produced from the current codebase, the previous Markdown inventory, and the additional request requiring discovery of new modules that were not listed in the previous review.

# Executive Summary

ARABSOFT is now a much broader HR management platform than the previous inventory described. The core dashboard, request workflows, employee administration, projects, skills, chat, SLA, notifications, and audit modules still exist, but several important subsystems have been added or materially changed:

- Authentication is no longer only client-side OTP gated. The backend now has a real pre-auth cookie, OTP verification route, session cookie issuance after OTP, and signed trusted-device cookies.
- Payslip requests and PDF downloads are now implemented as a document request subtype.
- Salary grades, salary history, bonus rules, bonuses, task performance bonuses, annual bonuses, and payslip calculation are now much closer to a payroll subsystem.
- RH signature upload/drawing/deletion now exists and is embedded into work certificates and payslips.
- RH account transfer, dashboard PDF export, audit Excel export, and a collaborator bonus history page were found as completely new features.
- Skills and task required-skills integration are strong, with good validation and history tracking.
- Project task generation has an AI-backed path and a local fallback with balancing rules.

The largest risks are not UI polish issues. They are operational and data-consistency risks:

- Important Prisma models and fields appear in `prisma/schema.prisma` but are not represented in committed migration files.
- The seed script creates salary grades and bonus rules but does not create salary history rows, which breaks or empties payslip availability for seeded users.
- Rate limiting is currently effectively disabled in `middleware.ts`.
- The build passes, but TypeScript validation is skipped by configuration.
- Some workflows approve a business request before the follow-up artifact is safely generated, especially payslips.
- Some access-control gaps remain, especially evaluation visibility for collaborators and chat recipient handling.

# Verification Run

Commands executed:

| Command | Result | Notes |
|---|---|---|
| `npx prisma validate` | Passed | Schema is syntactically valid. Prisma warns that `package.json#prisma` is deprecated and overridden by `prisma.config.ts`. |
| `npm run build` | Passed | Next.js compiled successfully. TypeScript validation is skipped by `next.config.mjs`. Build output repeatedly registered cron jobs while collecting/generating pages. |

# Recently Modified / Local Worktree Observations

Current working tree observations:

| File | Current local state | Review impact |
|---|---|---|
| `.env.example` | Deleted | This is an onboarding and deployment risk because new required variables are no longer documented. |
| `lib/contexts/auth.context.tsx` | Modified | Login response parsing is more defensive and only parses JSON when the response content type is JSON. |
| `package-lock.json` | Modified | Mostly peer metadata churn. No functional conclusion from the lock diff alone. |

# Comparison With Previous Markdown Review

## Authentication and OTP

Previous review status:
- OTP was described as mostly client-side or weakly enforced.
- Session JWT was reported as issued before OTP.
- Rate limiting was described as present.

Current status:
- Backend OTP enforcement is now real. Login without a trusted device creates a short-lived `pre_auth_token`, not a full session.
- `app/api/auth/verify-otp/route.ts` issues the real session cookie only after OTP verification.
- Trusted-device login uses a signed cookie.
- Rate limiting is currently not active because `rateLimitedPaths` is an empty set in `middleware.ts`.

Files:
- `app/api/auth/login/route.ts`
- `app/api/auth/send-otp/route.ts`
- `app/api/auth/verify-otp/route.ts`
- `app/api/auth/me/route.ts`
- `app/api/auth/logout/route.ts`
- `lib/services/server/auth.service.ts`
- `lib/constants.ts`
- `middleware.ts`
- `components/otp-verification-modal.tsx`
- `lib/contexts/auth.context.tsx`

Assessment:
- Status: Mostly implemented.
- Main remaining fixes: restore rate limiting, add OTP attempt counters/lockout, decide whether logout should clear trusted-device cookies, remove or align redundant localStorage trusted-device markers.

## Employee Administration

Previous review status:
- Employee CRUD, role restrictions, password reset, and manager assignment existed.
- Compensation foundations were present.

Current status:
- Employee create/update now strongly integrates salary grades, salary overrides, salary history, skills initialization, and deletion impact analysis.
- RH creation remains limited to one RH account.
- Employee deletion is much deeper than before and reassigns projects/tasks where possible.

Files:
- `app/api/employees/route.ts`
- `app/api/employees/[id]/route.ts`
- `app/api/employees/[id]/salary/route.ts`
- `app/api/employees/[id]/salary-grade/route.ts`
- `app/dashboard/users/page.tsx`
- `components/users/employee-create-dialog.tsx`
- `components/users/delete-employee-dialog.tsx`
- `lib/services/server/employees.service.ts`
- `lib/services/server/salary-history.service.ts`

Assessment:
- Status: Mostly implemented.
- Main remaining fixes: add migrations/backfill for salary history, avoid hard-delete artifact leftovers, audit salary and deletion-impact operations more consistently.

## Requests, Approvals, and Documents

Previous review status:
- Leave, authorization, document, and loan workflows existed.
- Work certificate generation existed.
- Payslip generation was backend foundation only or unclear.

Current status:
- Requests now include document type validation and payslip period validation.
- `FICHE_PAIE` is a visible document request type.
- RH approval can trigger payslip generation and collaborator download.
- Work certificates use RH signatures.

Files:
- `app/dashboard/new-request/page.tsx`
- `app/dashboard/my-requests/page.tsx`
- `app/dashboard/approvals/page.tsx`
- `components/request-card.tsx`
- `components/request-details-summary.tsx`
- `app/api/requests/route.ts`
- `app/api/requests/[id]/action/route.ts`
- `app/api/requests/[id]/document/route.ts`
- `app/api/payslips/[id]/pdf/route.ts`
- `lib/services/server/request.service.ts`
- `lib/services/server/documents.service.ts`
- `lib/services/server/payslip.service.ts`
- `lib/services/server/payslip-pdf.service.tsx`
- `lib/document-type.ts`
- `lib/validators/request.validators.ts`

Assessment:
- Status: Mostly implemented.
- Main remaining fixes: make payslip generation atomic with approval or add compensation handling, use exact document type checks, add payslip download in request details modal, verify PDF string encoding.

## Compensation, Bonuses, and Evaluations

Previous review status:
- Salary grade and bonus rule foundations were mentioned.
- Salary history was not a real subsystem.
- Manual annual/exceptional bonus endpoints appeared to be part of the design.

Current status:
- Salary history service exists and is used on employee create/update and salary-grade assignment.
- Bonus rules and salary grades are managed through APIs.
- Manual annual and exceptional bonus API routes are intentionally disabled.
- Annual bonuses are created by cron.
- Task approval creates or updates task-based performance bonuses.
- Monthly evaluation cron can create validated evaluations and evaluation-based bonuses.

Files:
- `app/api/salary-grades/route.ts`
- `app/api/salary-grades/[id]/route.ts`
- `app/api/bonus-rules/route.ts`
- `app/api/bonus-rules/[id]/route.ts`
- `app/api/bonuses/annual/route.ts`
- `app/api/bonuses/exceptional/route.ts`
- `app/api/evaluations/route.ts`
- `app/api/employees/[id]/bonuses/route.ts`
- `app/api/employees/[id]/payslips/route.ts`
- `app/dashboard/bonuses/page.tsx`
- `app/dashboard/equipe/page.tsx`
- `lib/services/server/payroll.service.ts`
- `lib/services/server/bonus.service.ts`
- `lib/services/server/salary-history.service.ts`
- `lib/cron/annual-bonus.ts`
- `lib/cron/monthly-evaluation.ts`

Assessment:
- Status: Partially implemented to mostly implemented, depending on submodule.
- Main remaining fixes: add migrations, seed salary history, prevent double-counting performance bonuses, fix collaborator evaluation access, add audit/notification coverage.

## Projects, Tasks, AI Generation, and Review

Previous review status:
- Projects and tasks existed.
- AI generation and review paths were present but required validation.

Current status:
- AI task generation has a Groq-backed mode and a local fallback.
- Generated tasks are balanced against active team members, current leave, progress phase, duplicate titles, and workload.
- Manual task creation supports required technical skills.
- Collaborators submit tasks for review, CHEF reviews with score, and approved tasks can generate performance bonuses.

Files:
- `app/dashboard/projects/page.tsx`
- `app/dashboard/projects/[id]/page.tsx`
- `app/api/projects/route.ts`
- `app/api/projects/[id]/route.ts`
- `app/api/projects/[id]/generate-tasks/route.ts`
- `app/api/projects/[id]/tasks/route.ts`
- `app/api/projects/[id]/tasks/review/route.ts`
- `app/api/tasks/route.ts`
- `app/api/tasks/[id]/submit-review/route.ts`
- `app/api/tasks/[id]/review/route.ts`
- `lib/services/server/projects.service.ts`
- `lib/services/server/tasks.service.ts`
- `lib/tasks.ts`

Assessment:
- Status: Mostly implemented.
- Main remaining fixes: persist required skills for generated tasks if expected, consolidate duplicate review APIs, document AI fallback behavior, audit generated task saves in more detail.

## Skills

Previous review status:
- Skills module existed with employee skill tracking.

Current status:
- Skills are one of the strongest modules.
- RH manages catalog.
- CHEF manages direct team technical skills.
- COLLABORATEUR can view own skill records/history.
- Soft skills are protected from removal and are backfilled.
- Task required skills only accept active technical skills.

Files:
- `app/dashboard/skills/page.tsx`
- `app/api/skills/route.ts`
- `app/api/skills/[id]/route.ts`
- `app/api/skills/employees/route.ts`
- `app/api/employees/[id]/skills/route.ts`
- `lib/skills/service.ts`
- `lib/skills/validation.ts`
- `lib/tasks.ts`

Assessment:
- Status: Mostly implemented.
- Main remaining fixes: implement position/position-skill planning UI or remove unused schema concepts; continue enforcing skill history and archive rules.

## Chat

Previous review status:
- One-to-one and group chat existed.
- Group live fanout was partial.

Current status:
- Socket authentication uses session cookies.
- Direct messages and group conversations are present.
- Kafka and direct fallback both exist.
- Group live fanout is still partial because the client sends a single `recipientId`, and the server emits to that one recipient.

Files:
- `app/dashboard/chat/page.tsx`
- `app/api/conversations/route.ts`
- `app/api/conversations/[id]/messages/route.ts`
- `app/api/conversations/[id]/read/route.ts`
- `lib/services/server/chat.service.ts`
- `lib/services/server/socket.service.ts`
- `lib/hooks/use-unread-count.ts`

Assessment:
- Status: Partially implemented for group real-time behavior.
- Main remaining fixes: emit group messages to all participants, verify socket `recipientId` belongs to the conversation, decide whether chat notifications should be stored/displayed or only use chat badges.

## Notifications, SLA, and Audit

Previous review status:
- Notifications, SLA, and audit logs existed.
- Audit export was not described.
- Dashboard report export was not described.

Current status:
- Notifications are used broadly.
- SLA cron runs every five minutes and escalates/warns/breaches requests.
- Audit log UI now has Excel export.
- Dashboard now has a PDF report export.

Files:
- `app/api/notifications/route.ts`
- `app/api/notifications/[id]/read/route.ts`
- `app/api/sla-config/route.ts`
- `app/api/sla-config/[id]/route.ts`
- `app/api/sla/stats/route.ts`
- `app/api/audit-logs/route.ts`
- `app/api/audit-logs/export/route.ts`
- `app/api/dashboard/report/route.ts`
- `app/dashboard/audit/page.tsx`
- `app/dashboard/page.tsx`
- `lib/services/server/notification.service.ts`
- `lib/services/server/sla.service.ts`
- `lib/services/server/audit.service.ts`
- `lib/services/server/dashboard-report.service.tsx`
- `lib/audit-export.ts`
- `lib/cron.ts`

Assessment:
- Status: Mostly implemented.
- Main remaining fixes: improve audit coverage for new payroll/signature/transfer actions, avoid repeated cron registration during build/static generation, add missing entity filters, document `INIT_SECRET` and cron deployment behavior.

## Newly Discovered Feature: Server-Enforced OTP Pre-Auth and Trusted Device

What it is:
- A backend authentication flow that separates password validation from full session issuance.
- Users who are not on a trusted device receive a pre-auth cookie and must verify an OTP before receiving the real session cookie.

Where it appears:
- Routes: `app/api/auth/login/route.ts`, `app/api/auth/send-otp/route.ts`, `app/api/auth/verify-otp/route.ts`, `app/api/auth/me/route.ts`, `app/api/auth/logout/route.ts`
- Services/constants: `lib/services/server/auth.service.ts`, `lib/constants.ts`
- UI/context: `components/otp-verification-modal.tsx`, `lib/contexts/auth.context.tsx`
- Middleware: `middleware.ts`

How it works:
- `POST /api/auth/login` validates email/password.
- If a signed trusted-device cookie is valid, the server issues the session cookie immediately.
- Otherwise the server sets `pre_auth_token`, clears the normal auth cookie, and returns `nextStep: "otp"`.
- `POST /api/auth/send-otp` sends or reuses a short-lived OTP for the pre-authenticated user.
- `POST /api/auth/verify-otp` verifies the OTP, clears stored OTP fields, issues the real session cookie, optionally sets a signed trusted-device cookie, and clears pre-auth.
- Protected routes call `requireAuth`, which requires a real session token.

Roles involved:
- RH, CHEF, COLLABORATEUR.

Database impact:
- Uses `Employee.otpCode` and `Employee.otpExpiresAt`.
- Login and OTP verification write audit entries through `AuditLog`.
- No new Prisma model is dedicated to OTP attempts or trusted devices.

UI impact:
- Login opens the OTP modal when `nextStep` is `otp`.
- Dashboard access depends on authenticated user state after `GET /api/auth/me`.
- Trusted-device UI still writes localStorage markers, but server trust is based on a signed cookie.

Current status:
- Mostly implemented.

Strong points:
- Session cookie is no longer issued before OTP for untrusted devices.
- Pre-auth token has a short lifetime.
- Trusted-device token is signed and httpOnly.
- `verifySessionToken` and `verifyPreAuthToken` enforce token phase.

Weak points / risks:
- `middleware.ts` rate limiting is disabled because `rateLimitedPaths` is empty.
- OTP verification has no attempt counter or account lockout.
- Logout clears auth/pre-auth cookies but not the trusted-device cookie.
- Client localStorage trusted-device markers are redundant and can confuse maintenance.

Recommended fixes:
- Re-enable rate limits for auth routes.
- Add OTP attempt counters and temporary lockout.
- Decide explicitly whether logout should preserve or clear trusted-device state.
- Remove localStorage trusted-device logic or make it purely cosmetic and documented.

## Newly Discovered Feature: Signed Trusted Device

What it is:
- A remembered-device mechanism that lets users skip OTP after password login when the server accepts a signed trusted-device cookie.

Where it appears:
- Constants: `lib/constants.ts`
- Service: `lib/services/server/auth.service.ts`
- Routes: `app/api/auth/login/route.ts`, `app/api/auth/verify-otp/route.ts`, `app/api/auth/logout/route.ts`
- UI: `components/otp-verification-modal.tsx`

How it works:
- During OTP verification, the user can request that the device be trusted.
- The server signs a trusted-device token and sets it as an httpOnly cookie.
- Future password logins validate that trusted-device token and can issue the normal session cookie without a new OTP step.

Roles involved:
- RH, CHEF, COLLABORATEUR.

Database impact:
- No dedicated trusted-device model exists.
- Trusted-device state is cookie-based, not persisted per device in the database.

UI impact:
- OTP modal exposes the remember/trust device option.
- The modal also writes localStorage markers, but the real server decision is based on the signed cookie.

Current status:
- Mostly implemented.

Strong points:
- The trusted-device token is signed and httpOnly.
- The mechanism reduces friction without issuing a full session before OTP on first use.

Weak points / risks:
- No server-side trusted-device registry means devices cannot be individually revoked.
- Logout does not clear the trusted-device cookie.
- Redundant localStorage markers make the behavior harder to reason about.

Recommended fixes:
- Decide whether trusted devices should survive logout.
- Add server-side trusted-device records if revocation/audit is required.
- Remove redundant client trusted-device persistence.

## Newly Discovered Feature: Payslip Document Requests and PDF Downloads

What it is:
- A user-facing workflow where a collaborator requests a payslip as a document request, RH approves it, and the system generates a downloadable PDF payslip.

Where it appears:
- Routes: `app/api/requests/route.ts`, `app/api/requests/[id]/action/route.ts`, `app/api/payslips/[id]/pdf/route.ts`, `app/api/employees/[id]/payslips/route.ts`
- Services: `lib/services/server/request.service.ts`, `lib/services/server/payslip.service.ts`, `lib/services/server/payslip-pdf.service.tsx`, `lib/services/server/employees.service.ts`
- UI: `app/dashboard/new-request/page.tsx`, `app/dashboard/my-requests/page.tsx`, `app/dashboard/approvals/page.tsx`, `components/request-card.tsx`, `components/request-details-summary.tsx`
- Schema: `Payslip`, `PayslipPeriodType`, `Request.documentType`, `Request.reason`, `Request.payslip`

How it works:
- Collaborator chooses document request type `FICHE_PAIE`.
- UI fetches available monthly/annual periods from employee salary history and existing payslips.
- The request stores the requested period in `Request.reason` as `MONTHLY:YYYY-MM` or `ANNUAL:YYYY`.
- RH approves the request.
- The request service validates salary history and duplicate payslips.
- `payslipService.generatePayslip` creates a `Payslip` record.
- `GET /api/payslips/[id]/pdf` generates a PDF on demand with `@react-pdf/renderer`.

Roles involved:
- COLLABORATEUR requests and downloads own payslip.
- RH approves and can download.
- CHEF can download for direct team member in the payslip PDF authorization service.

Database impact:
- New/active schema objects: `Payslip`, `PayslipPeriodType`, `SalaryHistory`, `Bonus`, `SalaryGrade`.
- `Request` now carries document subtype and payslip period information.
- `Payslip` has unique constraints on request and employee/period/periodType.

UI impact:
- New request form has period type and period select for payslips.
- Request cards can show a payslip download action after approval.
- RH approval copy distinguishes payslip approval/generation.

Current status:
- Mostly implemented.

Strong points:
- Duplicate payslip prevention exists at service and schema levels.
- Payslip availability is based on salary history and already generated periods.
- Access control covers RH, owner, and direct manager.
- PDF generation is separated into a dedicated service.

Weak points / risks:
- No committed migration was found for `Payslip`, `PayslipPeriodType`, `SalaryHistory`, `SalaryGrade`, `Bonus`, or related tables.
- Seed data does not create `SalaryHistory`, so seeded employees may have no available payslip periods.
- Payslip generation happens after the approval transaction, so a request can become approved even if PDF/payroll record generation fails.
- `request.service.ts` triggers payslip generation for every non-attestation document type instead of checking exactly `FICHE_PAIE`.
- Request details summary only checks `generatedDocument`, so the modal can miss the payslip download action.
- PDF net salary calculation is simplified and does not model taxes/deductions.

Recommended fixes:
- Add and commit Prisma migrations for all payroll/payslip schema changes.
- Backfill salary history in migrations or seed.
- Make approval and payslip creation one atomic business workflow, or add a compensating failed-generation status.
- Change the trigger condition to `documentType === "FICHE_PAIE"`.
- Update request details UI to support `request.payslip`.
- Document the simplified payroll formula or implement statutory deductions if needed.

## Newly Discovered Feature: Payslip PDF Route and On-Demand Rendering

What it is:
- A dedicated authorized route and PDF renderer for payslip downloads.

Where it appears:
- Route: `app/api/payslips/[id]/pdf/route.ts`
- Service: `lib/services/server/payslip-pdf.service.tsx`
- Helpers: `lib/payslip.ts`, `lib/utils/get-rh-signature.ts`
- Schema: `Payslip`, `Bonus`, `SalaryGrade`, `Employee`

How it works:
- The payslip record is fetched with employee, salary grade, request, and bonus details.
- Authorization allows RH, the employee owner, or the direct CHEF manager.
- The PDF is rendered on demand using `@react-pdf/renderer`.
- The route returns a PDF response with a generated filename.

Roles involved:
- RH, CHEF for direct team, COLLABORATEUR owner.

Database impact:
- Reads payslip and related compensation records.
- Does not persist the rendered PDF file.

UI impact:
- Request cards open the PDF route in a new tab for approved payslip requests.

Current status:
- Mostly implemented.

Strong points:
- Access control is handled server-side.
- On-demand rendering avoids stale stored PDFs when display templates change.
- RH signature can be embedded.

Weak points / risks:
- Rendering depends on correct salary history and bonus data.
- Net salary formula is simplified.
- Some generated PDF strings should be checked for encoding.

Recommended fixes:
- Add PDF rendering tests for monthly and annual payslips.
- Verify generated French text encoding.
- Document or improve the payroll formula.

## Newly Discovered Feature: Salary History Synchronization

What it is:
- A service-level salary history system that records salary grade and override changes over time and feeds payslip period availability and calculations.

Where it appears:
- Service: `lib/services/server/salary-history.service.ts`
- Employee service integration: `lib/services/server/employees.service.ts`
- Payroll/payslip consumers: `lib/services/server/payslip.service.ts`, `lib/services/server/bonus.service.ts`
- Routes: `app/api/employees/[id]/salary-grade/route.ts`, `app/api/employees/[id]/salary/route.ts`
- Schema: `SalaryHistory`, `SalaryGrade`, `Employee.salaryHistory`, `Employee.salaryGradeId`, `Employee.salaryOverride`, `Employee.hireDate`

How it works:
- Employee creation calls `createInitialSalaryHistory`.
- Compensation changes close the current open record and create a new salary history row.
- Payslip period availability scans salary history.
- Annual and monthly calculations resolve salary by salary history period.

Roles involved:
- RH creates employees, assigns grades, and changes salary.
- CHEF can view salary data for direct team in some team views.
- COLLABORATEUR indirectly depends on history for payslip requests.

Database impact:
- Adds temporal compensation records with `validFrom` and `validTo`.
- Depends on `SalaryGrade` and optional salary override.
- Requires historical backfill for existing employees.

UI impact:
- Salary grades and overrides appear in employee create/edit flows.
- Team view can show salary details.
- There is no dedicated salary history timeline UI.

Current status:
- Partially implemented.

Strong points:
- Centralized service avoids recalculating salary history ad hoc.
- Employee role and grade role are validated.
- Payslip generation no longer depends only on current salary.

Weak points / risks:
- No committed migration was found for salary history/grade tables.
- Seed script does not create salary history rows.
- Existing employees need a backfill path.
- Salary grade numeric validation is weak; negative or nonsensical values can pass through some paths.
- Salary history changes are not clearly audited.

Recommended fixes:
- Commit migrations and a backfill migration/script.
- Seed salary history for demo users.
- Add stricter validation for base salary, level, and override.
- Add audit entries for compensation changes.
- Add a read-only salary history UI for RH and optionally CHEF.

## Newly Discovered Feature: RH Signature Management

What it is:
- An RH-only signature upload/draw/delete system used by generated work certificates and payslip PDFs.

Where it appears:
- Route: `app/api/rh/signature/route.ts`
- Service: `lib/services/server/signature.service.ts`
- UI: `app/dashboard/settings/page.tsx`, `components/ui/signature-pad.tsx`, `components/ui/signature-uploader.tsx`
- Document integration: `lib/documents/work-certificate.ts`, `lib/utils/get-rh-signature.ts`, `lib/services/server/payslip-pdf.service.tsx`
- Schema: `Employee.signatureUrl`
- Dependency: `@imgly/background-removal-node`

How it works:
- RH uploads or draws a signature in settings.
- Server accepts the file, attempts background removal, stores a PNG under `public/signatures`, and updates `Employee.signatureUrl`.
- Generated documents read the RH signature and embed it as a data URL.
- RH can delete the signature, clearing the file and DB reference.

Roles involved:
- RH only for management.
- COLLABORATEUR and CHEF can see the resulting signature inside authorized generated documents.

Database impact:
- Adds `Employee.signatureUrl`.
- Stores generated file paths outside the database.

UI impact:
- RH settings includes signature preview, upload/draw, and delete actions.
- Generated certificates/payslips include the RH signature or a placeholder.

Current status:
- Mostly implemented.

Strong points:
- Signature logic is centralized.
- Generated documents do not need to know the upload details.
- Background removal fallback supports PNG originals.

Weak points / risks:
- No committed migration was found for `Employee.signatureUrl`.
- No explicit file size or image dimension validation was found.
- Background removal can be CPU/memory heavy.
- Signature upload/delete does not appear to write audit logs.
- Non-PNG fallback can fail if background removal fails.

Recommended fixes:
- Add migration for `signatureUrl`.
- Enforce file size, MIME, dimensions, and timeout limits.
- Add audit logs for upload/delete.
- Add a safer fallback path for JPEG/WebP if background removal fails.

## Newly Discovered Feature: RH Account Transfer

What it is:
- A destructive RH account handoff workflow that changes the current RH employee row to a new email/name/phone/password and clears personal artifacts.

Where it appears:
- Route: `app/api/rh/transfer/route.ts`
- Service: `lib/services/server/rh-settings.service.ts`
- UI: `app/dashboard/settings/page.tsx`
- Email service dependency: `lib/services/server/email.service.ts`
- Schema impacted: `Employee`, `Notification`, `Message`, `MessageRead`, `Payslip`, `GeneratedDocument`, conversations

How it works:
- Current RH enters new RH identity and current password.
- Service verifies current password, email uniqueness, and RH role.
- A temporary password is generated and emailed.
- The same employee row is updated to the new identity.
- RH-related messages, notifications, payslips, generated docs, conversations, signature reference, and auth-related fields are cleaned.
- The auth cookie is cleared.

Roles involved:
- RH only.

Database impact:
- Reuses the existing RH `Employee.id`.
- Deletes or disconnects several personal records.
- Historical audit entries keep old actor information.

UI impact:
- RH settings includes a transfer form.
- Some transfer text is still English while the rest of the product is mostly French.

Current status:
- Partially implemented.

Strong points:
- Requires current password.
- Checks email uniqueness.
- Clears active authentication state after transfer.

Weak points / risks:
- No audit log for a very sensitive operation.
- Email sending occurs inside the transaction; email failure can roll back DB changes.
- Signature file removal happens after the DB transaction and can fail independently.
- Reusing the same employee id blurs historical identity.
- Cleanup is broad and destructive, but not presented as a formal irreversible operation with audit detail.

Recommended fixes:
- Add mandatory audit log with before/after safe metadata.
- Consider creating a new RH account and deactivating the old one instead of mutating identity.
- Move email send to an outbox/job after commit.
- Add explicit confirmation copy and document exactly what is deleted.

## Newly Discovered Feature: Dashboard PDF Report Export

What it is:
- RH/CHEF export of dashboard performance/SLA metrics as a PDF report.

Where it appears:
- Route: `app/api/dashboard/report/route.ts`
- Service: `lib/services/server/dashboard-report.service.tsx`
- UI: `app/dashboard/page.tsx`
- Audit: `lib/services/server/audit.service.ts`
- Dependency: `@react-pdf/renderer`

How it works:
- RH or CHEF clicks export in the dashboard.
- Server builds report payload scoped by role.
- PDF service renders KPI sections, SLA breach trends, breach by request type, and request status breakdown.
- Route returns a PDF file and logs an audit event.

Roles involved:
- RH sees broad report scope.
- CHEF sees team-scoped data.
- COLLABORATEUR does not use this feature.

Database impact:
- Reads `Request`, `Employee`, `RequestSla`, and audit logs export action.
- No new report model is persisted.

UI impact:
- Dashboard has a PDF export button for RH/CHEF.

Current status:
- Mostly implemented.

Strong points:
- Role-aware report scope.
- Dedicated PDF service.
- Audit event is logged for report export.

Weak points / risks:
- Report focuses mostly on request/SLA data, not all performance dimensions.
- Source/build output suggests some French strings may need encoding verification.
- Static generation triggers cron registration logs repeatedly during build.

Recommended fixes:
- Add project/task/bonus/evaluation sections if this is meant to be a full performance report.
- Verify rendered PDF text encoding.
- Move cron startup away from layout import side effects.

## Newly Discovered Feature: Audit Log Excel Export

What it is:
- RH-only export of audit logs as an Excel-compatible XML spreadsheet.

Where it appears:
- Route: `app/api/audit-logs/export/route.ts`
- UI: `app/dashboard/audit/page.tsx`
- Export helper: `lib/audit-export.ts`
- Audit service: `lib/services/server/audit.service.ts`

How it works:
- RH opens audit page and chooses all logs or filtered logs.
- Route queries audit logs with optional filters/search.
- Helper serializes rows into XML spreadsheet format.
- Export action logs an `EXPORT_EXCEL` audit event.

Roles involved:
- RH only.

Database impact:
- Reads `AuditLog`.
- Writes a new `AuditLog` record for the export event.

UI impact:
- Audit page has export dialog and filters.

Current status:
- Mostly implemented.

Strong points:
- Export is RH-only.
- Values are escaped before XML serialization.
- Export action is itself audited.

Weak points / risks:
- Entity filter list does not include all new entities/modules.
- Large exports may need streaming or paging limits.
- XML spreadsheet extension is `.xls`; modern clients may warn even if it opens.

Recommended fixes:
- Update entity filters for new modules.
- Add export size caps or async export for large datasets.
- Consider true `.xlsx` generation if needed.

## Newly Discovered Feature: Collaborator Bonus History UI

What it is:
- A collaborator dashboard page showing personal bonus history with month/year filters and totals.

Where it appears:
- Page: `app/dashboard/bonuses/page.tsx`
- Navigation: `lib/constants/nav.ts`
- Dashboard card: `app/dashboard/page.tsx`
- Route: `app/api/employees/[id]/bonuses/route.ts`
- Service: `lib/services/server/employees.service.ts`
- Schema: `Bonus`, `BonusType`

How it works:
- COLLABORATEUR navigates to `/dashboard/bonuses`.
- UI fetches bonuses for the current user.
- Bonuses can be filtered/grouped by period.
- Dashboard home displays current month bonus summary and links to the page.

Roles involved:
- COLLABORATEUR primarily.
- RH and direct CHEF can access employee bonus data through service authorization paths.

Database impact:
- Reads `Bonus` rows tied to employee.
- Bonus rows can be generated by evaluation, task review, or annual cron.

UI impact:
- New sidebar item for collaborators.
- New bonus KPI card on collaborator dashboard.

Current status:
- Fully implemented for read-only collaborator history.

Strong points:
- Clear self-service visibility for bonuses.
- Uses role-aware server authorization.
- Avoids manual bonus editing in the collaborator UI.

Weak points / risks:
- Bonus generation itself lacks full audit/notification coverage.
- Double-counting can occur if task-based and evaluation-based performance bonuses reward the same work.

Recommended fixes:
- Add bonus source explanations in UI.
- Add audit and notification events when bonuses are generated.
- Define a single performance bonus policy to avoid duplicate incentives.

## Newly Discovered Feature: Automatic Annual Bonus Cron

What it is:
- A scheduled year-end job that creates annual bonuses automatically.

Where it appears:
- Cron: `lib/cron/annual-bonus.ts`
- Registration: `app/layout.tsx`
- Service: `lib/services/server/bonus.service.ts`
- Disabled manual route: `app/api/bonuses/annual/route.ts`
- Schema: `Bonus`, `BonusType.ANNUAL`, `SalaryHistory`

How it works:
- Cron is scheduled for December 31 at 23:59.
- Service scans employees and salary history.
- Each worked month contributes a percentage of resolved monthly salary.
- Duplicate employee/type/period annual bonuses are avoided.
- Manual annual bonus endpoint returns a forbidden response because generation is automatic.

Roles involved:
- System/cron.
- RH indirectly owns payroll governance.

Database impact:
- Creates `Bonus` rows of type `ANNUAL`.
- Depends on salary history accuracy.

UI impact:
- Annual bonuses appear in bonus history and payslip bonus breakdowns.

Current status:
- Partially implemented.

Strong points:
- Idempotence checks reduce duplicate annual bonuses.
- Salary history is used instead of only current salary.

Weak points / risks:
- No audit log or notification for generated annual bonuses.
- Cron registration is process-local and appears repeatedly during build/static generation.
- Salary history missing in seed/migrations undermines this feature.
- May generate bonuses for roles that should be excluded unless business rules say otherwise.

Recommended fixes:
- Register cron in a server-only bootstrap path.
- Add audit logs and notifications.
- Confirm eligible roles and employment status rules.
- Add tests around partial-year employment and salary changes.

## Newly Discovered Feature: Task-Based Performance Bonus Creation

What it is:
- A bonus workflow where approved task review scores create or update performance bonuses.

Where it appears:
- Services: `lib/services/server/tasks.service.ts`, `lib/services/server/bonus.service.ts`
- Routes: `app/api/tasks/[id]/review/route.ts`, `app/api/projects/[id]/tasks/review/route.ts`
- UI: `app/dashboard/projects/[id]/page.tsx`
- Schema: `Task.taskScore`, `Task.reviewedAt`, `Bonus`, `BonusType.PERFORMANCE`

How it works:
- Collaborator submits a task for review.
- CHEF approves with a score from 1 to 10.
- Task status becomes `DONE` and review metadata is stored.
- Bonus service computes a performance bonus using salary, priority multiplier, and bonus rule percentage.
- Existing task bonus is updated instead of duplicated.

Roles involved:
- COLLABORATEUR submits work.
- CHEF reviews work.
- RH can see broader payroll/team data.

Database impact:
- Updates `Task`.
- Creates or updates `Bonus` with task-specific reason.
- Reads `BonusRule`, `SalaryHistory`, and salary grade data.

UI impact:
- Project detail page contains task review actions and score input.
- Bonus result is visible later in collaborator bonus history and payslips.

Current status:
- Mostly implemented.

Strong points:
- Good workflow link between task completion and compensation.
- Duplicate task bonuses are avoided through task-specific reason/update logic.
- Priority and score influence amount.

Weak points / risks:
- Monthly evaluation cron may also create performance bonuses from the same task scores, causing policy-level double-counting.
- Two review endpoints exist and should be consolidated.
- Bonus creation lacks audit/notification coverage.

Recommended fixes:
- Decide whether task bonuses and monthly evaluation bonuses are cumulative or mutually exclusive.
- Consolidate task review APIs.
- Add audit logs and notifications for bonus creation/update.

## Newly Discovered Feature: Employee Delete Impact and Reassignment

What it is:
- A safer employee deletion workflow that calculates impact, requires replacement managers where necessary, and cleans related records.

Where it appears:
- Route: `app/api/employees/[id]/route.ts`
- Service: `lib/services/server/employees.service.ts`
- UI: `app/dashboard/users/page.tsx`, `components/users/delete-employee-dialog.tsx`
- Schema impacted: `Employee`, `Project`, `Task`, `Request`, `RequestSla`, `Evaluation`, `Bonus`, `SalaryHistory`, `EmployeeSkill`, `Notification`, chat records

How it works:
- RH asks for delete impact.
- Service reports managed projects, active assigned tasks, and available replacement managers.
- Deletion reassigns projects/tasks where possible.
- Related records are deleted or disconnected.
- Employee row is hard-deleted.

Roles involved:
- RH only.

Database impact:
- Broad deletion and reassignment across many tables.
- Uses hard delete, not soft deactivation.

UI impact:
- Delete dialog can show impact and replacement manager selection.

Current status:
- Mostly implemented.

Strong points:
- Much safer than blind delete.
- Prevents RH self-delete and RH deletion.
- Handles managed projects and active tasks.

Weak points / risks:
- Hard deletion removes historical HR data.
- Generated document files may remain on disk even if DB rows are deleted.
- Some cleanup depends on database cascade behavior, which is risky while migrations are missing.

Recommended fixes:
- Prefer employee deactivation/archival for production HR data.
- Add file cleanup for generated documents.
- Add integration tests for deletion with projects, tasks, requests, bonuses, and chat.

## Newly Discovered Feature: AI Task Generation Fallback and French Guard

What it is:
- AI-assisted project task generation with a local deterministic fallback when Groq is unavailable.

Where it appears:
- Service: `lib/services/server/projects.service.ts`
- Route: `app/api/projects/[id]/generate-tasks/route.ts`
- UI: `app/dashboard/projects/[id]/page.tsx`
- Env/dependency: `GROQ_API_KEY`

How it works:
- CHEF requests generated tasks for a project.
- Service reads team members, existing tasks, leave status, project progress, and requested generation parameters.
- If a Groq key is available, it asks the model for French task proposals.
- If AI is unavailable or invalid, local fallback creates balanced task proposals.
- UI lets CHEF preview/edit/save generated tasks.

Roles involved:
- CHEF primarily.
- RH can have broader project visibility depending on project routes.
- COLLABORATEUR receives assigned generated tasks.

Database impact:
- Preview does not write records.
- Save creates `Task` rows and notifications.

UI impact:
- Project detail page has task generation preview and editable generated task list.

Current status:
- Mostly implemented.

Strong points:
- Local fallback means the feature still works without the AI provider.
- Balancing logic considers leave and workload.
- French output and duplicate title guards are attempted.

Weak points / risks:
- Generated tasks do not appear to persist required skills.
- API key resolution reads `.env` directly as a fallback, which is unusual for server code.
- AI behavior and fallback policy are not documented for admins.

Recommended fixes:
- Persist generated required skills or remove them from expectations.
- Use standard environment loading only.
- Add tests for fallback generation and unavailable team cases.

## Newly Discovered Feature: Environment and Dependency Changes

What it is:
- New runtime dependencies and environment needs introduced by PDF generation, signature background removal, AI generation, cron, and initialization.

Where it appears:
- `package.json`
- `package-lock.json`
- `next.config.mjs`
- `docker-compose.yml`
- `Dockerfile`
- `app/api/init/route.ts`
- `lib/services/server/projects.service.ts`
- `lib/services/server/signature.service.ts`
- Deleted: `.env.example`

How it works:
- `@react-pdf/renderer` supports dashboard and payslip PDFs.
- `@imgly/background-removal-node` supports RH signature cleanup.
- `GROQ_API_KEY` supports AI generation.
- `INIT_SECRET` protects `/api/init`.
- Docker build runs Prisma generate and Next build but does not run migrations.

Roles involved:
- Deployment/admin concern rather than application role concern.

Database impact:
- Missing migrations are the primary database deployment risk.

UI impact:
- Missing env documentation affects whether features work in deployed UI.

Current status:
- Foundation only.

Strong points:
- Dependencies match real features.
- Docker build path exists.

Weak points / risks:
- `.env.example` is deleted.
- `docker-compose.yml` does not document all observed required variables.
- TypeScript build errors are ignored.
- Next.js warns that `middleware` convention is deprecated in favor of `proxy`.

Recommended fixes:
- Restore `.env.example`.
- Add all required variables with safe placeholders.
- Stop ignoring TypeScript errors in production builds.
- Plan migration from `middleware.ts` to Next's newer `proxy` convention.

# Completely New Features Found Since Last Review

| New feature/module | Files involved | Description | Status | Main risk/fix |
|---|---|---|---|---|
| Server-enforced OTP pre-auth | `app/api/auth/login/route.ts`, `app/api/auth/verify-otp/route.ts`, `lib/services/server/auth.service.ts`, `middleware.ts` | Password login now creates pre-auth until OTP verification. | Mostly implemented | Restore rate limiting and OTP attempt lockout. |
| Signed trusted device | `lib/services/server/auth.service.ts`, `lib/constants.ts`, `components/otp-verification-modal.tsx` | Trusted-device cookie can skip OTP after password login. | Mostly implemented | Clarify logout behavior and remove redundant localStorage markers. |
| Payslip document request | `app/dashboard/new-request/page.tsx`, `lib/services/server/request.service.ts`, `lib/services/server/payslip.service.ts` | Collaborator can request `FICHE_PAIE` by period. | Mostly implemented | Add migrations and atomic generation. |
| Payslip PDF route | `app/api/payslips/[id]/pdf/route.ts`, `lib/services/server/payslip-pdf.service.tsx` | Authorized PDF download for generated payslip. | Mostly implemented | Verify encoding and salary formula. |
| Salary history service | `lib/services/server/salary-history.service.ts`, `lib/services/server/employees.service.ts` | Tracks compensation changes over time. | Partially implemented | Add migrations, seed/backfill, and audit. |
| RH signature management | `app/api/rh/signature/route.ts`, `lib/services/server/signature.service.ts`, `components/ui/signature-uploader.tsx` | RH uploads/draws signature for generated documents. | Mostly implemented | Add migration, file limits, and audit. |
| RH account transfer | `app/api/rh/transfer/route.ts`, `lib/services/server/rh-settings.service.ts`, `app/dashboard/settings/page.tsx` | Transfers RH identity and clears personal artifacts. | Partially implemented | Add audit and reconsider mutating existing identity. |
| Dashboard PDF report export | `app/api/dashboard/report/route.ts`, `lib/services/server/dashboard-report.service.tsx`, `app/dashboard/page.tsx` | RH/CHEF can export SLA/dashboard PDF. | Mostly implemented | Broaden metrics and move cron startup side effects. |
| Audit Excel export | `app/api/audit-logs/export/route.ts`, `lib/audit-export.ts`, `app/dashboard/audit/page.tsx` | RH exports audit logs to Excel-compatible XML. | Mostly implemented | Update entity filters and cap large exports. |
| Collaborator bonus history page | `app/dashboard/bonuses/page.tsx`, `lib/constants/nav.ts`, `app/api/employees/[id]/bonuses/route.ts` | Collaborator sees personal bonus history. | Fully implemented | Explain bonus source and avoid double-count policy. |
| Automatic annual bonus cron | `lib/cron/annual-bonus.ts`, `lib/services/server/bonus.service.ts`, `app/layout.tsx` | Year-end automatic annual bonus generation. | Partially implemented | Add audit/notification and stable cron bootstrap. |
| Task-based performance bonus | `lib/services/server/tasks.service.ts`, `lib/services/server/bonus.service.ts`, `app/api/tasks/[id]/review/route.ts` | Approved task scores create/update bonuses. | Mostly implemented | Prevent double-count with monthly evaluation bonus. |
| Employee delete impact | `components/users/delete-employee-dialog.tsx`, `lib/services/server/employees.service.ts` | RH sees impact and reassigns work before delete. | Mostly implemented | Prefer deactivation and remove orphan files. |
| AI task fallback and balancing | `lib/services/server/projects.service.ts`, `app/api/projects/[id]/generate-tasks/route.ts` | AI/local generated tasks balanced across team. | Mostly implemented | Persist required skills and document fallback. |
| Environment/dependency module changes | `package.json`, `docker-compose.yml`, `next.config.mjs`, `.env.example` | New PDF/signature/AI/init requirements. | Foundation only | Restore `.env.example` and stop skipping type checks. |

# Database Schema and Migration Review

Current important Prisma schema areas:

| Area | Models/enums/fields | Status |
|---|---|---|
| Employees | `Employee`, `Role`, `signatureUrl`, `hireDate`, `leaveBalance`, `salaryGradeId`, `salaryOverride` | Implemented in schema. Migration coverage appears incomplete for newer fields. |
| Requests | `Request`, `RequestType`, `RequestStatus`, `RequestHistory`, `RequestSla`, `GeneratedDocument`, `Payslip` | Core request migrations exist; payslip-related migration appears missing. |
| Payroll | `SalaryGrade`, `SalaryHistory`, `BonusRule`, `Bonus`, `BonusType`, `Payslip`, `PayslipPeriodType` | Present in schema and services; committed migrations were not found for several of these objects. |
| Skills | `Skill`, `EmployeeSkill`, `EmployeeSkillHistory`, `Position`, `PositionSkill` | Skills are implemented; position planning appears schema-only. |
| Projects/tasks | `Project`, `Task`, required skills join, review fields | Implemented. |
| Chat | `Conversation`, `Message`, `MessageRead` | Implemented. |
| Audit/notifications/SLA | `AuditLog`, `Notification`, `SlaConfig`, `RequestSla` | Implemented. |

Critical migration concern:
- Searches of `prisma/migrations` did not find committed migration definitions for key current schema additions such as `SalaryGrade`, `SalaryHistory`, `BonusRule`, `Bonus`, `Payslip`, `PayslipPeriodType`, and `Employee.signatureUrl`.
- `prisma/seed.ts` inserts salary grades and bonus rules, so a fresh database migrated only from committed migrations is likely to fail unless those tables were created by `prisma db push` or an uncommitted/manual migration.

Seed concern:
- `prisma/seed.ts` uses a default demo password when `SEED_PASSWORD` is not provided. This is acceptable only for local/demo environments and should be loudly documented.
- The seed inserts salary grades and bonus rules but does not insert salary history. Payslip availability and salary-history-based bonuses can fail or show no periods for seeded users.

# API Routes and Services Review

| Module | Routes/services | Status | Key notes |
|---|---|---|---|
| Auth | `/api/auth/login`, `/send-otp`, `/verify-otp`, `/me`, `/logout`, `auth.service.ts` | Mostly implemented | Real OTP pre-auth exists; rate limiting disabled. |
| Employees | `/api/employees/*`, `employees.service.ts` | Mostly implemented | Good role restrictions; salary history integration; hard delete risk. |
| Requests | `/api/requests/*`, `request.service.ts` | Mostly implemented | Payslip validation added; generation atomicity risk. |
| Documents | `/api/requests/[id]/document`, `documents.service.ts` | Mostly implemented | Work certificates use RH signature. |
| Payslips | `/api/payslips/[id]/pdf`, `payslip.service.ts`, `payslip-pdf.service.tsx` | Mostly implemented | Needs migrations/backfill and payroll formula clarity. |
| Payroll | `/api/salary-grades`, `/api/bonus-rules`, `payroll.service.ts` | Partially implemented | APIs exist; weak numeric validation; missing migration risk. |
| Bonuses | `/api/employees/[id]/bonuses`, disabled `/api/bonuses/*`, `bonus.service.ts` | Partially implemented | Automatic/task/evaluation bonuses exist; audit missing. |
| Evaluations | `/api/evaluations`, `monthly-evaluation.ts` | Partially implemented | Collaborator access appears too broad. |
| Projects/tasks | `/api/projects/*`, `/api/tasks/*`, `projects.service.ts`, `tasks.service.ts` | Mostly implemented | Strong workflow; duplicate review APIs; generated required skills gap. |
| Skills | `/api/skills/*`, `/api/employees/[id]/skills`, `lib/skills/*` | Mostly implemented | Strong validation and history. |
| Chat | `/api/conversations/*`, `chat.service.ts`, `socket.service.ts` | Partially implemented | Group live fanout still partial. |
| Notifications | `/api/notifications/*`, `notification.service.ts` | Mostly implemented | Chat notifications filtered from dropdown by design. |
| SLA | `/api/sla-config`, `/api/sla/stats`, `sla.service.ts`, `lib/cron.ts` | Mostly implemented | Process-local cron; build-time side effects. |
| Audit | `/api/audit-logs`, `/api/audit-logs/export`, `audit.service.ts` | Mostly implemented | Export added; new entity filters incomplete. |
| RH settings | `/api/rh/signature`, `/api/rh/transfer`, signature/RH settings services | Partially implemented | Sensitive operations need stronger audit and migration support. |
| Dashboard report | `/api/dashboard/report`, `dashboard-report.service.tsx` | Mostly implemented | New PDF export, request/SLA focused. |
| Init | `/api/init` | Foundation only | Protected by `INIT_SECRET`; env documentation missing. |

# UI Changes Review

| UI area | Current behavior | Status | Notes |
|---|---|---|---|
| Login/OTP | OTP modal opens after pre-auth login. | Mostly implemented | Server flow is much stronger than before. |
| Dashboard | RH/CHEF PDF export; collaborator monthly bonus card. | Mostly implemented | Some report strings should be checked for encoding. |
| New request | Supports payslip period selection. | Mostly implemented | Good duplicate-period prevention in UI. |
| Approvals | RH can approve/generate payslip. | Mostly implemented | Generation failure after approval must be handled. |
| My requests | Card-level downloads for certificates/payslips. | Mostly implemented | Details modal needs payslip download support. |
| Users | Salary grade and override inputs; delete impact dialog. | Mostly implemented | Salary history is not visible. |
| Equipe | Salary, bonuses, evaluations, tasks, skills visible for RH/CHEF scope. | Mostly implemented | Access rules should be regression-tested. |
| Bonuses | New collaborator bonus page. | Fully implemented | Read-only history page is useful. |
| Skills | RH catalog and CHEF team skill management. | Mostly implemented | Strongest UI-service pairing. |
| Projects | AI task generation preview, task review, required skills. | Mostly implemented | Generated task required skills gap. |
| Chat | Direct/group chat UI. | Partially implemented | Group live fanout incomplete. |
| Audit | RH logs with Excel export. | Mostly implemented | Entity filters lag new modules. |
| Settings | Profile/password/theme/SLA/signature/RH transfer. | Partially implemented | Profile avatar HTTPS-only mismatch and mixed language remain. |

# End-to-End Workflow Checks

1. Login with untrusted device:
   - Password validates.
   - Pre-auth cookie is set.
   - OTP is required before real session.
   - Risk: no attempt lockout and rate limiting disabled.

2. Login with trusted device:
   - Password validates.
   - Trusted-device cookie can skip OTP.
   - Risk: logout does not clear trusted device.

3. Collaborator leave request:
   - Validates dates, overlap, balance.
   - Routes through CHEF then RH.
   - Deducts leave on final approval.
   - SLA and notifications are integrated.

4. Collaborator authorization request:
   - Routes through CHEF then RH.
   - Uses request history, SLA, notifications, audit.

5. Work certificate request:
   - Direct RH approval.
   - Generates PDF document and embeds RH signature if present.

6. Payslip request:
   - Collaborator selects period.
   - RH approves.
   - Payslip row is created and PDF can be downloaded.
   - Risk: missing salary history/migrations and generation-after-approval atomicity.

7. Employee creation:
   - RH creates user with role, grade, manager, salary override, skills.
   - Salary history is initialized.
   - Risk: seed/backfill and migrations must exist.

8. Employee deletion:
   - RH reviews impact and reassigns where needed.
   - Broad cleanup occurs.
   - Risk: hard delete and orphan generated files.

9. Salary grade change:
   - RH assigns grade.
   - Salary history syncs.
   - Risk: no clear audit log and weak numeric validation.

10. Task creation:
   - CHEF creates task for team member.
   - Required skills must be active technical skills.

11. AI task generation:
   - CHEF generates preview.
   - AI or local fallback proposes tasks.
   - Save persists tasks and notifications.
   - Risk: generated required skills not persisted.

12. Task review:
   - Collaborator submits deliverable.
   - CHEF approves/rejects with score.
   - Approved task can create/update performance bonus.

13. Monthly evaluation cron:
   - Creates validated evaluations from task scores.
   - Can create performance bonus.
   - Risk: collaborator API access and double-counting with task bonuses.

14. Annual bonus cron:
   - Creates annual bonuses from salary history.
   - Risk: no audit/notification and process-local scheduling.

15. Audit export/dashboard report:
   - RH exports audit logs.
   - RH/CHEF exports dashboard report.
   - Export actions are audited.

# Current Strong Points

- Backend OTP gating is now a real security improvement over the previous review.
- Role checks are present in most API services and routes.
- Request workflow has clear state transitions, notifications, audit entries, and SLA transitions.
- Skills module is mature, with catalog rules, history, and task integration.
- Task review now has concrete deliverable and scoring behavior.
- Payslip request/download is a meaningful end-to-end business feature.
- Dashboard and audit exports are useful operational features.
- The build currently completes and Prisma schema validates.

# Current Weak Points / Limitations / Risks

## Critical Issues

1. Missing migrations for new schema objects:
   - Current schema includes payroll/payslip/signature concepts that were not found in migrations.
   - Fresh deployments can fail even if the local database works.

2. Seed does not create salary history:
   - Payslip availability and salary-history-based calculations depend on `SalaryHistory`.
   - Demo users may be unable to request payslips.

3. Rate limiting is disabled:
   - `rateLimitedPaths` is empty.
   - Auth endpoints are not protected as expected.

4. TypeScript validation is skipped:
   - `next.config.mjs` has `typescript.ignoreBuildErrors: true`.
   - The green build does not guarantee type correctness.

5. Payslip approval/generation can split:
   - Approval transaction can succeed before payslip creation fails.
   - This can leave an approved request without the expected payslip.

## Important Non-Blocking Issues

- OTP verification needs attempt counters and lockout.
- Collaborator evaluation API access appears too broad.
- Group chat live fanout is still incomplete.
- Socket message handler should validate `recipientId` is a conversation participant.
- Bonus generation lacks audit and notifications.
- RH transfer lacks audit and should reconsider identity mutation.
- Signature upload needs file size/dimension validation.
- Audit entity filters do not cover all new modules.
- Cron jobs are registered through app/layout side effects and log repeatedly during build.
- `.env.example` is deleted while more env variables are required.
- Salary grade and bonus rule numeric validation should be stricter.
- Some source/build text appears to contain encoding artifacts; generated French UI/PDF text should be verified.

## Future Improvements

- Replace hard employee deletion with deactivation/archival.
- Add a salary history UI.
- Add payslip generation retry/failure state.
- Add true payroll deductions if payslips are meant to be legally accurate.
- Add async export jobs for large audit/report exports.
- Move process crons to a deployment-safe scheduler.
- Consolidate duplicate task review endpoints.

# Final Feature Classification Table

| Feature/module | Current status | Main reason |
|---|---|---|
| Authentication and OTP | Mostly implemented | Real backend OTP exists; rate limiting/attempt lockout missing. |
| Employee CRUD | Mostly implemented | Strong admin paths; hard delete and migration risks remain. |
| Profile/settings | Partially implemented | Useful settings; avatar mismatch, RH transfer, signature risks. |
| Leave/authorization requests | Mostly implemented | Approval, SLA, audit, notifications present. |
| Work certificate documents | Mostly implemented | PDF and RH signature present. |
| Payslip requests | Mostly implemented | End-to-end flow exists; migration/atomicity risks. |
| Salary grades | Partially implemented | APIs exist; migrations/validation concerns. |
| Salary history | Partially implemented | Service exists; backfill/UI/audit missing. |
| Bonus rules/bonuses | Partially implemented | Automated generation exists; audit/policy risks. |
| Evaluations | Partially implemented | Cron exists; access/double-count risks. |
| Projects/tasks | Mostly implemented | Strong workflow; generated skills/review API cleanup needed. |
| AI task generation | Mostly implemented | AI and fallback exist; persistence/documentation gaps. |
| Skills | Mostly implemented | Strong validation/history/role behavior. |
| Chat | Partially implemented | Direct chat works; group real-time partial. |
| Notifications | Mostly implemented | Broad coverage; gaps for payroll/signature/transfer. |
| SLA | Mostly implemented | Config/stats/cron present; deployment model needs care. |
| Audit logs | Mostly implemented | Core logs and export; coverage/filter gaps. |
| Dashboard reports | Mostly implemented | PDF export exists; scope can expand. |
| Deployment/env | Foundation only | `.env.example` missing and migrations unclear. |

# Priority Fix Plan

## P0 - Fix Before Production

1. Generate and commit Prisma migrations for all current schema changes.
2. Add a migration or seed step that creates initial salary history for existing/demo employees.
3. Re-enable and test rate limiting for auth and sensitive APIs.
4. Stop skipping TypeScript validation, then fix resulting type errors.
5. Make payslip generation atomic with request approval or add a reliable failed-generation recovery state.
6. Restore `.env.example` with safe placeholders for all required variables.

## P1 - High Value Hardening

1. Add OTP attempt counters and lockout.
2. Add audit logs for salary changes, bonus generation, signature upload/delete, RH transfer, SLA config changes, and payslip generation.
3. Fix collaborator access to evaluations.
4. Fix group chat live fanout and validate socket recipient membership.
5. Add file validation and resource limits for signature uploads.
6. Move cron startup to a server-only deployment-safe location.

## P2 - Product Completeness

1. Add salary history UI.
2. Explain bonus sources in collaborator bonus history.
3. Add payslip download support in request details modal.
4. Consolidate task review endpoints.
5. Add generated task required-skills persistence or remove that expectation.
6. Expand dashboard PDF report to include project/task/bonus/evaluation metrics.

# Testing Checklist

## Auth and Security

- Login untrusted device returns OTP step and no full session.
- Protected API rejects pre-auth-only cookie.
- OTP verify creates session and clears pre-auth.
- OTP resend throttle works.
- Wrong OTP attempts are rate-limited/locked after future fix.
- Trusted-device login path works.
- Logout behavior for trusted-device cookie matches product decision.
- CSRF origin/referer checks reject mutating cross-origin requests.

## Database and Seed

- Fresh `prisma migrate deploy` creates every model in `schema.prisma`.
- Seed runs on a fresh migrated database.
- Seeded users have salary history.
- Payslip periods are available for seeded collaborators.
- Salary grade/bonus rule numeric validation rejects negative values.

## Requests and Documents

- Leave overlap and balance checks work.
- CHEF then RH approval path works for leave/authorization.
- Direct RH path works for document/loan.
- Work certificate generates and downloads.
- Payslip request prevents duplicate periods.
- Payslip approval creates exactly one payslip.
- Payslip PDF is downloadable by owner, RH, and direct CHEF only.
- Future document types do not accidentally trigger payslip generation.

## Payroll and Bonuses

- Salary history closes/open records correctly on grade/override change.
- Monthly payslip uses the correct salary for the month.
- Annual payslip handles partial-year employment and salary changes.
- Task approval creates/updates only the intended task bonus.
- Monthly evaluation bonus policy does not double-count task bonuses unless intended.
- Annual bonus cron is idempotent.

## Projects, Tasks, and Skills

- Manual task required skills accept only active technical skills.
- Inactive or soft skills cannot be required for tasks.
- AI generation works with Groq key.
- Local fallback works without Groq key.
- Generated task save creates tasks for valid assignees only.
- Collaborator submit-review requires deliverable.
- CHEF review score validation rejects invalid scores.

## Chat, Notifications, SLA, Audit

- Direct chat messages appear live for both users.
- Group chat messages appear live for all participants after fix.
- Chat recipient spoofing is rejected.
- Notifications are created for request/task/SLA events.
- SLA warning/breach/escalation cron sends expected notifications.
- Audit export respects filters.
- Dashboard PDF export is role-scoped.
- New sensitive actions create audit rows after audit fixes.

## UI and Encoding

- Request cards and detail modals show correct document/payslip downloads.
- RH signature upload/draw/delete works and generated PDFs show it.
- RH transfer flow text is fully French and clear.
- Generated PDFs render French accents correctly.
- Mobile and desktop layouts do not overlap text/buttons.

# Files Inspected

Key files and folders inspected during this review:

- `C:\Users\baalo\.codex\attachments\fa0b4996-c251-449a-bb2e-72d15311174b\pasted-text.txt`
- `C:\Users\baalo\Downloads\ARABSOFT_TECHNICAL_INVENTORY.md`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/migrations/`
- `package.json`
- `package-lock.json`
- `next.config.mjs`
- `docker-compose.yml`
- `Dockerfile`
- `middleware.ts`
- `app/layout.tsx`
- `app/api/auth/login/route.ts`
- `app/api/auth/send-otp/route.ts`
- `app/api/auth/verify-otp/route.ts`
- `app/api/auth/me/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/requests/route.ts`
- `app/api/requests/[id]/action/route.ts`
- `app/api/requests/[id]/document/route.ts`
- `app/api/payslips/[id]/pdf/route.ts`
- `app/api/employees/route.ts`
- `app/api/employees/[id]/route.ts`
- `app/api/employees/[id]/salary/route.ts`
- `app/api/employees/[id]/salary-grade/route.ts`
- `app/api/employees/[id]/bonuses/route.ts`
- `app/api/employees/[id]/payslips/route.ts`
- `app/api/salary-grades/route.ts`
- `app/api/bonus-rules/route.ts`
- `app/api/bonuses/annual/route.ts`
- `app/api/bonuses/exceptional/route.ts`
- `app/api/evaluations/route.ts`
- `app/api/projects/route.ts`
- `app/api/projects/[id]/route.ts`
- `app/api/projects/[id]/generate-tasks/route.ts`
- `app/api/projects/[id]/tasks/route.ts`
- `app/api/projects/[id]/tasks/review/route.ts`
- `app/api/tasks/route.ts`
- `app/api/tasks/[id]/submit-review/route.ts`
- `app/api/tasks/[id]/review/route.ts`
- `app/api/skills/route.ts`
- `app/api/skills/[id]/route.ts`
- `app/api/skills/employees/route.ts`
- `app/api/conversations/route.ts`
- `app/api/conversations/[id]/messages/route.ts`
- `app/api/conversations/[id]/read/route.ts`
- `app/api/notifications/route.ts`
- `app/api/sla-config/route.ts`
- `app/api/sla/stats/route.ts`
- `app/api/audit-logs/route.ts`
- `app/api/audit-logs/export/route.ts`
- `app/api/dashboard/report/route.ts`
- `app/api/rh/signature/route.ts`
- `app/api/rh/transfer/route.ts`
- `app/api/init/route.ts`
- `app/dashboard/page.tsx`
- `app/dashboard/new-request/page.tsx`
- `app/dashboard/my-requests/page.tsx`
- `app/dashboard/approvals/page.tsx`
- `app/dashboard/users/page.tsx`
- `app/dashboard/equipe/page.tsx`
- `app/dashboard/bonuses/page.tsx`
- `app/dashboard/projects/page.tsx`
- `app/dashboard/projects/[id]/page.tsx`
- `app/dashboard/skills/page.tsx`
- `app/dashboard/chat/page.tsx`
- `app/dashboard/audit/page.tsx`
- `app/dashboard/settings/page.tsx`
- `components/request-card.tsx`
- `components/request-details-summary.tsx`
- `components/users/employee-create-dialog.tsx`
- `components/users/delete-employee-dialog.tsx`
- `components/ui/signature-pad.tsx`
- `components/ui/signature-uploader.tsx`
- `lib/constants.ts`
- `lib/constants/nav.ts`
- `lib/contexts/auth.context.tsx`
- `lib/document-type.ts`
- `lib/validators/request.validators.ts`
- `lib/services/server/auth.service.ts`
- `lib/services/server/employees.service.ts`
- `lib/services/server/request.service.ts`
- `lib/services/server/documents.service.ts`
- `lib/services/server/payslip.service.ts`
- `lib/services/server/payslip-pdf.service.tsx`
- `lib/services/server/salary-history.service.ts`
- `lib/services/server/payroll.service.ts`
- `lib/services/server/bonus.service.ts`
- `lib/services/server/projects.service.ts`
- `lib/services/server/tasks.service.ts`
- `lib/services/server/chat.service.ts`
- `lib/services/server/socket.service.ts`
- `lib/services/server/notification.service.ts`
- `lib/services/server/sla.service.ts`
- `lib/services/server/audit.service.ts`
- `lib/services/server/dashboard-report.service.tsx`
- `lib/services/server/signature.service.ts`
- `lib/services/server/rh-settings.service.ts`
- `lib/skills/service.ts`
- `lib/skills/validation.ts`
- `lib/tasks.ts`
- `lib/cron.ts`
- `lib/cron/annual-bonus.ts`
- `lib/cron/monthly-evaluation.ts`
- `lib/audit-export.ts`
- `lib/documents/work-certificate.ts`
- `lib/utils/get-rh-signature.ts`

# Final Conclusion

The current ARABSOFT codebase is substantially more capable than the previous technical inventory. The most important improvement is that OTP is now genuinely enforced by the backend before session issuance. The largest new business capability is the emerging payroll layer: salary history, payslip requests, payslip PDFs, bonus history, automatic annual bonuses, and task-performance bonuses.

The codebase is not production-ready until migration drift, seed salary history, rate limiting, TypeScript validation, and payslip approval atomicity are fixed. After those P0 issues, the next highest value work is audit coverage for sensitive new modules and access-control hardening around evaluations and chat.
